#!/usr/bin/env node
/**
 * Déploie l'API et/ou le site en production par l'interface du cPanel (HTTPS, port 2083), sans FTP.
 *
 *   node scripts/deployer.mjs api            # backend/dist  -> ~/vihepat-api/dist, puis redémarrage
 *   node scripts/deployer.mjs site           # frontend/dist -> ~/public_html/vihepat/public
 *   node scripts/deployer.mjs api site       # les deux
 *   ajouter --simulation pour seulement lister ce qui serait envoyé
 *
 * Construire avant : `npm run build` (backend) et `VITE_API_URL=https://vihepat.secourseducatif.com/api npx vite build` (frontend).
 * Identifiants : CPANEL_USER + CPANEL_TOKEN (jeton d'API, cPanel > Sécurité > Gérer les jetons d'API),
 * sinon le programme les demande. Rien n'est enregistré.
 *
 * Sécurité du déploiement :
 * - on compare le CONTENU de chaque fichier (pas seulement la taille) ; un fichier du serveur égal au fichier
 *   local suivi d'un commentaire « // vihepat build … » (ajouté pour passer l'antivirus) compte comme identique ;
 * - chaque fichier remplacé est sauvegardé dans deploiement-AAAA-MM-JJ/<cible>-ancien/ ;
 * - si l'antivirus de l'hébergeur refuse un fichier (il reste vide), l'ancienne version est remise aussitôt et
 *   l'API n'est PAS redémarrée : elle garde en mémoire la version précédente ;
 * - le site envoie index.html en dernier, après les fichiers qu'il référence.
 */
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOTE = process.env.HOTE_SERVEUR ?? 'web64.lws-hosting.com';
const SANTE = 'https://vihepat.secourseducatif.com/api/health';
const args = process.argv.slice(2);
const simulation = args.includes('--simulation');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const jour = new Date().toISOString().slice(0, 10);

const CIBLES = {
  api: {
    local: path.join(RACINE, 'backend/dist'),
    distant: 'vihepat-api/dist',
    // Seuls les fichiers chargés par Node ; seed.js n'a rien à faire en production
    garder: (rel) => /\.(js|json)$/.test(rel) && rel !== 'seed.js' && !rel.startsWith('node_modules/'),
    dernier: [],
  },
  site: {
    local: path.join(RACINE, 'frontend/dist'),
    distant: 'public_html/vihepat/public',
    garder: () => true,
    dernier: ['index.html'],
  },
};

const cibles = args.filter((a) => !a.startsWith('--'));
if (cibles.length === 0 || cibles.some((c) => !CIBLES[c])) {
  console.error('Usage : node scripts/deployer.mjs api|site [api|site] [--simulation]');
  process.exit(1);
}

