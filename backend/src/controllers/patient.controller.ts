import { Request, Response } from 'express';
import { z } from 'zod';
import * as patientService from '../services/patient.service';
import * as chatService from '../services/chat.service';
import * as observanceService from '../services/observance.service';
import * as rappelsService from '../services/rappels.service';
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

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(30),
});

const declarerPriseSchema = z.object({
  traitementId: z.coerce.number().int().positive(),
  rang: z.coerce.number().int().min(1).max(4).optional(),
  statut: z.enum(['prise', 'manquee']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function getObservance(req: Request, res: Response) {
  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  const [journee, resume] = await Promise.all([
    observanceService.getJournee(patient.id),
    observanceService.getResumeObservance(patient.id),
  ]);
  res.json({ date: observanceService.jourLocal(), journee, resume });
}

export async function declarerPrise(req: Request, res: Response) {
  const data = declarerPriseSchema.parse(req.body);
  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  const prise = await observanceService.declarerPrise(patient.id, data);
  res.status(201).json(prise);
}

export async function getAccesDossier(req: Request, res: Response) {
  res.json(await patientService.getAccesDossier(req.user!.userId));
}

export async function getAlertesExamens(req: Request, res: Response) {

  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  res.json(await observanceService.getAlertesExamens(patient.id, patient.pathologie));
}

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

export async function getCommuniques(req: Request, res: Response) {
  const result = await patientService.getCommuniques(req.user!.userId);
  res.json(result);
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

export async function chat(req: Request, res: Response) {
  const { messages } = chatSchema.parse(req.body);
  const result = await chatService.sendChatMessage(req.user!.userId, req.user?.role ?? 'patient', messages);
  if (result.signalementCreated) {
    await logAudit(req, 'CREATE_SIGNALEMENT_CHAT', `user:${req.user!.userId}`);
  }
  res.json(result);
}

// ---------------------------------------------------------------------------
// Rappels discrets : seules les réponses (et jamais le libellé) arrivent au serveur
// ---------------------------------------------------------------------------

const confirmationSchema = z.object({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  type: z.enum(['prise', 'rdv']),
  statut: z.enum(['confirmee', 'non_confirmee']),
  prevuLe: z.string().min(1),
  reponduLe: z.string().nullable().optional(),
  reports: z.coerce.number().int().min(0).max(20).optional(),
});

const confirmationsSchema = z.object({
  confirmations: z.array(confirmationSchema).min(1).max(100),
});

const partageSchema = z.object({ partageConfirmations: z.boolean() });

/** Événements journalisés : l'action seule, sans libellé, heure ni contenu du rappel. */
const journalRappelSchema = z.object({
  action: z.enum(['RAPPEL_CREE', 'RAPPEL_MODIFIE', 'RAPPEL_SUPPRIME', 'RAPPEL_ACTIVE', 'RAPPEL_DESACTIVE']),
});

export async function getPartageRappels(req: Request, res: Response) {
  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  res.json(await rappelsService.getPartage(patient.id));
}

export async function setPartageRappels(req: Request, res: Response) {
  const { partageConfirmations } = partageSchema.parse(req.body);
  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  const result = await rappelsService.setPartage(patient.id, partageConfirmations);
  await logAudit(req, partageConfirmations ? 'RAPPELS_PARTAGE_ACTIVE' : 'RAPPELS_PARTAGE_COUPE', `patient:${patient.id}`);
  res.json(result);
}

export async function enregistrerConfirmations(req: Request, res: Response) {
  const { confirmations } = confirmationsSchema.parse(req.body);
  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  let enregistrees = 0;
  for (const c of confirmations) {
    try {
      const r = await rappelsService.enregistrerConfirmation(patient.id, c);
      if (r.enregistre) enregistrees++;
    } catch (err: any) {
      // Une confirmation refusée (trop ancienne…) n'empêche pas d'enregistrer les autres
      if (!err?.status || err.status >= 500) throw err;
    }
  }
  res.status(201).json({ recues: confirmations.length, enregistrees });
}

export async function journaliserRappel(req: Request, res: Response) {
  const { action } = journalRappelSchema.parse(req.body);
  const patient = await patientService.getPatientOrThrow(req.user!.userId);
  await logAudit(req, action, `patient:${patient.id}`);
  res.status(204).end();
}
