import { Request, Response } from 'express';
import { z } from 'zod';
import * as soignantService from '../services/soignant.service';
import { logAudit } from '../middlewares/audit';

const updateRendezVousSchema = z.object({
  statut: z.enum(['prevu', 'confirme', 'effectue', 'manque', 'annule']).optional(),
  notes: z.string().optional(),
});

const updateSignalementSchema = z.object({
  statut: z.enum(['vu', 'traite']),
});

export async function getPatients(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await soignantService.getPatients(req.user!.userId, search);
  res.json(result);
}

export async function getRendezVous(req: Request, res: Response) {
  const result = await soignantService.getRendezVous(req.user!.userId);
  res.json(result);
}

export async function updateRendezVous(req: Request, res: Response) {
  const data = updateRendezVousSchema.parse(req.body);
  const result = await soignantService.updateRendezVous(req.user!.userId, Number(req.params.id), data);
  await logAudit(req, 'UPDATE_RENDEZ_VOUS', `rendez_vous:${result.id}`, data);
  res.json(result);
}

export async function getSignalements(req: Request, res: Response) {
  const statut = typeof req.query.statut === 'string' ? req.query.statut : undefined;
  const result = await soignantService.getSignalements(req.user!.userId, statut);
  res.json(result);
}

export async function updateSignalement(req: Request, res: Response) {
  const { statut } = updateSignalementSchema.parse(req.body);
  const result = await soignantService.updateSignalement(req.user!.userId, Number(req.params.id), statut);
  await logAudit(req, 'UPDATE_SIGNALEMENT', `signalement:${result.id}`, { statut });
  res.json(result);
}
