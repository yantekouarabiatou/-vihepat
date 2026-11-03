#!/usr/bin/env node
/**
 * Met à jour des librairies de l'API en production SANS SSH ni « npm install » sur le serveur.
 *
 * Principe : Node cherche un module d'abord dans `dist/node_modules/`, avant le dossier commun du
 * serveur (`vihepat-api/node_modules`, géré par cPanel). Le programme regroupe chaque librairie en un
 * seul fichier (esbuild), vérifie qu'il se charge, l'envoie dans `vihepat-api/dist/node_modules/`,
 * vérifie sa taille sur le serveur et redémarre l'API.
 *
 * Utilisation, depuis le dossier backend :
 *   node scripts/embarquer-dependances.mjs zod                 # prépare seulement (dossier embarque/)
 *   node scripts/embarquer-dependances.mjs zod --envoyer       # prépare, envoie par le cPanel (HTTPS), redémarre
 *   node scripts/embarquer-dependances.mjs zod --envoyer --ftp # idem par FTPS
 *
 * Envoi par le cPanel (par défaut) : interface officielle du cPanel en HTTPS, port 2083 (le même que
 * le navigateur). Utile quand le pare-feu de l'hébergeur bloque le FTP pour votre adresse.
 *   Identifiants : CPANEL_USER + CPANEL_TOKEN (jeton d'API créé dans cPanel > Sécurité > Gérer les
 *   jetons d'API, recommandé) ou CPANEL_USER + CPANEL_PASS ; sinon le programme les demande.
 * Envoi par FTPS (--ftp) : FTP_USER + FTP_PASS, sinon le programme les demande.
 * Hôte : HOTE_SERVEUR (par défaut web64.lws-hosting.com). Aucun identifiant n'est enregistré.
 *
 * Seules les librairies en JavaScript pur s'y prêtent (zod, par exemple) ; pas celles qui
 * contiennent du code compilé (bcrypt, mysql2 natif…).
 */
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(BACKEND, 'embarque');
const args = process.argv.slice(2);
const envoyer = args.includes('--envoyer');
const parFtp = args.includes('--ftp');
const paquets = args.filter((a) => !a.startsWith('--'));
const HOTE = process.env.HOTE_SERVEUR ?? process.env.FTP_HOST ?? 'web64.lws-hosting.com';
const SANTE = 'https://vihepat.secourseducatif.com/api/health';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function demander(questions) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const reponses = {};
  for (const [cle, question] of questions) reponses[cle] = (await rl.question(question)).trim();
  rl.close();
  return reponses;
}

/* ------------------------------------------------------------------ */
/* Envoi par le cPanel (HTTPS, port 2083)                              */
/* ------------------------------------------------------------------ */

async function transportCpanel() {
  let user = process.env.CPANEL_USER;
  let token = process.env.CPANEL_TOKEN;
  let pass = process.env.CPANEL_PASS;
  if (!user || (!token && !pass)) {
    const r = await demander([
      ['user', 'Utilisateur cPanel : '],
      ['secret', 'Jeton d\'API cPanel (ou laissez vide pour utiliser le mot de passe) : '],
    ]);
    user = user ?? r.user;
    token = r.secret || undefined;
    if (!token) pass = (await demander([['pass', 'Mot de passe cPanel : ']])).pass;
  }
  const base = `https://${HOTE}:2083`;
  const auth = token ? `cpanel ${user}:${token}` : `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  const racine = `/home/${user}/vihepat-api`;

  async function appel(url, init = {}) {
    const rep = await fetch(url, { ...init, headers: { Authorization: auth, ...(init.headers ?? {}) } });
    // Un mauvais identifiant répété peut faire bloquer l'adresse par le cPanel : on s'arrête net
    if (rep.status === 401 || rep.status === 403) throw new Error(`Accès refusé par le cPanel (${rep.status}) : vérifiez l'utilisateur et le jeton/mot de passe.`);
    const texte = await rep.text();
    try { return JSON.parse(texte); } catch { throw new Error(`Réponse inattendue du cPanel (${rep.status}) : ${texte.slice(0, 200)}`); }
  }

  async function creerDossiers(chemin) {
    // API2 Fileman::mkdir, un niveau à la fois ; l'erreur « existe déjà » est sans conséquence
    let courant = racine;
    for (const morceau of chemin.split('/').filter(Boolean)) {
      const q = new URLSearchParams({ cpanel_jsonapi_user: user, cpanel_jsonapi_apiversion: '2', cpanel_jsonapi_module: 'Fileman', cpanel_jsonapi_func: 'mkdir', path: courant, name: morceau });
      await appel(`${base}/json-api/cpanel?${q}`);
      courant = `${courant}/${morceau}`;
    }
  }

  async function tailleDistante(dossier, nom) {
    const q = new URLSearchParams({ dir: dossier, include_mime: '0', include_permissions: '0' });
    const r = await appel(`${base}/execute/Fileman/list_files?${q}`);
    const f = (r.data ?? []).find((x) => x.file === nom);
    return f ? Number(f.size) : -1;
  }

  return {
    nom: 'cPanel (HTTPS)',
    async envoyer(local, distant) {
      const dossierRel = path.posix.dirname(distant);
      const nom = path.posix.basename(distant);
      const dossier = `${racine}/${dossierRel}`;
      await creerDossiers(dossierRel);
      for (let essai = 1; essai <= 3; essai++) {
        const form = new FormData();
        form.append('dir', dossier);
        form.append('overwrite', '1');
        form.append('file-1', new Blob([readFileSync(local)]), nom);
        const r = await appel(`${base}/execute/Fileman/upload_files`, { method: 'POST', body: form });
        const attendu = statSync(local).size;
        if (r.status === 1 && (await tailleDistante(dossier, nom)) === attendu) {
          console.log(`  ✔ ${distant} (essai ${essai})`);
          return true;
        }
        console.error(`  … ${distant} : ${(r.errors ?? []).join(' ') || 'taille différente après envoi (antivirus ?)'}`);
        await pause(5000);
      }
      console.error(`  ✘ ${distant} refusé par le serveur`);
      return false;
    },
    async fin() {},
  };
}

