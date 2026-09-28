import { Op } from 'sequelize';
import {
  Soignant, Patient, User, Affectation, RendezVous, Signalement, Observation, Traitement,
} from '../models';
import type { TypeObservation } from '../models/Observation';
import { getAlertesExamens, getResumeObservance } from './observance.service';

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

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

/** Vérifie que le patient est bien affecté à ce soignant (séparation des rôles). */
async function assertPatientAffecte(soignantId: number, patientId: number) {
  const affectation = await Affectation.findOne({ where: { soignantId, patientId } });
  if (!affectation) throw httpError(404, 'Patient introuvable ou non affecté');
  return affectation;
}

export async function rattacherPatient(userId: number, codePatient: string) {
  const soignant = await getSoignantOrThrow(userId);
  const patient = await Patient.findOne({
    where: { codePatient: codePatient.trim().toUpperCase() },
    include: [{ model: User, as: 'user', attributes: ['id', 'nom', 'prenom', 'email'] }],
  });
  if (!patient) throw httpError(404, 'Aucun patient avec ce code');

  const dejaSuivi = await Affectation.count({ where: { patientId: patient.id } });
  const [, created] = await Affectation.findOrCreate({
    where: { patientId: patient.id, soignantId: soignant.id },
    defaults: { patientId: patient.id, soignantId: soignant.id, principal: dejaSuivi === 0 },
  });
  if (!created) throw httpError(409, 'Ce patient est déjà dans votre file active');
  return patient;
}

export async function getPatientDetail(userId: number, patientId: number) {
  const soignant = await getSoignantOrThrow(userId);
  await assertPatientAffecte(soignant.id, patientId);

  const patient = await Patient.findByPk(patientId, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'nom', 'prenom', 'email'] },
      { model: Traitement, as: 'traitements', separate: true, order: [['actif', 'DESC'], ['dateDebut', 'DESC']] },
      {
        model: Observation,
        as: 'observations',
        separate: true,
        order: [['datePrelevement', 'DESC']],
        include: [{
          model: Soignant, as: 'soignant', attributes: ['id', 'structure'],
          include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
        }],
      },
      { model: Signalement, as: 'signalements', separate: true, order: [['createdAt', 'DESC']], limit: 20 },
      { model: RendezVous, as: 'rendezVous', separate: true, order: [['dateHeure', 'DESC']], limit: 20 },
    ],
  });
  if (!patient) throw httpError(404, 'Patient introuvable');

  const [observance, alertesExamens] = await Promise.all([
    getResumeObservance(patient.id),
    getAlertesExamens(patient.id, patient.pathologie),
  ]);
  return { ...patient.toJSON(), observance, alertesExamens };
}


export async function createObservation(
  userId: number,
  patientId: number,
  input: {
    type: TypeObservation;
    valeur: number;
    unite: string;
    datePrelevement: string;
    commentaire?: string;
  }
) {
  const soignant = await getSoignantOrThrow(userId);
  await assertPatientAffecte(soignant.id, patientId);
  return Observation.create({
    patientId,
    soignantId: soignant.id,
    type: input.type,
    valeur: input.valeur,
    unite: input.unite,
    datePrelevement: new Date(input.datePrelevement),
    commentaire: input.commentaire ?? null,
  });
}

export async function createTraitement(
  userId: number,
  patientId: number,
  input: {
    molecule: string;
    dosage?: string;
    frequence: string;
    heurePrise?: string;
    dateDebut: string;
    dateFin?: string;
    notes?: string;
  }
) {
  const soignant = await getSoignantOrThrow(userId);
  await assertPatientAffecte(soignant.id, patientId);
  return Traitement.create({
    patientId,
    molecule: input.molecule,
    dosage: input.dosage ?? null,
    frequence: input.frequence,
    heurePrise: input.heurePrise ?? null,
    dateDebut: new Date(input.dateDebut),
    dateFin: input.dateFin ? new Date(input.dateFin) : null,
    actif: true,
    notes: input.notes ?? null,
  });
}

export async function updateTraitement(
  userId: number,
  traitementId: number,
  input: {
    molecule?: string;
    dosage?: string | null;
    frequence?: string;
    heurePrise?: string | null;
    dateFin?: string | null;
    actif?: boolean;
    notes?: string | null;
  }
) {
  const soignant = await getSoignantOrThrow(userId);
  const traitement = await Traitement.findByPk(traitementId);
  if (!traitement) throw httpError(404, 'Traitement introuvable');
  await assertPatientAffecte(soignant.id, traitement.patientId);

  if (input.molecule !== undefined) traitement.molecule = input.molecule;
  if (input.dosage !== undefined) traitement.dosage = input.dosage;
  if (input.frequence !== undefined) traitement.frequence = input.frequence;
  if (input.heurePrise !== undefined) traitement.heurePrise = input.heurePrise;
  if (input.notes !== undefined) traitement.notes = input.notes;
  if (input.dateFin !== undefined) traitement.dateFin = input.dateFin ? new Date(input.dateFin) : null;
  if (input.actif !== undefined) {
    traitement.actif = input.actif;
    // Arrêt d'un traitement : on date la fin si elle n'est pas renseignée
    if (!input.actif && !traitement.dateFin) traitement.dateFin = new Date();
  }
  await traitement.save();
  return traitement;
}


export async function getPatients(userId: number, search?: string) {
  const soignant = await getSoignantOrThrow(userId);
  const patientIds = await getPatientIds(soignant.id);
  if (patientIds.length === 0) return [];

  const patients = await Patient.findAll({
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

  // Indicateurs de suivi pour repérer rapidement les patients qui décrochent
  return Promise.all(
    patients.map(async (p) => {
      const [resume, alertes] = await Promise.all([
        getResumeObservance(p.id),
        getAlertesExamens(p.id, p.pathologie),
      ]);
      return {
        ...p.toJSON(),
        observance: { taux7: resume.taux7, taux30: resume.taux30 },
        examensEnRetard: alertes.filter((a) => a.statut === 'en_retard').length,
      };
    })
  );
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
