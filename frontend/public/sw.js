/*
 * Service worker VIHEPAT : l'application reste utilisable sans réseau.
 * - Coquille de l'application : réseau d'abord, copie locale en secours.
 * - Données de l'API (lecture seule) : réseau d'abord, dernière copie connue en secours.
 * - Les écritures (POST/PATCH) ne sont jamais mises en cache : elles passent par la
 *   file d'attente de l'application, envoyée au retour du réseau.
 */
const VERSION = 'v1';
const CACHE_APP = `vihepat-app-${VERSION}`;
const CACHE_API = 'vihepat-api';
const COQUILLE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('vihepat-app-') && c !== CACHE_APP).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

async function reseauDabord(requete, nomCache) {
  const cache = await caches.open(nomCache);
  try {
    const reponse = await fetch(requete);
    if (reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  } catch (err) {
    const copie = await cache.match(requete);
    if (copie) return copie;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);

  // API : uniquement les lectures, jamais l'authentification
  if (url.pathname.includes('/api/')) {
    if (url.pathname.includes('/api/auth/')) return;
    event.respondWith(reseauDabord(requete, CACHE_API));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigation : l'application monopage est servie par index.html
  if (requete.mode === 'navigate') {
    event.respondWith(
      fetch(requete).catch(async () => (await caches.match('/index.html')) || (await caches.match('/')))
    );
    return;
  }

  // Scripts, styles, polices, images
  event.respondWith(reseauDabord(requete, CACHE_APP));
});

// Clic sur un rappel : ramène l'application au premier plan
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const f = fenetres[0];
      return f ? f.focus() : self.clients.openWindow('/dashboard');
    })
  );
});
