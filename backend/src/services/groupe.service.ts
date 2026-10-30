import { Op } from 'sequelize';
import { Affectation, GroupeSoutien, MembreGroupe, MessageGroupe, Patient, Soignant, User } from '../models';
import { getPatientOrThrow } from './patient.service';
import { detecterMotsSensibles, type CategorieAlerte } from './moderation.service';
import { sendAlerteMedicaleEmail } from './mail.service';
import { patientsAccessibles } from './acces-patients.service';

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

  // Un message masqué par l'équipe reste visible de son auteur seul, avec une mention
  const messages = await MessageGroupe.findAll({
    where: { groupeId, [Op.or]: [{ masque: false }, { patientId: patient.id }] },
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
    masque: m.masque,
  }));
}

/** Prévient le soignant référent d'une détresse, sans recopier le message (la boîte mail peut être partagée). */
async function alerterReferent(patient: Patient, categorie: CategorieAlerte) {
  if (categorie !== 'detresse') return;
  try {
    const affectation = await Affectation.findOne({
      where: { patientId: patient.id, principal: true },
      include: [{ model: Soignant, as: 'soignant', include: [{ model: User, as: 'user' }] }],
    });
    const soignantUser = (affectation as any)?.soignant?.user;
    if (!soignantUser?.email) return;
    await sendAlerteMedicaleEmail({
      to: soignantUser.email,
      soignantNom: `Dr ${soignantUser.prenom} ${soignantUser.nom}`,
      patientCode: patient.codePatient,
      gravite: 'Détresse possible',
      symptome: "Message de détresse dans un groupe de soutien",
      notes: "Le message est consultable dans l'espace soignant, rubrique Communautés.",
    });
  } catch (err) {
    console.warn('Alerte détresse au soignant impossible :', err);
  }
}

export async function postMessage(userId: number, groupeId: number, contenu: string) {
  const patient = await getPatientOrThrow(userId);
  if (!(await estMembre(groupeId, patient.id))) {
    throw httpError(403, 'Rejoignez ce groupe pour publier un message');
  }

  // Rien n'est bloqué : le message est publié et, s'il contient des mots sensibles, signalé à l'équipe
  const detection = detecterMotsSensibles(contenu);
  const message = await MessageGroupe.create({
    groupeId,
    patientId: patient.id,
    contenu,
    ...(detection
      ? { alerteCategorie: detection.categorie, alerteMots: detection.mots.join(', ').slice(0, 255), alerteStatut: 'a_traiter' as const }
      : {}),
  });
  if (detection) void alerterReferent(patient, detection.categorie);

  return {
    id: message.id,
    contenu: message.contenu,
    createdAt: (message as any).createdAt,
    auteur: 'Vous',
    deMoi: true,
    masque: false,
    // Le patient en détresse voit tout de suite les numéros d'aide (le reste du signalement lui est invisible)
    soutien: detection?.categorie === 'detresse',
  };
}

/* ------------------------------------------------------------------ */
/* Équipe soignante : lecture des discussions et veille                */
/* ------------------------------------------------------------------ */

/**
 * Les soignants lisent les messages sous le même prénom que les membres. L'identité (code patient,
 * lien vers le dossier) n'est donnée que pour les patients que ce soignant suit déjà (tous pour un admin).
 */
async function serialiserPourEquipe(messages: MessageGroupe[], userId: number) {
  const acces = await patientsAccessibles(userId);
  return messages.map((m) => {
    const patient = (m as any).patient as (Patient & { user?: User }) | undefined;
    const identifiable = acces.admin || acces.ids.has(m.patientId);
    return {
      id: m.id,
      groupeId: m.groupeId,
      groupe: (m as any).groupe?.nom as string | undefined,
      contenu: m.contenu,
      createdAt: (m as any).createdAt,
      auteur: patient?.user?.prenom ?? 'Membre',
      patient: identifiable && patient ? { id: patient.id, codePatient: patient.codePatient } : null,
      masque: m.masque,
      alerte: m.alerteCategorie
        ? { categorie: m.alerteCategorie, mots: m.alerteMots ?? '', statut: m.alerteStatut, traiteeLe: m.alerteTraiteeLe ?? null }
        : null,
    };
  });
}

const INCLURE_AUTEUR = { model: Patient, as: 'patient', attributes: ['id', 'codePatient'], include: [{ model: User, as: 'user', attributes: ['prenom'] }] };

export async function getGroupesEquipe() {
  const groupes = await GroupeSoutien.findAll({ order: [['nom', 'ASC']] });
  return Promise.all(
    groupes.map(async (g) => ({
      id: g.id,
      nom: g.nom,
      description: g.description,
      pathologie: g.pathologie,
      actif: g.actif,
      nbMembres: await MembreGroupe.count({ where: { groupeId: g.id } }),
      nbMessages: await MessageGroupe.count({ where: { groupeId: g.id } }),
      alertesATraiter: await MessageGroupe.count({ where: { groupeId: g.id, alerteStatut: 'a_traiter' } }),
    }))
  );
}

export async function getMessagesEquipe(userId: number, groupeId: number) {
  const groupe = await GroupeSoutien.findByPk(groupeId);
  if (!groupe) throw httpError(404, 'Groupe introuvable');
  const messages = await MessageGroupe.findAll({
    where: { groupeId },
    include: [INCLURE_AUTEUR],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  return serialiserPourEquipe(messages.reverse(), userId);
}

/** Signalements de la veille, les non traités d'abord (les plus graves en tête), puis les 20 derniers traités. */
export async function getAlertesEquipe(userId: number) {
  const [aTraiter, traitees] = await Promise.all([
    MessageGroupe.findAll({
      where: { alerteStatut: 'a_traiter' },
      include: [INCLURE_AUTEUR, { model: GroupeSoutien, as: 'groupe', attributes: ['nom'] }],
      order: [['createdAt', 'DESC']],
    }),
    MessageGroupe.findAll({
      where: { alerteStatut: 'traitee' },
      include: [INCLURE_AUTEUR, { model: GroupeSoutien, as: 'groupe', attributes: ['nom'] }],
      order: [['alerteTraiteeLe', 'DESC']],
      limit: 20,
    }),
  ]);
  const rang: Record<CategorieAlerte, number> = { detresse: 0, traitement: 1, injure: 2, stigmatisation: 3, coordonnees: 4 };
  aTraiter.sort((a, b) => rang[a.alerteCategorie!] - rang[b.alerteCategorie!]);
  return {
    aTraiter: await serialiserPourEquipe(aTraiter, userId),
    traitees: await serialiserPourEquipe(traitees, userId),
  };
}

/** Classer un signalement et/ou masquer (réafficher) un message. */
export async function modererMessage(userId: number, messageId: number, input: { traitee?: boolean; masque?: boolean }) {
  const message = await MessageGroupe.findByPk(messageId, {
    include: [INCLURE_AUTEUR, { model: GroupeSoutien, as: 'groupe', attributes: ['nom'] }],
  });
  if (!message) throw httpError(404, 'Message introuvable');
  if (input.masque !== undefined) message.masque = input.masque;
  if (input.traitee !== undefined && message.alerteCategorie) {
    message.alerteStatut = input.traitee ? 'traitee' : 'a_traiter';
    message.alerteTraiteePar = input.traitee ? userId : null;
    message.alerteTraiteeLe = input.traitee ? new Date() : null;
  }
  await message.save();
  return (await serialiserPourEquipe([message], userId))[0];
}
