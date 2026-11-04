import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Op } from 'sequelize';
import { env } from '../config/env';
import { Patient } from '../models';
import { AbonnementPush, ParametreSysteme, RappelServeur } from '../models/RappelServeur';
import * as rappelsService from './rappels.service';
import { clePubliqueVapid, envoyerNotification, genererClesVapid, type ClesVapid } from './web-push';

/**
 * Rappels envoyés par le serveur, pour qu'ils sonnent application fermée et patient déconnecté.
 * Activés par le patient lui-même ; le serveur ne reçoit que l'heure, les jours et le type de
 * chaque rappel (jamais le libellé). La notification garde le titre neutre choisi sur l'appareil.
 */

/** Une échéance n'est plus envoyée au-delà de ce retard (API arrêtée un moment, par exemple) */
const FENETRE_ENVOI_MS = 10 * 60_000;
const REPORT_MS = 10 * 60_000;
const PERIODE_MS = 30_000;

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

// ---------------------------------------------------------------------------
// Clés VAPID : variables d'environnement, sinon générées une fois et gardées en base
// ---------------------------------------------------------------------------

let clesCache: ClesVapid | null = null;

async function clesVapid(): Promise<ClesVapid> {
  if (clesCache) return clesCache;
  const enregistre = await ParametreSysteme.findByPk('vapid');
  if (enregistre) {
    clesCache = JSON.parse(enregistre.valeur) as ClesVapid;
  } else {
    const c = genererClesVapid();
    // Deux processus au démarrage : le premier enregistré l'emporte
    await ParametreSysteme.findOrCreate({ where: { cle: 'vapid' }, defaults: { cle: 'vapid', valeur: JSON.stringify(c) } });
    clesCache = JSON.parse((await ParametreSysteme.findByPk('vapid'))!.valeur) as ClesVapid;
  }
  return clesCache!;
}

export async function getClePublique() {
  return { clePublique: clePubliqueVapid(await clesVapid()) };
}

// ---------------------------------------------------------------------------
// Échéances : même clé que sur l'appareil (`${idRappel}-AAAAMMJJHHMM`, heure locale)
// ---------------------------------------------------------------------------

const deux = (n: number) => String(n).padStart(2, '0');

/** Échéance du jour (heure locale du patient) d'un rappel, ou null si le rappel ne tombe pas ce jour-là */
export function echeanceDuJour(r: Pick<RappelServeur, 'clientId' | 'heure' | 'jours' | 'decalageMin'>, t: number) {
  const local = new Date(t - r.decalageMin * 60_000);
  const jours = r.jours ? r.jours.split(',').map(Number) : [];
  if (jours.length > 0 && !jours.includes(local.getUTCDay())) return null;
  const [h, m] = r.heure.split(':').map(Number);
  const prevu = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h ?? 0, m ?? 0) + r.decalageMin * 60_000;
  const cle = `${r.clientId}-${local.getUTCFullYear()}${deux(local.getUTCMonth() + 1)}${deux(local.getUTCDate())}${r.heure.replace(':', '')}`;
  return { cle, prevu };
}

/** Heure prévue (UTC) d'une clé d'échéance */
function prevuDepuisCle(cle: string, decalageMin: number) {
  const s = cle.slice(-12);
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)) + decalageMin * 60_000);
}

const jeton = (id: number, cle: string) => createHmac('sha256', env.JWT_SECRET).update(`push:${id}:${cle}`).digest('base64url').slice(0, 32);

// ---------------------------------------------------------------------------
// Activation par le patient
// ---------------------------------------------------------------------------

export interface RappelEntree {
  id: string;
  type: 'prise' | 'rdv';
  heure: string;
  jours: number[];
  actif: boolean;
  depuis: string;
}

export interface SynchroEntree {
  abonnement?: { endpoint: string; keys: { p256dh: string; auth: string } } | undefined;
  textes: { titre: string; corps: string; fait: string; plusTard: string };
  apiBase: string;
  decalageMin: number;
  delaiRelanceMin: number;
  rappels: RappelEntree[];
}

