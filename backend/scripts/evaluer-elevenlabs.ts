/**
 * Évaluation de la transcription ElevenLabs (Scribe) sur les 18 vraies notes vocales
 * (ia/data/enregistrements : 9 en français, 9 en fon, un seul locuteur), dans la chaîne de production :
 * ElevenLabs -> Gemini (prompt de production, entrée texte) -> union avec le lexique -> règles de triage.
 *
 *   npx tsx scripts/evaluer-elevenlabs.ts
 *
 * Français : taux d'erreur de mots (WER) contre le texte de référence de la vignette lue, niveau de
 * triage obtenu contre le niveau attendu. Fon : seule la bonne abstention est mesurée (la note ne doit
 * jamais être prise pour du français, sinon des symptômes seraient inventés).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import prompt from '../src/ia/extraction.json';
import { genererContenu } from '../src/ia/gemini.client';
import { transcrireElevenLabs, versLangue } from '../src/ia/elevenlabs.client';
import { detecterSignesGraves } from '../src/ia/signes-graves';
import { evaluerTriage } from '../src/ia/triage';
import { versEntree, type Extraction } from '../src/ia/voice-triage.service';

const RACINE = path.resolve(__dirname, '../..');
const DONNEES = path.join(RACINE, 'ia/data');
const manifeste: { fichier: string; vignette: string; langue: string }[] = JSON.parse(readFileSync(path.join(DONNEES, 'enregistrements/manifeste.json'), 'utf8'));
const vignettes = new Map<string, any>(
  readFileSync(path.join(DONNEES, 'vignettes.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((v) => [v.id, v]),
);

const mots = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

/** Taux d'erreur de mots : distance d'édition entre suites de mots, rapportée à la référence */
function wer(reference: string, hypothese: string) {
  const r = mots(reference);
  const h = mots(hypothese);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0]![j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
  }
  return { erreurs: d[r.length]![h.length]!, total: r.length };
}

/** Gemini est parfois surchargé (503, 429) ou trop lent : jusqu'à 5 essais espacés de 30 s */
async function avecReprises<T>(f: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await f();
    } catch (e) {
      const err = e as { httpStatus?: number; code?: string };
      const passager = err.code === 'delai_depasse' || err.httpStatus === 503 || err.httpStatus === 429;
      if (essai >= 5 || !passager) throw e;
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
}

async function main() {
  const lignes: string[] = [];
  const brut: string[] = [];
  let erreursMots = 0;
  let totalMots = 0;
  let niveauxCorrects = 0;
  let alertesRatees = 0;
  let francais = 0;
  let fonAbstenus = 0;
  let fon = 0;
  const latences: number[] = [];

  for (const note of manifeste) {
    const audio = readFileSync(path.join(DONNEES, `enregistrements/audio/${note.fichier}.webm`)).toString('base64');
    const t = await transcrireElevenLabs(audio, 'audio/webm');
    latences.push(t.latencyMs);
    const langue = versLangue(t.codeLangue);
    const v = vignettes.get(note.vignette);
    const attendu = evaluerTriage(versEntree({ ...v, transcription: v.texte, langue: 'fr', signes_graves: v.signes_graves } as Extraction, v.traitement_recent)).niveau;

    if (note.langue === 'fon') {
      fon++;
      const abstention = langue !== 'fr';
      if (abstention) fonAbstenus++;
      lignes.push(`| ${note.fichier} | fon | ${t.codeLangue} (${t.probabiliteLangue.toFixed(2)}) | — | ${abstention ? 'abstention (correct)' : '**pris pour du français**'} | ${attendu} | ${t.latencyMs} ms |`);
      brut.push(JSON.stringify({ fichier: note.fichier, langue: note.langue, transcription: t.texte, codeLangue: t.codeLangue, probabilite: t.probabiliteLangue, latenceMs: t.latencyMs, modele: t.modele }));
      continue;
    }

    francais++;
    const w = wer(v.texte, t.texte);
    erreursMots += w.erreurs;
    totalMots += w.total;
    // Même chaîne qu'en production (voice-triage.service.ts), à partir du texte transcrit
    const g = await avecReprises(() => genererContenu({
      system: prompt.system,
      parts: [{ text: prompt.user_text + t.texte }],
      schema: prompt.schema,
      temperature: prompt.generation.temperature,
      responseMimeType: prompt.generation.responseMimeType,
    }));
    const extraction = JSON.parse(g.text) as Extraction;
    extraction.transcription = t.texte;
    extraction.signes_graves = Array.from(new Set([...extraction.signes_graves, ...detecterSignesGraves(t.texte)]));
    const obtenu = evaluerTriage(versEntree(extraction, v.traitement_recent)).niveau;
    if (obtenu === attendu) niveauxCorrects++;
    if (attendu === 'alerte' && obtenu !== 'alerte') alertesRatees++;
    lignes.push(`| ${note.fichier} | fr | ${t.codeLangue} (${t.probabiliteLangue.toFixed(2)}) | ${((100 * w.erreurs) / w.total).toFixed(0)} % | ${obtenu} | ${attendu} | ${t.latencyMs} ms |`);
    brut.push(JSON.stringify({ fichier: note.fichier, langue: note.langue, reference: v.texte, transcription: t.texte, codeLangue: t.codeLangue, probabilite: t.probabiliteLangue, latenceMs: t.latencyMs, modele: t.modele, prompt: prompt.version, extraction, niveau: obtenu, attendu }));
    await new Promise((r) => setTimeout(r, 3000));
  }

  latences.sort((a, b) => a - b);
  const rapport = [
    `# ElevenLabs Scribe sur les vraies notes vocales (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Chaîne de production : ElevenLabs (${process.env.ELEVENLABS_STT_MODEL ?? 'scribe_v2'}) -> Gemini (prompt ${prompt.version}) -> union avec le lexique -> règles. 18 notes, **un seul locuteur**.`,
    '',
    `- **Français** : taux d'erreur de mots ${((100 * erreursMots) / totalMots).toFixed(1)} % (${erreursMots}/${totalMots} mots) ; niveau de triage correct ${niveauxCorrects}/${francais} ; alertes ratées ${alertesRatees}/${manifeste.filter((n) => n.langue === 'fr').length}`,
    `- **Fon** : notes correctement écartées (jamais prises pour du français) ${fonAbstenus}/${fon}`,
    `- **Délai de transcription** : médiane ${latences[latences.length >> 1]} ms, maximum ${latences.at(-1)} ms`,
    '',
    '| Note | Langue | Langue détectée (probabilité) | Erreur de mots | Niveau obtenu | Niveau attendu | Délai |',
    '|---|---|---|---|---|---|---|',
    ...lignes,
  ].join('\n');
  console.log(rapport);
  writeFileSync(path.join(RACINE, 'ia/resultats/elevenlabs__reel.md'), rapport + '\n');
  writeFileSync(path.join(RACINE, 'ia/resultats/elevenlabs__reel.jsonl'), brut.join('\n') + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
