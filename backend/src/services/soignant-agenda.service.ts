import { Op } from 'sequelize';
import { Soignant, Patient, User, Affectation, RendezVous, Signalement, Communique } from '../models';
import { httpError, getContexte, avertirPatient, getPatientIds, assertPatientAffecte } from './soignant-contexte';

/** Rendez-vous, communiqués et signalements. */

export async function getRendezVous(userId: number) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return [];

  return RendezVous.findAll({
    where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.gte]: new Date() } },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['dateHeure', 'ASC']],
    limit: 20,
  });
}

export async function createRendezVous(
  userId: number,
  input: { patientId: number; dateHeure: string; motif?: string }
) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, input.patientId);
  const soignantId = ctx.soignant
    ? ctx.soignant.id
    : (await Affectation.findOne({ where: { patientId: input.patientId } }))?.soignantId ??
      ((await Soignant.findOne())?.id ?? 1);

  return RendezVous.create({
    patientId: input.patientId,
    soignantId,
    dateHeure: new Date(input.dateHeure),
    motif: input.motif ?? null,
    statut: 'prevu',
  });
}

export async function envoyerRappelRdv(userId: number, rendezVousId: number) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);

  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) {
    const e: any = new Error('Rendez-vous introuvable');
    e.status = 404;
    throw e;
  }
  rdv.rappelEnvoyeLe = new Date();
  await rdv.save();
  return rdv;
}

export async function updateRendezVous(
  userId: number,
  rendezVousId: number,
  input: { statut?: string; notes?: string }
) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);

  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) {
    const e: any = new Error('Rendez-vous introuvable');
    e.status = 404;
    throw e;
  }

  if (input.statut) rdv.statut = input.statut as any;
  if (input.notes !== undefined) rdv.notes = input.notes;
  if (ctx.soignant) rdv.soignantId = ctx.soignant.id;
  await rdv.save();
  return rdv;
}

export async function getCommuniques(userId: number) {
  const ctx = await getContexte(userId);
  return Communique.findAll({
    where: ctx.admin ? {} : (ctx.soignant ? { soignantId: ctx.soignant.id } : {}),
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
}

export async function createCommunique(
  userId: number,
  input: { titre: string; contenu: string; cible: 'tous' | 'patient'; patientId?: number }
) {
  const ctx = await getContexte(userId);
  if (input.cible === 'patient') {
    if (!input.patientId) throw httpError(400, 'Patient requis pour un communiqué ciblé');
    await assertPatientAffecte(ctx, input.patientId);
  }
  const defaultSoignantId = ctx.soignant?.id ?? (await Soignant.findOne())?.id ?? 1;
  const communique = await Communique.create({
    soignantId: defaultSoignantId,
    titre: input.titre,
    contenu: input.contenu,
    cible: input.cible,
    patientId: input.cible === 'patient' ? input.patientId : null,
  });
  if (input.cible === 'patient' && input.patientId) void avertirPatient(input.patientId);
  return communique;
}

export async function getSignalements(userId: number, statut?: string) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return [];

  // `tous` = historique complet (page Signalements) ; sans filtre = ceux qui restent à traiter
  return Signalement.findAll({
    where: {
      patientId: { [Op.in]: patientIds },
      ...(statut === 'tous' ? {} : { statut: statut ? statut : { [Op.ne]: 'traite' } }),
    },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['createdAt', 'DESC']],
    ...(statut === 'tous' ? { limit: 1000 } : {}),
  });
}

export async function updateSignalement(userId: number, signalementId: number, statut: 'vu' | 'traite') {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);

  const signalement = await Signalement.findByPk(signalementId);
  if (!signalement || !patientIds.includes(signalement.patientId)) {
    const e: any = new Error('Signalement introuvable');
    e.status = 404;
    throw e;
  }

  signalement.statut = statut;
  await signalement.save();
  return signalement;
}