/** Enregistre l'abonnement de l'appareil (s'il est fourni) et remplace la copie des rappels */
export async function synchroniser(userId: number, e: SynchroEntree) {
  const textes = JSON.stringify(e.textes);
  if (e.abonnement) {
    const empreinte = createHash('sha256').update(e.abonnement.endpoint).digest('hex');
    const valeurs = { userId, empreinte, endpoint: e.abonnement.endpoint, p256dh: e.abonnement.keys.p256dh, auth: e.abonnement.keys.auth, textes, apiBase: e.apiBase };
    const existant = await AbonnementPush.findOne({ where: { empreinte } });
    // Appareil partagé : l'abonnement passe au compte qui vient de l'activer
    if (existant) await existant.update(valeurs);
    else await AbonnementPush.create(valeurs);
  } else {
    await AbonnementPush.update({ textes, apiBase: e.apiBase }, { where: { userId } });
  }
  if ((await AbonnementPush.count({ where: { userId } })) === 0) throw httpError(409, 'Aucun appareil abonné');

  const actifs = e.rappels.filter((r) => r.actif);
  await RappelServeur.destroy({ where: { userId, clientId: { [Op.notIn]: actifs.length ? actifs.map((r) => r.id) : [''] } } });
  for (const r of actifs) {
    const valeurs = {
      userId,
      clientId: r.id,
      type: r.type,
      heure: r.heure,
      jours: r.jours.join(','),
      decalageMin: e.decalageMin,
      delaiRelanceMin: e.delaiRelanceMin,
      depuis: new Date(r.depuis),
    };
    const existant = await RappelServeur.findOne({ where: { userId, clientId: r.id } });
    if (existant) await existant.update(valeurs);
    else await RappelServeur.create(valeurs);
  }
  return { actif: true, rappels: actifs.length };
}

/** Désactive l'envoi pour cet appareil ; sans appareil restant, la copie des rappels est effacée */
export async function desactiver(userId: number, endpoint?: string) {
  if (endpoint) {
    await AbonnementPush.destroy({ where: { userId, empreinte: createHash('sha256').update(endpoint).digest('hex') } });
  } else {
    await AbonnementPush.destroy({ where: { userId } });
  }
  if ((await AbonnementPush.count({ where: { userId } })) === 0) await RappelServeur.destroy({ where: { userId } });
  return { actif: false };
}

/** Réponses données depuis les notifications, pour que l'appareil mette son historique à jour */
export async function reponsesRecentes(userId: number) {
  const rappels = await RappelServeur.findAll({ where: { userId, reponseCle: { [Op.ne]: null } }, attributes: ['reponseCle'] });
  return { cles: rappels.map((r) => r.reponseCle!) };
}

/** « C'est fait » dans l'application : plus de relance pour cette échéance */
export async function noterReponse(userId: number, cle: string) {
  const clientId = cle.slice(0, -13);
  await RappelServeur.update({ reponseCle: cle }, { where: { userId, clientId } });
}

