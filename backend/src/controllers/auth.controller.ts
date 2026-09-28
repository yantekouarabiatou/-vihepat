import { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { logAudit } from '../middlewares/audit';
import { env } from '../config/env';

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
  structure: z.string().min(1),
  specialite: z.string().optional(),
  telephone: z.string().optional(),
  codeInvitation: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function registerPatient(req: Request, res: Response) {
  const data = registerPatientSchema.parse(req.body);
  const result = await authService.registerPatient(data);
  await logAudit(req, 'REGISTER_PATIENT', `user:${result.user.id}`, undefined, result.user.id);
  res.status(201).json(result);
}

export async function registerSoignant(req: Request, res: Response) {
  const { codeInvitation, ...data } = registerSoignantSchema.parse(req.body);
  // Séparation des rôles : seul un professionnel habilité par sa structure crée un compte soignant
  if (env.SOIGNANT_INVITE_CODE && codeInvitation !== env.SOIGNANT_INVITE_CODE) {
    return res.status(403).json({ error: "Code d'habilitation invalide. Demandez-le à votre structure de santé." });
  }
  const result = await authService.registerSoignant(data);

  await logAudit(req, 'REGISTER_SOIGNANT', `user:${result.user.id}`, undefined, result.user.id);
  res.status(201).json(result);
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