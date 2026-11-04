import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from '../services/signalement-reponses.service';
import { logAudit } from '../middlewares/audit';

const idParam = z.coerce.number().int().positive();
const reponseSchema = z.object({
  texte: z.string().max(2000).optional(),
  audio: z
    .object({ base64: z.string().max(4_200_000), type: z.string().max(60), duree: z.number().min(0).max(600) })
    .optional(),
});

export async function listerSoignant(req: Request, res: Response) {
  res.json(await service.listerPourSoignant(req.user!.userId, idParam.parse(req.params.id)));
}

export async function repondreSoignant(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  const data = reponseSchema.parse(req.body);
  const r = await service.repondreSoignant(req.user!.userId, id, data);
  await logAudit(req, 'REPONSE_SIGNALEMENT', `signalement:${id}`, { vocal: !!data.audio });
  res.status(201).json(r);
}

export async function listerPatient(req: Request, res: Response) {
  res.json(await service.listerPourPatient(req.user!.userId, idParam.parse(req.params.id)));
}

export async function repondrePatient(req: Request, res: Response) {
  const r = await service.repondrePatient(req.user!.userId, idParam.parse(req.params.id), reponseSchema.parse(req.body));
  res.status(201).json(r);
}

export async function signalementsPatient(req: Request, res: Response) {
  res.json(await service.signalementsAvecMessages(req.user!.userId));
}

/** Note vocale : servie avec contrôle d'accès, jamais mise en cache par le navigateur */
export async function audio(req: Request, res: Response) {
  const a = await service.audio(req.user!.userId, req.user!.role, idParam.parse(req.params.reponseId));
  res.setHeader('Content-Type', a.type);
  res.setHeader('Cache-Control', 'no-store');
  res.send(a.contenu);
}
