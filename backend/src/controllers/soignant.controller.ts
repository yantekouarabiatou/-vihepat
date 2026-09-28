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

const idParam = z.coerce.number().int().positive();

const rattacherSchema = z.object({
  codePatient: z.string().trim().min(3).max(20),
});

const createPatientSchema = z.object({
  email: z.string().trim().email(),
  nom: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  pathologie: z.enum(['vih', 'vhb', 'vhc', 'vih_vhb', 'vih_vhc', 'vhb_vhc']),
  sexe: z.enum(['M', 'F']).optional(),
  telephone: z.string().trim().max(30).optional(),
  region: z.string().trim().max(100).optional(),
  commune: z.string().trim().max(100).optional(),
  dateNaissance: z.string().optional(),
  dateDiagnostic: z.string().optional(),
  languePreferee: z.string().max(10).optional(),
  consentementDonne: z.boolean(),
});

const createRendezVousSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  dateHeure: z.string().min(1),
  motif: z.string().trim().max(200).optional(),
});

const createCommuniqueSchema = z.object({
  titre: z.string().trim().min(1).max(150),
  contenu: z.string().trim().min(1).max(2000),
  cible: z.enum(['tous', 'patient']),
  patientId: z.coerce.number().int().positive().optional(),
});

const TYPES_OBSERVATION = [
  'charge_virale', 'cd4', 'transaminases', 'creatinine',
  'hemoglobine', 'ag_hbs', 'arn_vhc', 'autre',
] as const;

const dateNonFuture = z.string().min(1).refine((v) => {
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 60_000;
}, { message: 'Date invalide ou dans le futur' });

const createObservationSchema = z.object({
  type: z.enum(TYPES_OBSERVATION),
  valeur: z.coerce.number().min(0),
  unite: z.string().trim().min(1).max(20),
  datePrelevement: dateNonFuture,
  commentaire: z.string().max(1000).optional(),
});

const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format HH:MM attendu');

const createTraitementSchema = z.object({
  molecule: z.string().trim().min(1).max(150),
  dosage: z.string().trim().max(50).optional(),
  frequence: z.string().trim().min(1).max(50),
  heurePrise: heure.optional(),
  dateDebut: z.string().min(1),
  dateFin: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const updateTraitementSchema = z.object({
  molecule: z.string().trim().min(1).max(150).optional(),
  dosage: z.string().trim().max(50).nullable().optional(),
  frequence: z.string().trim().min(1).max(50).optional(),
  heurePrise: heure.nullable().optional(),
  dateFin: z.string().nullable().optional(),
  actif: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export async function rattacherPatient(req: Request, res: Response) {
  const { codePatient } = rattacherSchema.parse(req.body);
  const patient = await soignantService.rattacherPatient(req.user!.userId, codePatient);
  await logAudit(req, 'RATTACHER_PATIENT', `patient:${patient.id}`);
  res.status(201).json(patient);
}

export async function creerPatient(req: Request, res: Response) {
  const data = createPatientSchema.parse(req.body);
  const result = await soignantService.creerPatient(req.user!.userId, data);
  await logAudit(req, 'CREATE_PATIENT', `patient:${result.patient.id}`);
  res.status(201).json(result);
}

const updatePatientSchema = z.object({
  nom: z.string().trim().min(1).max(100).optional(),
  prenom: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().optional(),
  pathologie: z.enum(['vih', 'vhb', 'vhc', 'vih_vhb', 'vih_vhc', 'vhb_vhc']).optional(),
  sexe: z.enum(['M', 'F']).nullable().optional(),
  telephone: z.string().trim().max(30).nullable().optional(),
  region: z.string().trim().max(100).nullable().optional(),
  commune: z.string().trim().max(100).nullable().optional(),
  languePreferee: z.string().max(10).optional(),
  dateNaissance: z.string().nullable().optional(),
  dateDiagnostic: z.string().nullable().optional(),
});

export async function updatePatient(req: Request, res: Response) {
  const patientId = idParam.parse(req.params.id);
  const data = updatePatientSchema.parse(req.body);
  const result = await soignantService.updatePatient(req.user!.userId, patientId, data);
  await logAudit(req, 'UPDATE_PATIENT', `patient:${patientId}`, data);
  res.json(result);
}

export async function reinitialiserAccesPatient(req: Request, res: Response) {
  const patientId = idParam.parse(req.params.id);
  const result = await soignantService.reinitialiserAccesPatient(req.user!.userId, patientId);
  await logAudit(req, 'RESET_PATIENT_CREDENTIALS', `patient:${patientId}`);
  res.json(result);
}

export async function getPatientDetail(req: Request, res: Response) {
  const patientId = idParam.parse(req.params.id);
  const result = await soignantService.getPatientDetail(req.user!.userId, patientId);
  // Traçabilité : chaque consultation de dossier est journalisée
  await logAudit(req, 'VIEW_PATIENT', `patient:${patientId}`);
  res.json(result);
}

export async function createObservation(req: Request, res: Response) {
  const patientId = idParam.parse(req.params.id);
  const data = createObservationSchema.parse(req.body);
  const result = await soignantService.createObservation(req.user!.userId, patientId, data);
  await logAudit(req, 'CREATE_OBSERVATION', `observation:${result.id}`, {
    patientId, type: data.type,
  });
  res.status(201).json(result);
}

export async function createTraitement(req: Request, res: Response) {
  const patientId = idParam.parse(req.params.id);
  const data = createTraitementSchema.parse(req.body);
  const result = await soignantService.createTraitement(req.user!.userId, patientId, data);
  await logAudit(req, 'CREATE_TRAITEMENT', `traitement:${result.id}`, { patientId });
  res.status(201).json(result);
}

export async function updateTraitement(req: Request, res: Response) {
  const traitementId = idParam.parse(req.params.id);
  const data = updateTraitementSchema.parse(req.body);
  const result = await soignantService.updateTraitement(req.user!.userId, traitementId, data);
  await logAudit(req, 'UPDATE_TRAITEMENT', `traitement:${result.id}`, data);
  res.json(result);
}


export async function getPatients(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await soignantService.getPatients(req.user!.userId, search);
  res.json(result);
}

export async function getRendezVous(req: Request, res: Response) {
  const result = await soignantService.getRendezVous(req.user!.userId);
  res.json(result);
}

export async function createRendezVous(req: Request, res: Response) {
  const data = createRendezVousSchema.parse(req.body);
  const result = await soignantService.createRendezVous(req.user!.userId, data);
  await logAudit(req, 'CREATE_RENDEZ_VOUS', `rendez_vous:${result.id}`, { patientId: data.patientId });
  res.status(201).json(result);
}

export async function envoyerRappelRdv(req: Request, res: Response) {
  const rendezVousId = idParam.parse(req.params.id);
  const result = await soignantService.envoyerRappelRdv(req.user!.userId, rendezVousId);
  await logAudit(req, 'RAPPEL_RENDEZ_VOUS', `rendez_vous:${result.id}`);
  res.json(result);
}

export async function getCommuniques(req: Request, res: Response) {
  const result = await soignantService.getCommuniques(req.user!.userId);
  res.json(result);
}

export async function createCommunique(req: Request, res: Response) {
  const data = createCommuniqueSchema.parse(req.body);
  const result = await soignantService.createCommunique(req.user!.userId, data);
  await logAudit(req, 'CREATE_COMMUNIQUE', `communique:${result.id}`, { cible: data.cible });
  res.status(201).json(result);
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
