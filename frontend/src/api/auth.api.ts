import { api } from './client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterPatientInput {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  pathologie: 'vih' | 'vhb' | 'vhc' | 'vih_vhb' | 'vih_vhc' | 'vhb_vhc';
  languePreferee?: string;
  dateNaissance?: string;
  sexe?: 'M' | 'F';
  telephone?: string;
  region?: string;
  commune?: string;
  consentementDonne: boolean;
}

export interface RegisterSoignantInput {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  matricule: string;
  structure: string;
  specialite?: string;
  telephone?: string;
  /** Code d'habilitation remis par la structure de santé */
  codeInvitation?: string;
}

export interface AuthResponse {

  user: {
    id: number;
    email: string;
    nom: string;
    prenom: string;
    role: 'patient' | 'soignant' | 'admin';
    patient?: any;
    soignant?: any;
  };
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: (input: LoginInput) =>
    api.post<AuthResponse>('/auth/login', input).then((r) => r.data),

  registerPatient: (input: RegisterPatientInput) =>
    api.post<AuthResponse>('/auth/register/patient', input).then((r) => r.data),

  registerSoignant: (input: RegisterSoignantInput) =>
    api.post<AuthResponse>('/auth/register/soignant', input).then((r) => r.data),

  me: () => api.get('/auth/me').then((r) => r.data),
};