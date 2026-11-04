/*
 * Service worker VIHEPAT : l'application reste utilisable sans réseau.
 * - Coquille de l'application : réseau d'abord, copie locale en secours.
 * - Données de l'API (lecture seule) : réseau d'abord, dernière copie connue en secours.
 * - Les écritures (POST/PATCH) ne sont jamais mises en cache : elles passent par la
 *   file d'attente de l'application, envoyée au retour du réseau.
 */
const VERSION = 'v5';
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

// Rappel envoyé par le serveur (application fermée, patient connecté ou non)
self.addEventListener('push', (event) => {
  let d = null;
  try {
    d = event.data ? event.data.json() : null;
  } catch (e) {
    d = null;
  }
  if (!d || !d.cle) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      // Application au premier plan : elle affiche déjà l'alerte elle-même
      if (fenetres.some((f) => f.visibilityState === 'visible')) return undefined;
      return self.registration.showNotification(d.titre || 'Rappel', {
        body: d.corps || '',
        // Même étiquette que l'alerte de l'application : jamais deux notifications pour une échéance
        tag: 'rappel-' + d.cle,
        renotify: true,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: { cle: d.cle, id: d.id, jeton: d.jeton, api: d.api, url: d.url },
        // Rappel de rendez-vous (sans jeton) : simple information, sans boutons
        actions: d.jeton
          ? [
              { action: 'fait', title: d.fait || 'OK' },
              { action: 'plus_tard', title: d.plusTard || '…' },
            ]
          : [],
      });
    })
  );
});

// Réponse depuis la notification, sans ouvrir l'application ni demander de session
function repondreAuServeur(data, action) {
  return fetch(data.api + '/push/reponse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: data.id, cle: data.cle, jeton: data.jeton, action }),
  }).catch(() => undefined);
}

// Clic sur un rappel (ou sur ses actions « C'est fait » / « Plus tard »)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const cle = data.cle;
  const action = event.action || '';
  // Message ou rendez-vous (sans boutons) : ouvre la page indiquée par le serveur
  if (data.url && !data.jeton) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
        const f = fenetres[0];
        if (f) return f.navigate(data.url).then((g) => (g || f).focus()).catch(() => f.focus());
        return self.clients.openWindow(data.url);
      })
    );
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const f = fenetres[0];
      // Ancien rappel (sans clé) : on ramène simplement l'application au premier plan
      if (!cle) return f ? f.focus() : self.clients.openWindow('/dashboard');
      if (f) {
        // Application ouverte : elle applique l'action elle-même (stockage local, file hors ligne)
        f.postMessage({ type: 'rappel-action', cle, action: action || 'ouvrir' });
        // L'application peut ne pas connaître l'échéance (autre compte connecté) : le serveur la note aussi
        if (action && data.jeton) return repondreAuServeur(data, action);
        return action ? undefined : f.focus();
      }
      // Rappel du serveur, application fermée : la réponse part directement, sans ouvrir l'application
      if (action && data.jeton) return repondreAuServeur(data, action);
      // Application fermée : on l'ouvre avec l'action à appliquer
      const params = action ? '?occ=' + encodeURIComponent(cle) + '&action=' + encodeURIComponent(action) : '';
      return self.clients.openWindow('/rappels' + params);
    })
  );
});
