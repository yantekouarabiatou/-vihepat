import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { logAudit } from '../middlewares/audit';

const registerPatientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
  nom: z.string().min(1),
  prenom: z.string().min(1),
  pathologie: z.enum(['vih', 'vhb', 'vhc', 'vih_vhb', 'vih_vhc', 'vhb_vhc']),
  languePreferee: z.string().optional(),
  dateNaissance: z.string().optional(),
  sexe: z.enum(['M', 'F']).optional(),
  telephone: z.string().optional(),
  region: z.string().optional(),
  commune: z.string().optional(),
  consentementDonne: z.boolean().refine((v) => v === true, {
    message: 'Le consentement est obligatoire',
  }),
});

const registerSoignantSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nom: z.string().min(1),
  prenom: z.string().min(1),
  matricule: z.string().min(1),
  structureId: z.coerce.number().int().positive(),
  codeInvitation: z.string().trim().min(1, "Code d'habilitation requis"),
  specialite: z.string().optional(),
  telephone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function registerPatient(_req: Request, res: Response) {
  res.status(403).json({
    error: "L'auto-inscription des patients n'est pas autorisée sur la plateforme VIHEPAT.",
    message: "Conformément aux règles de sécurité et au secret médical, seuls les soignants et les administrateurs ont la possibilité d'ouvrir un dossier patient.",
    code: 'PATIENT_SELF_REGISTRATION_FORBIDDEN',
  });
}

export async function registerSoignant(req: Request, res: Response) {
  const data = registerSoignantSchema.parse(req.body);
  // Séparation des rôles : seul un professionnel qui connaît le code de sa
  // structure peut créer un compte soignant (Structure.codeInvitation).
  const result = await authService.registerSoignant(data);

  await logAudit(req, 'REGISTER_SOIGNANT', `user:${result.user.id}`, undefined, result.user.id);
  res.status(201).json(result);
}

export async function getStructures(_req: Request, res: Response) {
  const result = await authService.getStructures();
  res.json(result);
}

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  await logAudit(req, 'LOGIN', `user:${result.user.id}`, undefined, result.user.id);
  res.json(result);
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken);
  res.json(result);
}

export async function me(req: Request, res: Response) {
  const userId = req.user!.userId;
  const result = await authService.me(userId);
  res.json(result);
}