/* ------------------------------------------------------------------ */
/* Envoi par FTPS (--ftp)                                              */
/* ------------------------------------------------------------------ */

async function transportFtp() {
  let user = process.env.FTP_USER;
  let pass = process.env.FTP_PASS;
  if (!user || !pass) {
    const r = await demander([['user', 'Utilisateur FTP : '], ['pass', 'Mot de passe FTP : ']]);
    user = user ?? r.user;
    pass = pass ?? r.pass;
  }
  const netrc = path.join(tmpdir(), `vihepat-netrc-${process.pid}`);
  writeFileSync(netrc, `machine ${HOTE} login ${user} password ${pass}\n`, { mode: 0o600 });
  const curl = (extra) => execFileSync('curl', ['-sS', '--ssl-reqd', '--connect-timeout', '15', '--netrc-file', netrc, ...extra], { encoding: 'utf8' });
  const taille = (chemin) => {
    try {
      return Number(/content-length:\s*(\d+)/i.exec(curl(['-I', `ftp://${HOTE}/vihepat-api/${chemin}`]))?.[1] ?? -1);
    } catch {
      return -1;
    }
  };
  return {
    nom: 'FTPS',
    async envoyer(local, distant) {
      for (let essai = 1; essai <= 6; essai++) {
        try {
          curl(['--ftp-create-dirs', '-T', local, `ftp://${HOTE}/vihepat-api/${distant}`]);
          if (taille(distant) === statSync(local).size) {
            console.log(`  ✔ ${distant} (essai ${essai})`);
            return true;
          }
        } catch (e) {
          // Port fermé : inutile d'insister (et cela aggraverait un blocage du pare-feu)
          if (/Failed to connect|Could not connect/i.test(String(e.stderr ?? e.message))) {
            console.error('  ✘ Connexion FTP impossible (pare-feu ?). Relancez sans --ftp pour passer par le cPanel.');
            return false;
          }
        }
        await pause(5000);
      }
      console.error(`  ✘ ${distant} refusé par le serveur`);
      return false;
    },
    async fin() {
      rmSync(netrc, { force: true });
    },
  };
}

async function main() {
  const prets = paquets.map(preparer);
  if (!envoyer) {
    console.log('\nPréparé seulement. Ajoutez --envoyer pour mettre en production.');
    return;
  }
  const transport = parFtp ? await transportFtp() : await transportCpanel();
  console.log(`\nEnvoi par ${transport.nom} vers ${HOTE}`);
  try {
    let ok = true;
    for (const p of prets) {
      console.log(`Envoi de ${p.nom} ${p.version}…`);
      ok = (await transport.envoyer(path.join(p.dossier, 'index.js'), `dist/node_modules/${p.nom}/index.js`)) && ok;
      ok = ok && (await transport.envoyer(path.join(p.dossier, 'package.json'), `dist/node_modules/${p.nom}/package.json`));
    }
    if (!ok) {
      console.error('\nUn fichier a été refusé : l\'API n\'est PAS redémarrée et garde la version précédente en mémoire.');
      process.exitCode = 1;
      return;
    }
    const restart = path.join(tmpdir(), `vihepat-restart-${process.pid}.txt`);
    writeFileSync(restart, String(Date.now()));
    await transport.envoyer(restart, 'tmp/restart.txt');
    rmSync(restart, { force: true });
    console.log('\nRedémarrage demandé. Vérification dans 10 s…');
    await pause(10000);
    const sante = await fetch(SANTE).then((r) => r.status).catch(() => 0);
    console.log(sante === 200 ? '✔ API en ligne (health 200)' : `⚠ health a répondu ${sante} : vérifiez le journal logs/passenger.log`);
  } finally {
    await transport.fin();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
