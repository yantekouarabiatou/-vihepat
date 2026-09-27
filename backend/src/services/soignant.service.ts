import { Op } from 'sequelize';
import { Soignant, Patient, User, Affectation, RendezVous, Signalement } from '../models';

async function getSoignantOrThrow(userId: number) {
  const soignant = await Soignant.findOne({ where: { userId } });
  if (!soignant) {
    const e: any = new Error('Profil soignant introuvable');
    e.status = 404;
    throw e;
  }
  return soignant;
}

async function getPatientIds(soignantId: number) {
  const affectations = await Affectation.findAll({ where: { soignantId } });
  return affectations.map((a) => a.patientId);
}

export async function getPatients(userId: number, search?: string) {
  const soignant = await getSoignantOrThrow(userId);
  const patientIds = await getPatientIds(soignant.id);
  if (patientIds.length === 0) return [];

  return Patient.findAll({
    where: { id: { [Op.in]: patientIds } },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'nom', 'prenom', 'email'],
        where: search
          ? {
              [Op.or]: [
                { nom: { [Op.like]: `%${search}%` } },
                { prenom: { [Op.like]: `%${search}%` } },
              ],
            }
          : undefined,
      },
    ],
    order: [['createdAt', 'DESC']],
  });
}

export async function getRendezVous(userId: number) {
  const soignant = await getSoignantOrThrow(userId);
  const patientIds = await getPatientIds(soignant.id);
  if (patientIds.length === 0) return [];

  return RendezVous.findAll({
    where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.gte]: new Date() } },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['dateHeure', 'ASC']],
    limit: 20,
  });
}

export async function updateRendezVous(
  userId: number,
  rendezVousId: number,
  input: { statut?: string; notes?: string }
) {
  const soignant = await getSoignantOrThrow(userId);
  const patientIds = await getPatientIds(soignant.id);

  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) {
    const e: any = new Error('Rendez-vous introuvable');
    e.status = 404;
    throw e;
  }

  if (input.statut) rdv.statut = input.statut as any;
  if (input.notes !== undefined) rdv.notes = input.notes;
  rdv.soignantId = soignant.id;
  await rdv.save();
  return rdv;
}

export async function getSignalements(userId: number, statut?: string) {
  const soignant = await getSoignantOrThrow(userId);
  const patientIds = await getPatientIds(soignant.id);
  if (patientIds.length === 0) return [];

  return Signalement.findAll({
    where: {
      patientId: { [Op.in]: patientIds },
      statut: statut ? statut : { [Op.ne]: 'traite' },
    },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['createdAt', 'DESC']],
  });
}

export async function updateSignalement(userId: number, signalementId: number, statut: 'vu' | 'traite') {
  const soignant = await getSoignantOrThrow(userId);
  const patientIds = await getPatientIds(soignant.id);

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
