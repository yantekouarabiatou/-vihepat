/**
 * Évaluation de la veille des mots sensibles des groupes de soutien (services/moderation.service.ts)
 * sur le jeu figé ia/data/mots_sensibles_test.jsonl (90 messages fictifs, écrits après le lexique,
 * mesurés sans le retoucher ensuite).
 *
 *   npx tsx scripts/evaluer-mots-sensibles.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES_ALERTE, detecterMotsSensibles } from '../src/services/moderation.service';

const RACINE = path.resolve(__dirname, '../..');
const brut = readFileSync(path.join(RACINE, 'ia/data/mots_sensibles_test.jsonl'));
const EMPREINTE = 'f56c814122937372e99088fc533e3fd009859d7608048624577d1fd4cf78f08f';
if (createHash('sha256').update(brut).digest('hex') !== EMPREINTE) throw new Error('Le jeu de test a changé : il doit rester figé');
const cas: { id: string; texte: string; attendu: string | null }[] = brut.toString('utf8').trim().split('\n').map((l) => JSON.parse(l));

const parCat = Object.fromEntries(CATEGORIES_ALERTE.map((c) => [c, { attendus: 0, signales: 0, bonneCategorie: 0 }]));
let negatifsSignales = 0;
const erreurs: string[] = [];
for (const c of cas) {
  const d = detecterMotsSensibles(c.texte);
  if (c.attendu === null) {
    if (d) {
      negatifsSignales++;
      erreurs.push(`FAUSSE ALERTE ${c.id} [${d.categories.join(', ')} : ${d.mots.join(', ')}] ${c.texte}`);
    }
    continue;
  }
  const s = parCat[c.attendu]!;
  s.attendus++;
  if (d) s.signales++;
  if (d?.categories.includes(c.attendu as never)) s.bonneCategorie++;
  else erreurs.push(`${d ? 'MAUVAISE CATÉGORIE' : 'MANQUÉ'} ${c.id} (attendu ${c.attendu}${d ? `, trouvé ${d.categories.join(', ')}` : ''}) ${c.texte}`);
}

const positifs = cas.filter((c) => c.attendu !== null).length;
const negatifs = cas.length - positifs;
const signalesTotal = Object.values(parCat).reduce((a, s) => a + s.signales, 0);
const rapport = [
  `# Veille des mots sensibles : évaluation (${new Date().toISOString().slice(0, 10)})`,
  '',
  `Jeu figé \`ia/data/mots_sensibles_test.jsonl\` : ${positifs} messages à signaler, ${negatifs} messages à ne pas signaler (dont pièges : négations, « mourir de rire », dates et nombres).`,
  '',
  '| Catégorie | Signalés à l\'équipe | Bonne catégorie |',
  '|---|---|---|',
  ...CATEGORIES_ALERTE.map((k) => {
    const s = parCat[k]!;
    return `| ${k} | ${s.signales}/${s.attendus} | ${s.bonneCategorie}/${s.attendus} |`;
  }),
  '',
  `- Messages à signaler effectivement signalés (rappel global) : ${signalesTotal}/${positifs}`,
  `- Messages anodins signalés à tort (fausses alertes) : ${negatifsSignales}/${negatifs}`,
  '',
  'Erreurs :',
  '',
  ...erreurs.map((e) => `- ${e}`),
].join('\n');
console.log(rapport);
writeFileSync(path.join(RACINE, 'ia/resultats/mots_sensibles.md'), rapport + '\n');
