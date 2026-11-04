import { MessageGroupe, ReactionMessage, SignalementMessage } from '../models';
import type { MotifSignalement, TypeReaction } from '../models/InteractionGroupe';
import { getPatientOrThrow } from './patient.service';
import { estMembre, httpError } from './groupe-commun';

/** Interactions des membres sur les messages : réactions de soutien et signalements à l'équipe. */

async function messageVisiblePourMembre(patientId: number, messageId: number) {
  const message = await MessageGroupe.findOne({ where: { id: messageId, masque: false } });
  if (!message) throw httpError(404, 'Message introuvable');
  if (!(await estMembre(message.groupeId, patientId))) throw httpError(403, 'Rejoignez ce groupe pour réagir');
  return message;
}

/** Ajoute ou retire sa réaction (bascule) */
export async function reagir(userId: number, messageId: number, type: TypeReaction) {
  const patient = await getPatientOrThrow(userId);
  await messageVisiblePourMembre(patient.id, messageId);
  const existante = await ReactionMessage.findOne({ where: { messageId, patientId: patient.id, type } });
  if (existante) await existante.destroy();
  else await ReactionMessage.create({ messageId, patientId: patient.id, type });
  return { messageId, type, actif: !existante };
}

/** Un membre signale un message : il passe dans les signalements à traiter de l'équipe soignante. */
export async function signalerMessage(userId: number, messageId: number, motif: MotifSignalement, commentaire?: string) {
  const patient = await getPatientOrThrow(userId);
  const message = await messageVisiblePourMembre(patient.id, messageId);
  if (message.patientId === patient.id) throw httpError(400, 'Vous ne pouvez pas signaler votre propre message');
  await SignalementMessage.findOrCreate({
    where: { messageId, patientId: patient.id },
    defaults: { messageId, patientId: patient.id, motif, commentaire: commentaire?.trim() || null },
  });
  if (message.alerteStatut !== 'a_traiter') {
    message.alerteStatut = 'a_traiter';
    message.alerteTraiteePar = null;
    message.alerteTraiteeLe = null;
    await message.save();
  }
  return { messageId, signale: true };
}
