import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Pseudonyme d'un membre dans les groupes de soutien : ses initiales + un nom généré, par exemple
 * « A.M. · Baobab 47 ». Il est stable (le même patient garde le même pseudonyme d'un groupe à
 * l'autre) mais ne permet pas de remonter au patient : il est dérivé de son identifiant par un HMAC
 * à clé secrète, que seul le serveur connaît.
 */

const NOMS = [
  'Baobab', 'Iroko', 'Fromager', 'Karité', 'Néré', 'Manguier', 'Palmier', 'Tamarinier', 'Flamboyant', 'Acacia',
  'Colibri', 'Héron', 'Calao', 'Tisserin', 'Pélican', 'Aigrette', 'Martin', 'Tourterelle', 'Pintade', 'Ibis',
  'Lagune', 'Savane', 'Colline', 'Rivière', 'Source', 'Étoile', 'Soleil', 'Horizon', 'Oasis', 'Alizé',
];

function initiale(mot: string | null | undefined) {
  const lettre = (mot ?? '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(lettre) ? `${lettre}.` : '';
}

export function pseudonyme(patientId: number, prenom?: string | null, nom?: string | null) {
  const h = crypto.createHmac('sha256', env.JWT_SECRET).update(`pseudo-groupe:${patientId}`).digest();
  const mot = NOMS[h.readUInt16BE(0) % NOMS.length]!;
  const nombre = 10 + (h.readUInt16BE(2) % 90);
  const ini = `${initiale(prenom)}${initiale(nom)}`;
  return ini ? `${ini} · ${mot} ${nombre}` : `${mot} ${nombre}`;
}
