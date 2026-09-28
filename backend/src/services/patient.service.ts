import { Op } from 'sequelize';
import {
  Patient, RendezVous, Traitement, Observation, Signalement, AuditLog, User, Soignant,
} from '../models';

/** Actions tracées qui concernent le dossier d'un patient. */
const ACTIONS_DOSSIER = [
  'VIEW_PATIENT', 'RATTACHER_PATIENT', 'CREATE_OBSERVATION', 'CREATE_TRAITEMENT', 'UPDATE_TRAITEMENT',
];

/**
 * Transparence : le patient voit qui a consulté ou modifié son dossier, et quand.
 */
export async function getAccesDossier(userId: number) {
  const patient = await getPatientOrThrow(userId);
  const logs = await AuditLog.findAll({
    where: {
      action: { [Op.in]: ACTIONS_DOSSIER },
      [Op.or]: [
        { cible: `patient:${patient.id}` },
        // Saisies du soignant : l'identifiant du patient est dans les métadonnées JSON
        { meta: { patientId: patient.id } },

      ],
    },
    include: [{
      model: User, as: 'user', attributes: ['nom', 'prenom', 'role'],
      include: [{ model: Soignant, as: 'soignant', attributes: ['structure', 'specialite'] }],
    }],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  return logs.map((l) => {
    const u = (l as any).user;
    return {
      id: l.id,
      action: l.action,
      date: (l as any).createdAt as Date,
      acteur: u
        ? { nom: u.nom, prenom: u.prenom, role: u.role, structure: u.soignant?.structure ?? null }
        : null,
    };
  });
}


export async function getPatientOrThrow(userId: number) {

  const patient = await Patient.findOne({ where: { userId } });
  if (!patient) {
    const e: any = new Error('Profil patient introuvable');
    e.status = 404;
    throw e;
  }
  return patient;
}

export async function getRendezVous(userId: number) {
  const patient = await getPatientOrThrow(userId);
  return RendezVous.findAll({
    where: { patientId: patient.id, dateHeure: { [Op.gte]: new Date() } },
    order: [['dateHeure', 'ASC']],
    limit: 10,
  });
}

export async function createRendezVous(userId: number, input: { motif?: string; dateHeure: string }) {
  const patient = await getPatientOrThrow(userId);
  return RendezVous.create({
    patientId: patient.id,
    dateHeure: new Date(input.dateHeure),
    motif: input.motif ?? null,
    statut: 'prevu',
  });
}

export async function getTraitements(userId: number) {
  const patient = await getPatientOrThrow(userId);
  return Traitement.findAll({
    where: { patientId: patient.id, actif: true },
    order: [['dateDebut', 'DESC']],
  });
}

export async function getObservations(userId: number) {
  const patient = await getPatientOrThrow(userId);
  const observations = await Observation.findAll({
    where: { patientId: patient.id },
    order: [['datePrelevement', 'DESC']],
  });

  const dernierParType = new Map<string, Observation>();
  for (const obs of observations) {
    if (!dernierParType.has(obs.type)) dernierParType.set(obs.type, obs);
  }
  return Array.from(dernierParType.values());
}

export async function getSignalements(userId: number) {
  const patient = await getPatientOrThrow(userId);
  return Signalement.findAll({
    where: { patientId: patient.id },
    order: [['createdAt', 'DESC']],
  });
}

export async function createSignalement(
  userId: number,
  input: { symptome: string; gravite: 'leger' | 'modere' | 'severe'; notes?: string }
) {
  const patient = await getPatientOrThrow(userId);
  return Signalement.create({
    patientId: patient.id,
    symptome: input.symptome,
    gravite: input.gravite,
    notes: input.notes ?? null,
    statut: 'nouveau',
  });
}
