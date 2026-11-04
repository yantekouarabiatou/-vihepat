import { createECDH, createCipheriv, createHmac, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

/**
 * Envoi de notifications « Web Push » (RFC 8030), sans librairie externe : chiffrement du contenu
 * aes128gcm (RFC 8291) et identification du serveur par VAPID (RFC 8292), avec node:crypto.
 * Évite d'embarquer une dépendance de plus en production (pas d'npm install sur l'hébergement).
 */

export interface ClesVapid {
  /** Clé privée et publique au format JWK (EC P-256) */
  d: string;
  x: string;
  y: string;
}

export interface AbonnementWebPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const b64url = (b: Buffer) => b.toString('base64url');
const depuisB64url = (s: string) => Buffer.from(s, 'base64url');

export function genererClesVapid(): ClesVapid {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  return { d: jwk.d!, x: jwk.x!, y: jwk.y! };
}

/** Clé publique « brute » (65 octets, base64url), celle que le navigateur attend */
export function clePubliqueVapid(c: ClesVapid) {
  return b64url(Buffer.concat([Buffer.from([4]), depuisB64url(c.x), depuisB64url(c.y)]));
}

function jetonVapid(endpoint: string, c: ClesVapid, contact: string) {
  const entete = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = b64url(
    Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact }))
  );
  const cle = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', ...c }, format: 'jwk' });
  const signature = sign('sha256', Buffer.from(`${entete}.${corps}`), { key: cle, dsaEncoding: 'ieee-p1363' });
  return `${entete}.${corps}.${b64url(signature)}`;
}

const hmac = (cle: Buffer, donnees: Buffer) => createHmac('sha256', cle).update(donnees).digest();

/** Chiffre le contenu pour un abonnement (aes128gcm, un seul enregistrement) */
export function chiffrer(contenu: Buffer, ab: AbonnementWebPush, sel = randomBytes(16)) {
  const clientPublique = depuisB64url(ab.p256dh);
  const authentification = depuisB64url(ab.auth);
  const ecdh = createECDH('prime256v1');
  const serveurPublique = ecdh.generateKeys();
  const secret = ecdh.computeSecret(clientPublique);

  const prkCle = hmac(authentification, secret);
  const infoCle = Buffer.concat([Buffer.from('WebPush: info\0'), clientPublique, serveurPublique, Buffer.from([1])]);
  const ikm = hmac(prkCle, infoCle);
  const prk = hmac(sel, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);

  const chiffreur = createCipheriv('aes-128-gcm', cek, nonce);
  // 0x02 : délimiteur du dernier (et seul) enregistrement
  const chiffre = Buffer.concat([chiffreur.update(Buffer.concat([contenu, Buffer.from([2])])), chiffreur.final(), chiffreur.getAuthTag()]);
  const taille = Buffer.alloc(4);
  taille.writeUInt32BE(4096);
  return Buffer.concat([sel, taille, Buffer.from([serveurPublique.length]), serveurPublique, chiffre]);
}

/**
 * Envoie une notification. Renvoie le code HTTP du service de notification du navigateur :
 * 201 = acceptée ; 404 / 410 = abonnement expiré (à supprimer).
 */
export async function envoyerNotification(ab: AbonnementWebPush, contenu: object, c: ClesVapid, contact: string, ttlSecondes = 3600) {
  const corps = chiffrer(Buffer.from(JSON.stringify(contenu)), ab);
  const reponse = await fetch(ab.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSecondes),
      Urgency: 'high',
      Authorization: `vapid t=${jetonVapid(ab.endpoint, c, contact)}, k=${clePubliqueVapid(c)}`,
    },
    body: corps,
    signal: AbortSignal.timeout(15000),
  });
  return reponse.status;
}
