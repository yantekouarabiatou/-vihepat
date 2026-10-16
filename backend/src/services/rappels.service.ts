import { Op } from 'sequelize';
import { ConfirmationRappel, Patient } from '../models';
import type { StatutConfirmation, TypeRappel } from '../models/ConfirmationRappel';

/**
 * Rappels discrets du patient.
 * Les rappels eux-mêmes (libellé, heure, jours, sonnerie) restent sur l'appareil du patient :
 * le serveur ne reçoit que les réponses (« C'est fait » / non confirmé), et seulement si le
 * patient accepte de les partager avec son équipe soignante.
 */

/** Au-delà de ce nombre de rappels de prise non confirmés d'affilée, le dossier est signalé « à regarder ». */
export const SEUIL_SERIE_NON_CONFIRMEES = 3;

/** Fenêtre acceptée pour une confirmation synchronisée en retard (hors ligne prolongé). */
const ANCIENNETE_MAX_MS = 14 * 24 * 60 * 60 * 1000;

function httpError(status: number, message: string, code?: string) {
  const e: any = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

export interface ConfirmationEntree {
  clientId: string;
  type: TypeRappel;
  statut: StatutConfirmation;
  prevuLe: string;
  reponduLe?: string | null | undefined;
  reports?: number | undefined;
}

export async function getPartage(patientId: number) {
  const patient = await Patient.findByPk(patientId, { attributes: ['id', 'partageConfirmations'] });
  return { partageConfirmations: patient?.partageConfirmations !== false };
}

/**
 * Coupe ou rétablit le partage. Le couper efface aussi les confirmations déjà transmises :
 * le patient retire alors réellement ces données à l'équipe soignante.
 */
export async function setPartage(patientId: number, partage: boolean) {
  await Patient.update({ partageConfirmations: partage }, { where: { id: patientId } });
  if (!partage) await ConfirmationRappel.destroy({ where: { patientId } });
  return { partageConfirmations: partage };
}

/** Enregistre (ou met à jour, même `clientId`) une réponse à un rappel. Idempotent. */
export async function enregistrerConfirmation(patientId: number, entree: ConfirmationEntree) {
  const { partageConfirmations } = await getPartage(patientId);
  // Partage coupé : on n'enregistre rien côté serveur (l'appareil garde son propre historique)
  if (!partageConfirmations) return { enregistre: false };

  const prevuLe = new Date(entree.prevuLe);
  if (Number.isNaN(prevuLe.getTime())) throw httpError(400, 'Date invalide', 'INVALID_DATE');
  if (prevuLe.getTime() > Date.now() + 24 * 60 * 60 * 1000 || Date.now() - prevuLe.getTime() > ANCIENNETE_MAX_MS) {
    throw httpError(400, 'Date hors de la période acceptée', 'INVALID_DATE');
  }

  const existant = await ConfirmationRappel.findOne({ where: { clientId: entree.clientId } });
  if (existant && existant.patientId !== patientId) throw httpError(409, 'Conflit', 'CONFLICT');

  const valeurs = {
    patientId,
    clientId: entree.clientId,
    type: entree.type,
    statut: entree.statut,
    prevuLe,
    reponduLe: entree.reponduLe ? new Date(entree.reponduLe) : null,
    reports: Math.max(0, Math.min(entree.reports ?? 0, 20)),
  };
  if (existant) {
    // « C'est fait » l'emporte sur un « non confirmé » envoyé plus tôt
    if (existant.statut === 'confirmee' && valeurs.statut === 'non_confirmee') return { enregistre: true };
    await existant.update(valeurs);
  } else {
    await ConfirmationRappel.create(valeurs);
  }
  return { enregistre: true };
}

export interface EtatRappels {
  partage: boolean;
  periodeJours: number;
  prises: { confirmees: number; nonConfirmees: number };
  rendezVous: { confirmees: number; nonConfirmees: number };
  /** Rappels de prise non confirmés d'affilée (les plus récents) */
  serieNonConfirmees: number;
  /** Indicateur d'aide à la priorisation : ne déclenche aucune action automatique */
  aRegarder: boolean;
}

/**
 * Vue soignant : uniquement des compteurs agrégés sur la période, jamais le libellé,
 * l'heure ou les réglages personnels du rappel.
 */
export async function getEtatAgrege(patientId: number, periodeJours = 30): Promise<EtatRappels> {
  const { partageConfirmations } = await getPartage(patientId);
  const vide = { confirmees: 0, nonConfirmees: 0 };
  if (!partageConfirmations) {
    return { partage: false, periodeJours, prises: vide, rendezVous: vide, serieNonConfirmees: 0, aRegarder: false };
  }

  const depuis = new Date(Date.now() - periodeJours * 24 * 60 * 60 * 1000);
  const lignes = await ConfirmationRappel.findAll({
    where: { patientId, prevuLe: { [Op.gte]: depuis } },
    attributes: ['type', 'statut', 'prevuLe'],
    order: [['prevuLe', 'DESC']],
  });

  const compter = (type: TypeRappel) => ({
    confirmees: lignes.filter((l) => l.type === type && l.statut === 'confirmee').length,
    nonConfirmees: lignes.filter((l) => l.type === type && l.statut === 'non_confirmee').length,
  });

  let serie = 0;
  for (const l of lignes.filter((x) => x.type === 'prise')) {
    if (l.statut !== 'non_confirmee') break;
    serie++;
  }

  return {
    partage: true,
    periodeJours,
    prises: compter('prise'),
    rendezVous: compter('rdv'),
    serieNonConfirmees: serie,
    aRegarder: serie >= SEUIL_SERIE_NON_CONFIRMEES,
  };
}
