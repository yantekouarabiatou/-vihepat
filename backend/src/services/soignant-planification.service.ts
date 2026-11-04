import { Op } from 'sequelize';
import { Affectation, Patient, RendezVous, Soignant, User } from '../models';
import { assertPatientAffecte, getContexte, getPatientIds, httpError } from './soignant-contexte';
import { notifierPatientRdv } from './rappel-rdv.service';

/**
 * Agenda du soignant sur une période et planification de rendez-vous en série
 * (ex. suivi tous les 3 mois sur un an), avec rappel automatique du patient la veille.
 */

const MAX_SERIE = 24;
const PERIODE_MAX_MS = 92 * 24 * 3600_000;

/** Jour civil au Bénin (UTC+1), pour regrouper et repérer les conflits */
const jourBenin = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);

export async function getAgenda(userId: number, du: Date, au: Date) {
  if (au.getTime() <= du.getTime() || au.getTime() - du.getTime() > PERIODE_MAX_MS) throw httpError(400, 'Période invalide');
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return { rendezVous: [], sansRendezVous: [] };

  const [rendezVous, aVenir, patients] = await Promise.all([
    RendezVous.findAll({
      where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.between]: [du, au] } },
      include: [
        { model: Patient, as: 'patient', attributes: ['id', 'codePatient', 'pathologie'], include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] },
      ],
      order: [['dateHeure', 'ASC']],
      limit: 500,
    }),
    RendezVous.findAll({
      where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.gte]: new Date() }, statut: { [Op.in]: ['prevu', 'confirme'] } },
      attributes: ['patientId'],
    }),
    Patient.findAll({
      where: { id: { [Op.in]: patientIds } },
      attributes: ['id', 'codePatient', 'pathologie'],
      include: [{ model: User, as: 'user', attributes: ['nom', 'prenom', 'actif'] }],
    }),
  ]);
  // Aide au suivi : patients actifs sans aucun rendez-vous à venir
  const avecRdv = new Set(aVenir.map((r) => r.patientId));
  const sansRendezVous = patients
    .filter((p) => !avecRdv.has(p.id) && (p as any).user?.actif !== false)
    .map((p) => ({ id: p.id, codePatient: p.codePatient, pathologie: p.pathologie, nom: (p as any).user?.nom, prenom: (p as any).user?.prenom }));
  return { rendezVous, sansRendezVous };
}

function verifierDates(dates: string[]) {
  if (dates.length === 0 || dates.length > MAX_SERIE) throw httpError(400, `Entre 1 et ${MAX_SERIE} rendez-vous`);
  const valeurs = dates.map((d) => new Date(d));
  if (valeurs.some((d) => Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 5 * 60_000)) {
    throw httpError(400, 'Les rendez-vous doivent être dans le futur');
  }
  return valeurs;
}

/** Aperçu d'une série : rendez-vous déjà prévus pour le patient ce jour-là, charge du jour pour l'équipe */
export async function apercuSerie(userId: number, patientId: number, dates: string[]) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);
  const valeurs = verifierDates(dates);
  const patientIds = await getPatientIds(ctx);
  const min = new Date(Math.min(...valeurs.map((d) => d.getTime())) - 86400_000);
  const max = new Date(Math.max(...valeurs.map((d) => d.getTime())) + 86400_000);
  const existants = await RendezVous.findAll({
    where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.between]: [min, max] }, statut: { [Op.ne]: 'annule' } },
    attributes: ['id', 'patientId', 'dateHeure', 'soignantId'],
  });
  return valeurs.map((d) => {
    const jour = jourBenin(d);
    const memeJour = existants.filter((r) => jourBenin(r.dateHeure) === jour);
    return {
      dateHeure: d.toISOString(),
      // Le patient a déjà un rendez-vous ce jour-là
      conflitPatient: memeJour.some((r) => r.patientId === patientId),
      // Un autre rendez-vous de l'équipe à moins de 30 minutes
      creneauOccupe: memeJour.some((r) => r.patientId !== patientId && Math.abs(r.dateHeure.getTime() - d.getTime()) < 30 * 60_000),
      chargeJour: memeJour.length,
    };
  });
}

export async function creerSerie(userId: number, input: { patientId: number; dates: string[]; motif?: string | undefined; rappelAuto: boolean }) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, input.patientId);
  const valeurs = verifierDates(input.dates);
  const soignantId = ctx.soignant
    ? ctx.soignant.id
    : (await Affectation.findOne({ where: { patientId: input.patientId } }))?.soignantId ?? ((await Soignant.findOne())?.id ?? null);
  const crees = await RendezVous.bulkCreate(
    valeurs.map((d) => ({
      patientId: input.patientId,
      soignantId,
      dateHeure: d,
      motif: input.motif ?? null,
      statut: 'prevu' as const,
      rappelAuto: input.rappelAuto,
    }))
  );
  return { crees: crees.length, ids: crees.map((r) => r.id) };
}

/** Rappel envoyé tout de suite par le soignant */
export async function rappelerMaintenant(userId: number, rendezVousId: number) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) throw httpError(404, 'Rendez-vous introuvable');
  const canaux = await notifierPatientRdv(rdv);
  rdv.rappelEnvoyeLe = new Date();
  await rdv.save();
  return { rendezVous: rdv, ...canaux };
}

export async function changerRappelAuto(userId: number, rendezVousId: number, rappelAuto: boolean) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) throw httpError(404, 'Rendez-vous introuvable');
  rdv.rappelAuto = rappelAuto;
  await rdv.save();
  return rdv;
}
