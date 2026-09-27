import { Request, Response } from 'express';
import { z } from 'zod';
import * as patientService from '../services/patient.service';
import { logAudit } from '../middlewares/audit';

const createRendezVousSchema = z.object({
  motif: z.string().min(1).max(200).optional(),
  dateHeure: z.string().min(1),
});

const createSignalementSchema = z.object({
  symptome: z.string().min(1).max(150),
  gravite: z.enum(['leger', 'modere', 'severe']),
  notes: z.string().optional(),
});

export async function getRendezVous(req: Request, res: Response) {
  const result = await patientService.getRendezVous(req.user!.userId);
  res.json(result);
}

export async function createRendezVous(req: Request, res: Response) {
  const data = createRendezVousSchema.parse(req.body);
  const result = await patientService.createRendezVous(req.user!.userId, data);
  await logAudit(req, 'CREATE_RENDEZ_VOUS', `rendez_vous:${result.id}`);
  res.status(201).json(result);
}

export async function getTraitements(req: Request, res: Response) {
  const result = await patientService.getTraitements(req.user!.userId);
  res.json(result);
}

export async function getObservations(req: Request, res: Response) {
  const result = await patientService.getObservations(req.user!.userId);
  res.json(result);
}

export async function getSignalements(req: Request, res: Response) {
  const result = await patientService.getSignalements(req.user!.userId);
  res.json(result);
}

export async function createSignalement(req: Request, res: Response) {
  const data = createSignalementSchema.parse(req.body);
  const result = await patientService.createSignalement(req.user!.userId, data);
  await logAudit(req, 'CREATE_SIGNALEMENT', `signalement:${result.id}`, { gravite: data.gravite });
  res.status(201).json(result);
}
