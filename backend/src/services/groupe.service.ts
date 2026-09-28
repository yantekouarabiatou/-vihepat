import { GroupeSoutien, MembreGroupe, MessageGroupe, Patient, User } from '../models';
import { getPatientOrThrow } from './patient.service';

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

async function estMembre(groupeId: number, patientId: number) {
  const membre = await MembreGroupe.findOne({ where: { groupeId, patientId } });
  return !!membre;
}

export async function getGroupes(userId: number) {
  const patient = await getPatientOrThrow(userId);

  const groupes = await GroupeSoutien.findAll({ where: { actif: true }, order: [['nom', 'ASC']] });
  const mesAdhesions = await MembreGroupe.findAll({ where: { patientId: patient.id } });
  const idsRejoints = new Set(mesAdhesions.map((m) => m.groupeId));

  const resultats = await Promise.all(
    groupes.map(async (g) => ({
      id: g.id,
      nom: g.nom,
      description: g.description,
      pathologie: g.pathologie,
      estMembre: idsRejoints.has(g.id),
      nbMembres: await MembreGroupe.count({ where: { groupeId: g.id } }),
    }))
  );

  // Les groupes correspondant à la pathologie du patient (ou ouverts à tous) en premier
  return resultats.sort((a, b) => {
    const pertinenceA = a.pathologie === null || a.pathologie === patient.pathologie ? 0 : 1;
    const pertinenceB = b.pathologie === null || b.pathologie === patient.pathologie ? 0 : 1;
    return pertinenceA - pertinenceB;
  });
}

export async function rejoindreGroupe(userId: number, groupeId: number) {
  const patient = await getPatientOrThrow(userId);
  const groupe = await GroupeSoutien.findOne({ where: { id: groupeId, actif: true } });
  if (!groupe) throw httpError(404, 'Groupe introuvable');

  await MembreGroupe.findOrCreate({
    where: { groupeId, patientId: patient.id },
    defaults: { groupeId, patientId: patient.id },
  });
  return { groupeId, estMembre: true };
}

export async function getMessages(userId: number, groupeId: number) {
  const patient = await getPatientOrThrow(userId);
  if (!(await estMembre(groupeId, patient.id))) {
    throw httpError(403, 'Rejoignez ce groupe pour voir les messages');
  }

  const messages = await MessageGroupe.findAll({
    where: { groupeId },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['prenom'] }] }],
    order: [['createdAt', 'ASC']],
    limit: 100,
  });

  return messages.map((m) => ({
    id: m.id,
    contenu: m.contenu,
    createdAt: (m as any).createdAt,
    auteur: (m as any).patient?.user?.prenom ?? 'Membre',
    deMoi: m.patientId === patient.id,
  }));
}

export async function postMessage(userId: number, groupeId: number, contenu: string) {
  const patient = await getPatientOrThrow(userId);
  if (!(await estMembre(groupeId, patient.id))) {
    throw httpError(403, 'Rejoignez ce groupe pour publier un message');
  }

  const message = await MessageGroupe.create({ groupeId, patientId: patient.id, contenu });
  return {
    id: message.id,
    contenu: message.contenu,
    createdAt: (message as any).createdAt,
    auteur: 'Vous',
    deMoi: true,
  };
}

