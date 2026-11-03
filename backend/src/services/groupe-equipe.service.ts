import { GroupeSoutien, MembreGroupe, MessageGroupe, ReactionMessage, SignalementMessage } from '../models';
import type { Patient, User } from '../models';
import type { MotifSignalement } from '../models/InteractionGroupe';
import { patientsAccessibles } from './acces-patients.service';
import { inclureAuteur, inclureReponse, citation, compterReactions, httpError, pseudoDe } from './groupe-commun';

/* ------------------------------------------------------------------ */
/* Équipe soignante : lecture des discussions et veille                */
/* ------------------------------------------------------------------ */

/**
 * Les soignants voient les mêmes pseudonymes que les membres. L'identité (code patient, lien vers le
 * dossier) n'est donnée que pour les patients que ce soignant suit (tous pour le médecin et le super admin).
 */
async function serialiserPourEquipe(messages: MessageGroupe[], userId: number) {
  const acces = await patientsAccessibles(userId);
  return messages.map((m) => {
    const patient = (m as any).patient as (Patient & { user?: User }) | undefined;
    const identifiable = acces.admin || acces.ids.has(m.patientId);
    const signalements = ((m as any).signalementsMembres ?? []) as SignalementMessage[];
    const motifs = new Map<MotifSignalement, number>();
    for (const s of signalements) motifs.set(s.motif, (motifs.get(s.motif) ?? 0) + 1);
    return {
      id: m.id,
      groupeId: m.groupeId,
      groupe: (m as any).groupe?.nom as string | undefined,
      contenu: m.contenu,
      createdAt: (m as any).createdAt,
      auteur: pseudoDe(m),
      patient: identifiable && patient ? { id: patient.id, codePatient: patient.codePatient } : null,
      masque: m.masque,
      reponseA: citation(m),
      reactions: compterReactions(m),
      signalementsMembres: Array.from(motifs, ([motif, nombre]) => ({ motif, nombre })),
      commentairesMembres: signalements.map((s) => s.commentaire).filter((c): c is string => !!c),
      alerte: m.alerteStatut
        ? { categorie: m.alerteCategorie ?? null, mots: m.alerteMots ?? '', statut: m.alerteStatut, traiteeLe: m.alerteTraiteeLe ?? null }
        : null,
    };
  });
}

const inclureInteractions = () => [
  { model: ReactionMessage, as: 'reactions', attributes: ['type', 'patientId'] },
  { model: SignalementMessage, as: 'signalementsMembres', attributes: ['motif', 'commentaire'] },
];

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
    include: [inclureAuteur(), inclureReponse(), ...inclureInteractions()],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  return serialiserPourEquipe(messages.reverse(), userId);
}

/**
 * Signalements de la veille (mots sensibles détectés ou message signalé par un membre) : les non
 * traités d'abord, les plus graves en tête, puis les 20 derniers traités.
 */
export async function getAlertesEquipe(userId: number) {
  const inclure = () => [inclureAuteur(), inclureReponse(), ...inclureInteractions(), { model: GroupeSoutien, as: 'groupe', attributes: ['nom'] }];
  const [aTraiter, traitees] = await Promise.all([
    MessageGroupe.findAll({ where: { alerteStatut: 'a_traiter' }, include: inclure(), order: [['createdAt', 'DESC']] }),
    MessageGroupe.findAll({ where: { alerteStatut: 'traitee' }, include: inclure(), order: [['alerteTraiteeLe', 'DESC']], limit: 20 }),
  ]);
  // Un signalement par un membre (sans mot détecté) passe juste après la détresse
  const rang = (m: MessageGroupe) =>
    m.alerteCategorie ? { detresse: 0, traitement: 2, injure: 3, stigmatisation: 4, coordonnees: 5 }[m.alerteCategorie] : 1;
  aTraiter.sort((a, b) => rang(a) - rang(b));
  return {
    aTraiter: await serialiserPourEquipe(aTraiter, userId),
    traitees: await serialiserPourEquipe(traitees, userId),
  };
}

/** Classer un signalement et/ou masquer (réafficher) un message. */
export async function modererMessage(userId: number, messageId: number, input: { traitee?: boolean; masque?: boolean }) {
  const message = await MessageGroupe.findByPk(messageId, {
    include: [inclureAuteur(), inclureReponse(), ...inclureInteractions(), { model: GroupeSoutien, as: 'groupe', attributes: ['nom'] }],
  });
  if (!message) throw httpError(404, 'Message introuvable');
  if (input.masque !== undefined) message.masque = input.masque;
  if (input.traitee !== undefined && message.alerteStatut) {
    message.alerteStatut = input.traitee ? 'traitee' : 'a_traiter';
    message.alerteTraiteePar = input.traitee ? userId : null;
    message.alerteTraiteeLe = input.traitee ? new Date() : null;
  }
  await message.save();
  return (await serialiserPourEquipe([message], userId))[0];
}
