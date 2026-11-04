import { Request, Response } from 'express';
import { z } from 'zod';
import * as groupeService from '../services/groupe.service';
import * as interactions from '../services/groupe-interactions.service';
import * as equipe from '../services/groupe-equipe.service';
import { logAudit } from '../middlewares/audit';
import { MOTIFS_SIGNALEMENT, TYPES_REACTION } from '../models/InteractionGroupe';

const messageSchema = z.object({
  contenu: z.string().trim().min(1).max(1000),
  reponseA: z.coerce.number().int().positive().nullable().optional(),
});
const reactionSchema = z.object({ type: z.enum(TYPES_REACTION) });
const signalementSchema = z.object({
  motif: z.enum(MOTIFS_SIGNALEMENT),
  commentaire: z.string().trim().max(300).optional(),
});

export async function getGroupes(req: Request, res: Response) {
  const result = await groupeService.getGroupes(req.user!.userId);
  res.json(result);
}

export async function rejoindreGroupe(req: Request, res: Response) {
  const groupeId = Number(req.params.id);
  const result = await groupeService.rejoindreGroupe(req.user!.userId, groupeId);
  res.status(201).json(result);
}

export async function getMessages(req: Request, res: Response) {
  const groupeId = Number(req.params.id);
  const result = await groupeService.getMessages(req.user!.userId, groupeId);
  res.json(result);
}

export async function postMessage(req: Request, res: Response) {
  const groupeId = Number(req.params.id);
  const { contenu, reponseA } = messageSchema.parse(req.body);
  const result = await groupeService.postMessage(req.user!.userId, groupeId, contenu, reponseA);
  res.status(201).json(result);
}

export async function reagir(req: Request, res: Response) {
  const messageId = Number(req.params.messageId);
  const { type } = reactionSchema.parse(req.body);
  res.json(await interactions.reagir(req.user!.userId, messageId, type));
}

export async function signalerMessage(req: Request, res: Response) {
  const messageId = Number(req.params.messageId);
  const { motif, commentaire } = signalementSchema.parse(req.body);
  const result = await interactions.signalerMessage(req.user!.userId, messageId, motif, commentaire);
  // Journal : l'événement seul, sans le contenu du message
  await logAudit(req, 'SIGNALER_GROUPE_MESSAGE', `message_groupe:${messageId}`, { motif });
  res.status(201).json(result);
}

/* Équipe soignante : lecture des groupes et veille des mots sensibles */

const idParam = z.coerce.number().int().positive();
const moderationSchema = z.object({
  traitee: z.boolean().optional(),
  masque: z.boolean().optional(),
}).refine((v) => v.traitee !== undefined || v.masque !== undefined, { message: 'Rien à modifier' });

export async function getGroupesEquipe(_req: Request, res: Response) {
  res.json(await equipe.getGroupesEquipe());
}

export async function getMessagesEquipe(req: Request, res: Response) {
  const groupeId = idParam.parse(req.params.id);
  const result = await equipe.getMessagesEquipe(req.user!.userId, groupeId);
  // Lire une discussion entre patients est un accès à des données sensibles : il est tracé
  await logAudit(req, 'VIEW_GROUPE_MESSAGES', `groupe:${groupeId}`);
  res.json(result);
}

export async function getAlertesEquipe(req: Request, res: Response) {
  res.json(await equipe.getAlertesEquipe(req.user!.userId));
}

export async function modererMessage(req: Request, res: Response) {
  const messageId = idParam.parse(req.params.id);
  const data = moderationSchema.parse(req.body);
  const result = await equipe.modererMessage(req.user!.userId, messageId, data);
  await logAudit(req, 'MODERATE_GROUPE_MESSAGE', `message_groupe:${messageId}`, data);
  res.json(result);
}
