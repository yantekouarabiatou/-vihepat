import { Op } from 'sequelize';
import { Affectation, GroupeSoutien, MembreGroupe, MessageGroupe, ReactionMessage, SignalementMessage, Soignant, User } from '../models';
import type { Patient } from '../models';
import { getPatientOrThrow } from './patient.service';
import { detecterMotsSensibles, type CategorieAlerte } from './moderation.service';
import { sendAlerteMedicaleEmail } from './mail.service';
import { pseudonyme } from './pseudonyme.service';
import { inclureAuteur, inclureReponse, citation, compterReactions, estMembre, httpError, pseudoDe } from './groupe-commun';

/** Groupes de soutien côté membre. Interactions : groupe-interactions.service ; équipe : groupe-equipe.service. */

export async function getGroupes(userId: number) {
  const patient = await getPatientOrThrow(userId);
  const user = await User.findByPk(userId, { attributes: ['prenom', 'nom'] });

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
  return {
    monPseudo: pseudonyme(patient.id, user?.prenom, user?.nom),
    groupes: resultats.sort((a, b) => {
      const pertinenceA = a.pathologie === null || a.pathologie === patient.pathologie ? 0 : 1;
      const pertinenceB = b.pathologie === null || b.pathologie === patient.pathologie ? 0 : 1;
      return pertinenceA - pertinenceB;
    }),
  };
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
    include: [
      inclureAuteur(),
      inclureReponse(),
      { model: ReactionMessage, as: 'reactions', attributes: ['type', 'patientId'] },
      { model: SignalementMessage, as: 'signalementsMembres', attributes: ['patientId'], where: { patientId: patient.id }, required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  return messages.reverse().map((m) => ({
    id: m.id,
    contenu: m.contenu,
    createdAt: (m as any).createdAt,
    auteur: pseudoDe(m),
    deMoi: m.patientId === patient.id,
    masque: m.masque,
    reponseA: citation(m),
    reactions: compterReactions(m, patient.id),
    signaleParMoi: (((m as any).signalementsMembres ?? []) as SignalementMessage[]).length > 0,
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

export async function postMessage(userId: number, groupeId: number, contenu: string, reponseA?: number | null) {
  const patient = await getPatientOrThrow(userId);
  if (!(await estMembre(groupeId, patient.id))) {
    throw httpError(403, 'Rejoignez ce groupe pour publier un message');
  }
  // On ne répond qu'à un message visible du même groupe
  if (reponseA) {
    const cite = await MessageGroupe.findOne({ where: { id: reponseA, groupeId, masque: false } });
    if (!cite) throw httpError(404, 'Message cité introuvable');
  }

  // Rien n'est bloqué : le message est publié et, s'il contient des mots sensibles, signalé à l'équipe
  const detection = detecterMotsSensibles(contenu);
  const message = await MessageGroupe.create({
    groupeId,
    patientId: patient.id,
    contenu,
    reponseA: reponseA ?? null,
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