/** Action choisie sur la notification, application fermée (sans session : jeton signé par échéance) */
export async function reponseDepuisNotification(e: { id: number; cle: string; jeton: string; action: 'fait' | 'plus_tard' }) {
  const r = await RappelServeur.findByPk(e.id);
  const attendu = Buffer.from(jeton(e.id, e.cle));
  const recu = Buffer.from(e.jeton);
  if (!r || attendu.length !== recu.length || !timingSafeEqual(attendu, recu) || !e.cle.startsWith(`${r.clientId}-`)) {
    throw httpError(403, 'Jeton invalide');
  }
  if (e.action === 'plus_tard') {
    await r.update({ reportCle: e.cle, reportA: new Date(Date.now() + REPORT_MS) });
    return { ok: true };
  }
  await r.update({ reponseCle: e.cle, reportCle: null, reportA: null });
  // Partagée avec l'équipe soignante seulement si le patient l'a accepté (règle habituelle)
  const patient = await Patient.findOne({ where: { userId: r.userId }, attributes: ['id'] });
  if (patient) {
    await rappelsService
      .enregistrerConfirmation(patient.id, {
        clientId: e.cle,
        type: r.type,
        statut: 'confirmee',
        prevuLe: prevuDepuisCle(e.cle, r.decalageMin).toISOString(),
        reponduLe: new Date().toISOString(),
      })
      .catch(() => undefined);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Planificateur
// ---------------------------------------------------------------------------

/** Réserve un envoi (plusieurs processus de l'API possibles) : vrai si ce processus doit envoyer */
async function reserver(id: number, colonne: 'envoiCle' | 'relanceCle', cle: string, extra: object = {}) {
  const [n] = await RappelServeur.update(
    { [colonne]: cle, ...extra },
    { where: { id, [Op.or]: [{ [colonne]: null }, { [colonne]: { [Op.ne]: cle } }] } }
  );
  return n === 1;
}

async function envoyer(r: RappelServeur, cle: string, relance: boolean) {
  const [abonnements, c] = await Promise.all([AbonnementPush.findAll({ where: { userId: r.userId } }), clesVapid()]);
  for (const ab of abonnements) {
    const textes = JSON.parse(ab.textes) as SynchroEntree['textes'];
    try {
      const statut = await envoyerNotification(
        ab,
        { ...textes, cle, id: r.id, jeton: jeton(r.id, cle), api: ab.apiBase, relance },
        c,
        `mailto:${env.MAIL_FROM_ADDRESS}`
      );
      if (statut === 404 || statut === 410) await ab.destroy();
      else if (statut >= 400) console.warn(`Rappel serveur : envoi refusé (${statut})`);
    } catch (err) {
      console.warn('Rappel serveur : envoi impossible :', (err as Error).message);
    }
  }
}

export async function tic(t = Date.now()) {
  const rappels = await RappelServeur.findAll();
  for (const r of rappels) {
    const e = echeanceDuJour(r, t);
    if (e && t >= e.prevu && t - e.prevu < FENETRE_ENVOI_MS && e.prevu >= r.depuis.getTime() && r.envoiCle !== e.cle) {
      if (await reserver(r.id, 'envoiCle', e.cle, { envoiLe: new Date(e.prevu) })) await envoyer(r, e.cle, false);
      continue;
    }
    // Une seule relance, si le patient n'a pas répondu
    if (r.envoiCle && r.envoiLe && r.reponseCle !== r.envoiCle && r.relanceCle !== r.envoiCle) {
      const aRelancer = r.envoiLe.getTime() + r.delaiRelanceMin * 60_000;
      if (t >= aRelancer && t - aRelancer < FENETRE_ENVOI_MS && (await reserver(r.id, 'relanceCle', r.envoiCle))) {
        await envoyer(r, r.envoiCle, true);
        continue;
      }
    }
    // « Plus tard » choisi depuis la notification
    if (r.reportCle && r.reportA && t >= r.reportA.getTime() && r.reponseCle !== r.reportCle) {
      const cle = r.reportCle;
      const [n] = await RappelServeur.update({ reportCle: null, reportA: null }, { where: { id: r.id, reportCle: cle } });
      if (n === 1) await envoyer(r, cle, true);
    }
  }
}

export function demarrerPlanificateur() {
  let enCours = false;
  const tourner = async () => {
    if (enCours) return;
    enCours = true;
    try {
      await tic();
    } catch (err) {
      console.error('❌ Rappels serveur :', (err as Error).message);
    } finally {
      enCours = false;
    }
  };
  void clesVapid().catch((err) => console.error('❌ Clés VAPID :', (err as Error).message));
  setInterval(() => void tourner(), PERIODE_MS).unref();
}
