import { Request, Response } from 'express';
import { z } from 'zod';
import * as groupeService from '../services/groupe.service';
import { logAudit } from '../middlewares/audit';

const messageSchema = z.object({
  contenu: z.string().trim().min(1).max(1000),
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
  const { contenu } = messageSchema.parse(req.body);
  const result = await groupeService.postMessage(req.user!.userId, groupeId, contenu);
  res.status(201).json(result);
}

/* Équipe soignante : lecture des groupes et veille des mots sensibles */

const idParam = z.coerce.number().int().positive();
const moderationSchema = z.object({
  traitee: z.boolean().optional(),
  masque: z.boolean().optional(),
}).refine((v) => v.traitee !== undefined || v.masque !== undefined, { message: 'Rien à modifier' });

export async function getGroupesEquipe(_req: Request, res: Response) {
  res.json(await groupeService.getGroupesEquipe());
}

export async function getMessagesEquipe(req: Request, res: Response) {
  const groupeId = idParam.parse(req.params.id);
  const result = await groupeService.getMessagesEquipe(req.user!.userId, groupeId);
  // Lire une discussion entre patients est un accès à des données sensibles : il est tracé
  await logAudit(req, 'VIEW_GROUPE_MESSAGES', `groupe:${groupeId}`);
  res.json(result);
}

export async function getAlertesEquipe(req: Request, res: Response) {
  res.json(await groupeService.getAlertesEquipe(req.user!.userId));
}

export async function modererMessage(req: Request, res: Response) {
  const messageId = idParam.parse(req.params.id);
  const data = moderationSchema.parse(req.body);
  const result = await groupeService.modererMessage(req.user!.userId, messageId, data);
  await logAudit(req, 'MODERATE_GROUPE_MESSAGE', `message_groupe:${messageId}`, data);
  res.json(result);
}
