import { Request, Response } from 'express';
import { z } from 'zod';
import * as groupeService from '../services/groupe.service';

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
