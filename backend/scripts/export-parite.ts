/**
 * Exporte des cas aléatoires évalués par le moteur TypeScript, pour vérifier que
 * le portage Python du notebook (ia/vihepat_ia/triage_rules.py) donne le même niveau.
 *   npm run ia:parite
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { evaluerTriage, SYMPTOMES, SIGNES_GRAVES, DUREES, INTENSITES } from '../src/ia/triage';

// Générateur pseudo-aléatoire à graine fixe : le fichier est reproductible
let graine = 20261005;
const alea = () => ((graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const tirer = <T>(l: readonly T[], p: number) => l.filter(() => alea() < p);

const cas = Array.from({ length: 5000 }, () => {
  const entree = {
    symptomes: tirer(SYMPTOMES.map((s) => s.id), 0.2),
    duree: DUREES[Math.floor(alea() * DUREES.length)]!.id,
    intensite: INTENSITES[Math.floor(alea() * INTENSITES.length)]!.id,
    signesGraves: tirer(SIGNES_GRAVES.map((s) => s.id), 0.04),
    traitementRecent: alea() < 0.3,
  };
  return { ...entree, niveau: evaluerTriage(entree).niveau };
});

const sortie = path.resolve(__dirname, '../../ia/data/parite_ts.json');
writeFileSync(sortie, JSON.stringify(cas));
console.log(`${cas.length} cas écrits dans ${sortie}`);
