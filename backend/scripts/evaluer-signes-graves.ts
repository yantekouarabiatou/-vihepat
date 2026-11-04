/**
 * Évaluation des signes de gravité sur le jeu figé ia/data/signes_graves_v2.jsonl (110 messages fictifs,
 * écrits et figés AVANT toute correction ; empreinte dans signes_graves_v2.sha256).
 *
 *   [VERSION_PROMPT=v1] npx tsx scripts/evaluer-signes-graves.ts <variante> [dev|controle]
 *
 * Deux jeux figés : `dev` (signes_graves_v2, 110 messages) sert à corriger prompt et lexique ;
 * `controle` (signes_graves_controle, 70 messages, écrit avant toute correction) ne sert qu'à la
 * mesure finale, pour ne pas surestimer le gain.
 *
 * Variantes :
 *   gemini      : extraction Gemini (prompt de production, entrée texte), signes_graves seuls
 *   mots-cles   : lexique déterministe seul (src/ia/signes-graves.ts)
 *   union       : ce que fait la production : Gemini + lexique
 *
 * Les réponses brutes de Gemini sont gardées dans ia/resultats/ (une ligne par message), ce qui permet de
 * recalculer `mots-cles` et `union` sans rappeler l'API.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import promptProduction from '../src/ia/extraction.json';
import { genererContenu } from '../src/ia/gemini.client';
import { detecterSignesGraves, SIGNES } from '../src/ia/signes-graves';

const RACINE = path.resolve(__dirname, '../..');
// VERSION_PROMPT=v1 relit la version archivée (ia/prompts/extraction-v1.json) pour mesurer l'état de départ
const prompt: typeof promptProduction = process.env.VERSION_PROMPT
  ? JSON.parse(readFileSync(path.join(RACINE, `ia/prompts/extraction-${process.env.VERSION_PROMPT}.json`), 'utf8'))
  : promptProduction;
const variante = process.argv[2] ?? 'union';
const nomJeu = process.argv[3] === 'controle' ? 'controle' : 'dev';
const JEUX = {
  dev: { fichier: 'signes_graves_v2', empreinte: '6e1a24d685a768ffd39c6a892e094ef6dbfbbcbe4826f53671108205c44ea0eb' },
  controle: { fichier: 'signes_graves_controle', empreinte: '888ced640149d3f0f0d634b7d874b075278e804392648396b11f10508db5180d' },
};
const JEU = path.join(RACINE, `ia/data/${JEUX[nomJeu].fichier}.jsonl`);
const EMPREINTE = JEUX[nomJeu].empreinte;

interface Cas { id: string; texte: string; attendus: string[] }

async function main() {
  const brut = readFileSync(JEU);
  const sha = createHash('sha256').update(brut).digest('hex');
  if (sha !== EMPREINTE) throw new Error(`Le jeu de test a changé (sha256 ${sha}) : il doit rester figé`);
  const cas: Cas[] = brut.toString('utf8').trim().split('\n').map((l) => JSON.parse(l));

  // Réponses Gemini : relues si déjà obtenues pour cette version du prompt, sinon demandées (4 s d'écart)
  const fichierGemini = path.join(RACINE, `ia/resultats/${JEUX[nomJeu].fichier}__gemini__${prompt.version}.jsonl`);
  const gemini = new Map<string, string[]>();
  if (existsSync(fichierGemini)) {
    for (const l of readFileSync(fichierGemini, 'utf8').trim().split('\n')) {
      const r = JSON.parse(l);
      gemini.set(r.id, r.signes_graves);
    }
  }
  if (variante !== 'mots-cles') {
    const lignes: string[] = existsSync(fichierGemini) ? readFileSync(fichierGemini, 'utf8').trim().split('\n') : [];
    for (const c of cas) {
      if (gemini.has(c.id)) continue;
      const g = await genererContenu({
        system: prompt.system,
        parts: [{ text: prompt.user_text + c.texte }],
        schema: prompt.schema,
        temperature: prompt.generation.temperature,
        responseMimeType: prompt.generation.responseMimeType,
      });
      const signes = (JSON.parse(g.text).signes_graves ?? []) as string[];
      gemini.set(c.id, signes);
      lignes.push(JSON.stringify({ id: c.id, signes_graves: signes, modele: g.modelVersion, prompt: prompt.version, latenceMs: g.latencyMs }));
      writeFileSync(fichierGemini, lignes.join('\n') + '\n');
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 4000));
    }
    process.stdout.write('\n');
  }

  const predire = (c: Cas): Set<string> => {
    const g = gemini.get(c.id) ?? [];
    const m = detecterSignesGraves(c.texte);
    if (variante === 'gemini') return new Set(g);
    if (variante === 'mots-cles') return new Set(m);
    return new Set([...g, ...m]);
  };

  // Rappel par signe, faux positifs (signe prédit absent des attendus), messages négatifs déclenchés
  const parSigne = Object.fromEntries(SIGNES.map((s) => [s, { attendus: 0, trouves: 0, fauxPositifs: 0 }]));
  let negatifsDeclenches = 0;
  let alertesRatees = 0;
  const erreurs: string[] = [];
  for (const c of cas) {
    const p = predire(c);
    for (const s of c.attendus) {
      parSigne[s]!.attendus++;
      if (p.has(s)) parSigne[s]!.trouves++;
      else erreurs.push(`MANQUÉ  ${c.id} ${s} : ${c.texte}`);
    }
    for (const s of p) {
      if (!c.attendus.includes(s)) {
        parSigne[s]!.fauxPositifs++;
        erreurs.push(`EN TROP ${c.id} ${s} : ${c.texte}`);
      }
    }
    if (c.attendus.length === 0 && p.size > 0) negatifsDeclenches++;
    // Une alerte ratée = un message grave pour lequel AUCUN signe n'est détecté (le triage ne passe pas en alerte)
    if (c.attendus.length > 0 && p.size === 0) alertesRatees++;
  }

  const lignes = SIGNES.map((s) => {
    const v = parSigne[s]!;
    return `| ${s} | ${v.trouves}/${v.attendus} | ${((100 * v.trouves) / v.attendus).toFixed(0)} % | ${v.fauxPositifs} |`;
  });
  const positifs = cas.filter((c) => c.attendus.length > 0).length;
  const negatifs = cas.length - positifs;
  const rapport = [
    `## Jeu « ${nomJeu} », variante « ${variante} » (prompt ${prompt.version}, ${new Date().toISOString().slice(0, 10)})`,
    '',
    '| Signe | Trouvés | Rappel | Faux positifs |',
    '|---|---|---|---|',
    ...lignes,
    '',
    `- Messages graves sans AUCUN signe détecté (alerte ratée) : ${alertesRatees}/${positifs}`,
    `- Messages négatifs déclenchant un signe (fausse alerte) : ${negatifsDeclenches}/${negatifs}`,
    '',
    ...erreurs.map((e) => `    ${e}`),
  ].join('\n');
  console.log(rapport);
  writeFileSync(path.join(RACINE, `ia/resultats/${JEUX[nomJeu].fichier}__${variante}__${prompt.version}.md`), rapport + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
