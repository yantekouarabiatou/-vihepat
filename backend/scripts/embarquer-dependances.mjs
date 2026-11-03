#!/usr/bin/env node
/**
 * Met à jour des librairies de l'API en production SANS SSH ni « npm install » sur le serveur.
 *
 * Principe : Node cherche un module d'abord dans `dist/node_modules/`, avant le dossier commun du
 * serveur (`vihepat-api/node_modules`, géré par cPanel). Le programme regroupe chaque librairie en un
 * seul fichier (esbuild), vérifie qu'il se charge, puis l'envoie dans `vihepat-api/dist/node_modules/`
 * par FTPS et redémarre l'API.
 *
 * Utilisation, depuis le dossier backend :
 *   node scripts/embarquer-dependances.mjs zod                 # prépare seulement (dossier embarque/)
 *   node scripts/embarquer-dependances.mjs zod --envoyer       # prépare, envoie, redémarre
 *
 * Identifiants FTP : variables FTP_USER et FTP_PASS, sinon le programme les demande.
 * Hôte : FTP_HOST (par défaut web64.lws-hosting.com). Rien n'est enregistré sur le disque
 * en dehors d'un fichier .netrc temporaire, supprimé à la fin.
 *
 * Seules les librairies en JavaScript pur s'y prêtent (zod, par exemple) ; pas celles qui
 * contiennent du code compilé (bcrypt, mysql2 natif…).
 */
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(BACKEND, 'embarque');
const args = process.argv.slice(2);
const envoyer = args.includes('--envoyer');
const paquets = args.filter((a) => !a.startsWith('--'));
const HOTE = process.env.FTP_HOST ?? 'web64.lws-hosting.com';

if (paquets.length === 0) {
  console.error('Indiquez au moins une librairie, par exemple : node scripts/embarquer-dependances.mjs zod --envoyer');
  process.exit(1);
}

const exiger = createRequire(path.join(BACKEND, 'package.json'));

function preparer(nom) {
  const version = exiger(`${nom}/package.json`).version;
  const dossier = path.join(SORTIE, nom);
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, 'index.js');
  // Regroupement en un seul fichier CommonJS, depuis le dossier backend pour résoudre la bonne version
  execFileSync('npx', ['--yes', 'esbuild@0.24.2', '--bundle', '--platform=node', '--format=cjs', '--target=node20', '--minify', `--outfile=${fichier}`],
    { cwd: BACKEND, input: `module.exports = require(${JSON.stringify(nom)});`, stdio: ['pipe', 'inherit', 'inherit'], shell: process.platform === 'win32' });
  writeFileSync(path.join(dossier, 'package.json'), JSON.stringify({
    name: nom, version, main: 'index.js',
    description: `${nom} ${version} regroupé en un fichier (esbuild) pour le serveur sans npm install`,
  }, null, 2) + '\n');
  // Vérification : le fichier se charge et expose les mêmes noms que la librairie d'origine
  const regroupe = createRequire(fichier)(fichier);
  const origine = exiger(nom);
  const manquants = Object.keys(origine).filter((k) => !(k in regroupe));
  if (manquants.length) throw new Error(`${nom} : exports manquants dans le regroupement : ${manquants.slice(0, 5).join(', ')}`);
  console.log(`✔ ${nom} ${version} prêt (${Math.round(statSync(fichier).size / 1024)} Ko) : ${fichier}`);
  return { nom, version, dossier };
}

async function identifiants() {
  if (process.env.FTP_USER && process.env.FTP_PASS) return { user: process.env.FTP_USER, pass: process.env.FTP_PASS };
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const user = process.env.FTP_USER ?? (await rl.question('Utilisateur FTP : '));
  const pass = process.env.FTP_PASS ?? (await rl.question('Mot de passe FTP : '));
  rl.close();
  return { user: user.trim(), pass: pass.trim() };
}

function curl(netrc, extra) {
  return execFileSync('curl', ['-sS', '--ssl-reqd', '--netrc-file', netrc, ...extra], { encoding: 'utf8' });
}

function taille(netrc, chemin) {
  try {
    const entetes = curl(netrc, ['-I', `ftp://${HOTE}/vihepat-api/${chemin}`]);
    return Number(/content-length:\s*(\d+)/i.exec(entetes)?.[1] ?? -1);
  } catch {
    return -1;
  }
}

/** Envoie un fichier et vérifie sa taille ; l'antivirus de l'hébergeur refuse parfois un envoi (erreur 451). */
function envoyerFichier(netrc, local, distant) {
  for (let essai = 1; essai <= 6; essai++) {
    try {
      curl(netrc, ['--ftp-create-dirs', '-T', local, `ftp://${HOTE}/vihepat-api/${distant}`]);
      if (taille(netrc, distant) === statSync(local).size) {
        console.log(`  ✔ ${distant} (essai ${essai})`);
        return true;
      }
    } catch { /* nouvel essai */ }
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},5000)']);
  }
  console.error(`  ✘ ${distant} refusé par le serveur`);
  return false;
}

async function main() {
  const prets = paquets.map(preparer);
  if (!envoyer) {
    console.log('\nPréparé seulement. Ajoutez --envoyer pour mettre en production.');
    return;
  }
  const { user, pass } = await identifiants();
  const netrc = path.join(tmpdir(), `vihepat-netrc-${process.pid}`);
  writeFileSync(netrc, `machine ${HOTE} login ${user} password ${pass}\n`, { mode: 0o600 });
  try {
    let ok = true;
    for (const p of prets) {
      console.log(`Envoi de ${p.nom} ${p.version}…`);
      ok = envoyerFichier(netrc, path.join(p.dossier, 'index.js'), `dist/node_modules/${p.nom}/index.js`) && ok;
      ok = envoyerFichier(netrc, path.join(p.dossier, 'package.json'), `dist/node_modules/${p.nom}/package.json`) && ok;
    }
    if (!ok) {
      console.error('\nUn fichier a été refusé : l\'API n\'est PAS redémarrée et garde la version précédente en mémoire.');
      process.exitCode = 1;
      return;
    }
    const restart = path.join(tmpdir(), `vihepat-restart-${process.pid}.txt`);
    writeFileSync(restart, String(Date.now()));
    envoyerFichier(netrc, restart, 'tmp/restart.txt');
    rmSync(restart, { force: true });
    console.log('\nRedémarrage demandé. Vérification dans 10 s…');
    execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},10000)']);
    const sante = execFileSync('curl', ['-s', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', '-w', '%{http_code}', 'https://vihepat.secourseducatif.com/api/health'], { encoding: 'utf8' });
    console.log(sante === '200' ? '✔ API en ligne (health 200)' : `⚠ health a répondu ${sante} : vérifiez le journal logs/passenger.log`);
  } finally {
    rmSync(netrc, { force: true });
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