function lister(dossier, base = dossier) {
  return readdirSync(dossier).flatMap((n) => {
    const p = path.join(dossier, n);
    return statSync(p).isDirectory() ? lister(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

async function connexion() {
  let user = process.env.CPANEL_USER;
  let token = process.env.CPANEL_TOKEN;
  if (!user || !token) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    user = user ?? (await rl.question('Utilisateur cPanel : ')).trim();
    token = token ?? (await rl.question('Jeton d\'API cPanel : ')).trim();
    rl.close();
  }
  const base = `https://${HOTE}:2083`;
  const home = `/home/${user}`;
  async function appel(url, init = {}) {
    const rep = await fetch(url, { ...init, headers: { Authorization: `cpanel ${user}:${token}`, ...(init.headers ?? {}) } });
    // Un identifiant refusé répété peut faire bloquer l'adresse : arrêt net
    if (rep.status === 401 || rep.status === 403) throw new Error(`Accès refusé par le cPanel (${rep.status}) : vérifiez l'utilisateur et le jeton.`);
    const texte = await rep.text();
    try { return JSON.parse(texte); } catch { throw new Error(`Réponse inattendue du cPanel (${rep.status}) : ${texte.slice(0, 200)}`); }
  }
  const q = (o) => new URLSearchParams(o).toString();
  return {
    home,
    async contenu(dossier, nom) {
      const r = await appel(`${base}/execute/Fileman/get_file_content?${q({ dir: dossier, file: nom })}`);
      return r.status === 1 ? (r.data?.content ?? '') : null;
    },
    async taille(dossier, nom) {
      const r = await appel(`${base}/execute/Fileman/list_files?${q({ dir: dossier, include_mime: '0' })}`);
      const f = (r.data ?? []).find((x) => x.file === nom);
      return f ? Number(f.size) : -1;
    },
    async existe(dossier, nom) {
      return (await this.taille(dossier, nom)) >= 0;
    },
    async creerDossiers(absolu) {
      const morceaux = absolu.slice(home.length).split('/').filter(Boolean);
      let courant = home;
      for (const m of morceaux) {
        await appel(`${base}/json-api/cpanel?${q({ cpanel_jsonapi_user: user, cpanel_jsonapi_apiversion: '2', cpanel_jsonapi_module: 'Fileman', cpanel_jsonapi_func: 'mkdir', path: courant, name: m })}`);
        courant = `${courant}/${m}`;
      }
    },
    async envoyer(dossier, nom, octets) {
      const form = new FormData();
      form.append('dir', dossier);
      form.append('overwrite', '1');
      form.append('file-1', new Blob([octets]), nom);
      const r = await appel(`${base}/execute/Fileman/upload_files`, { method: 'POST', body: form });
      return r.status === 1 && (await this.taille(dossier, nom)) === octets.length;
    },
  };
}

// L'API du cPanel réécrit ce qui ressemble à du HTML (balise <meta charset> déplacée, casse changée) :
// on compare sans ces balises ni les blancs. Seuls les modèles d'e-mail en contiennent.
const normaliser = (t) => t.replace(/<meta charset=[^>]*>/gi, '').replace(/\s+/g, ' ');
const identique = (distant, local) => {
  if (distant === null) return false;
  if (distant === local || normaliser(distant) === normaliser(local)) return true;
  // Variante envoyée avec un commentaire final pour passer l'antivirus
  return distant.startsWith(local) && /^\s*\/\/ (vihepat build|r\d)[^\n]*\s*$/.test(distant.slice(local.length));
};

async function deployer(srv, nomCible) {
  const c = CIBLES[nomCible];
  const fichiers = lister(c.local).filter(c.garder);
  const binaire = (rel) => !/\.(js|json|html|css|txt|webmanifest|svg|map|mjs)$/.test(rel);
  const aEnvoyer = [];
  console.log(`\n== ${nomCible} : ${fichiers.length} fichiers locaux, comparaison avec le serveur…`);
  for (const rel of fichiers) {
    const local = readFileSync(path.join(c.local, rel));
    const dossier = path.posix.join(srv.home, c.distant, path.posix.dirname(rel)).replace(/\/\.$/, '');
    const nom = path.posix.basename(rel);
    if (binaire(rel) || /^assets\/.*-[A-Za-z0-9_-]{8}\./.test(rel)) {
      // Images, polices, fichiers au nom haché : présents avec la bonne taille = identiques
      if ((await srv.taille(dossier, nom)) === local.length) continue;
      aEnvoyer.push({ rel, dossier, nom, local, ancien: null });
      continue;
    }
    const distant = await srv.contenu(dossier, nom);
    if (identique(distant, local.toString('utf8'))) continue;
    aEnvoyer.push({ rel, dossier, nom, local, ancien: distant });
  }
  aEnvoyer.sort((a, b) => Number(c.dernier.includes(a.rel)) - Number(c.dernier.includes(b.rel)));
  if (aEnvoyer.length === 0) {
    console.log('  rien à envoyer : le serveur est à jour');
    return { envoyes: 0, ok: true };
  }
  for (const f of aEnvoyer) console.log(`  ${f.ancien === null ? '+' : '~'} ${f.rel}`);
  if (simulation) return { envoyes: 0, ok: true };

  const sauvegarde = path.join(RACINE, `deploiement-${jour}`, `${nomCible}-ancien`);
  for (const f of aEnvoyer) {
    if (f.ancien === null) continue;
    const cible = path.join(sauvegarde, f.rel);
    mkdirSync(path.dirname(cible), { recursive: true });
    writeFileSync(cible, f.ancien);
  }

  for (const f of aEnvoyer) {
    await srv.creerDossiers(f.dossier);
    let ok = false;
    for (let essai = 1; essai <= 4 && !ok; essai++) {
      let octets = f.local;
      if (essai > 1 && /\.js$/.test(f.rel)) octets = Buffer.concat([f.local, Buffer.from(`\n// vihepat build ${jour}-${essai}-${createHash('sha1').update(String(Math.random())).digest('hex').slice(0, 6)}\n`)]);
      ok = await srv.envoyer(f.dossier, f.nom, octets);
      if (!ok) await pause(5000);
    }
    if (ok) {
      console.log(`  ✔ ${f.rel}`);
      continue;
    }
    // Une image ou une police refusée n'empêche pas le site de fonctionner : on signale et on continue
    if (binaire(f.rel)) {
      console.error(`  ⚠ ${f.rel} refusé par le serveur (antivirus ?) : fichier non indispensable, on continue`);
      continue;
    }
    console.error(`  ✘ ${f.rel} refusé par le serveur (antivirus ?)`);
    if (f.ancien !== null) {
      const remis = await srv.envoyer(f.dossier, f.nom, Buffer.from(f.ancien, 'utf8'));
      console.error(remis ? '    ancienne version remise en place' : '    ⚠ ANCIENNE VERSION NON REMISE : ne redémarrez pas l\'API, prévenez le développeur');
    }
    return { envoyes: aEnvoyer.indexOf(f), ok: false };
  }
  return { envoyes: aEnvoyer.length, ok: true };
}

async function main() {
  const srv = await connexion();
  let apiChangee = false;
  for (const c of cibles) {
    const r = await deployer(srv, c);
    if (!r.ok) {
      console.error(`\nDéploiement « ${c} » interrompu. ${c === 'api' ? 'L\'API n\'est PAS redémarrée et garde la version précédente en mémoire.' : ''}`);
      process.exitCode = 1;
      return;
    }
    if (c === 'api' && r.envoyes > 0) apiChangee = true;
  }
  if (simulation) {
    console.log('\nSimulation : rien n\'a été envoyé.');
    return;
  }
  if (apiChangee) {
    const tmp = `${srv.home}/vihepat-api/tmp`;
    await srv.creerDossiers(tmp);
    await srv.envoyer(tmp, 'restart.txt', Buffer.from(String(Date.now())));
    console.log('\nRedémarrage de l\'API demandé, vérification dans 10 s…');
    await pause(10000);
  }
  const sante = await fetch(SANTE).then((r) => r.status).catch(() => 0);
  console.log(sante === 200 ? '✔ API en ligne (health 200)' : `⚠ health a répondu ${sante} : vérifiez le journal logs/passenger.log`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
