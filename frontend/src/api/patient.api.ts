import { api } from './client';

export type Pathologie = 'vih' | 'vhb' | 'vhc' | 'vih_vhb' | 'vih_vhc' | 'vhb_vhc';
export type StatutRDV = 'prevu' | 'confirme' | 'effectue' | 'manque' | 'annule';
export type Gravite = 'leger' | 'modere' | 'severe';
export type StatutSignalement = 'nouveau' | 'vu' | 'traite';

export interface RendezVous {
  id: number;
  patientId: number;
  soignantId: number | null;
  dateHeure: string;
  motif: string | null;
  statut: StatutRDV;
  notes: string | null;
  rappelEnvoyeLe: string | null;
}

export interface Communique {
  id: number;
  titre: string;
  contenu: string;
  cible: 'tous' | 'patient';
  createdAt: string;
  auteur?: { id: number; structure: string; user: { nom: string; prenom: string } } | null;
}

export interface Traitement {
  id: number;
  patientId: number;
  molecule: string;
  dosage: string | null;
  frequence: string;
  heurePrise: string | null;
  dateDebut: string;
  dateFin: string | null;
  actif: boolean;
  notes: string | null;
}

export interface Observation {
  id: number;
  patientId: number;
  type: string;
  valeur: number;
  unite: string;
  datePrelevement: string;
  commentaire: string | null;
}

export interface Signalement {
  id: number;
  patientId: number;
  symptome: string;
  gravite: Gravite;
  notes: string | null;
  statut: StatutSignalement;
  createdAt: string;
}

export type StatutPrise = 'prise' | 'manquee';

export interface PriseDuJour {
  traitementId: number;
  molecule: string;
  dosage: string | null;
  rang: number;
  nbParJour: number;
  heure: string | null;
  statut: StatutPrise | null;
}

export interface JourObservance {
  date: string;
  prevues: number;
  prises: number;
  manquees: number;
}

export interface ResumeObservance {
  taux7: number | null;
  taux30: number | null;
  serie: number;
  nonRenseignees30: number;
  jours: JourObservance[];
}

export interface ObservanceResponse {
  date: string;
  journee: PriseDuJour[];
  resume: ResumeObservance;
}

export interface AlerteExamen {
  type: string;
  libelle: string;
  dernierPrelevement: string | null;
  echeance: string;
  statut: 'en_retard' | 'bientot';
  joursRestants: number;
}

export interface AccesDossier {
  id: number;
  action: string;
  date: string;
  acteur: { nom: string; prenom: string; role: string; structure: string | null } | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  signalementCreated: boolean;
}

export const patientApi = {
  getRendezVous: () => api.get<RendezVous[]>('/patients/me/rendez-vous').then((r) => r.data),

  createRendezVous: (input: { motif?: string; dateHeure: string }) =>
    api.post<RendezVous>('/patients/me/rendez-vous', input).then((r) => r.data),

  getTraitements: () => api.get<Traitement[]>('/patients/me/traitements').then((r) => r.data),

  getObservations: () => api.get<Observation[]>('/patients/me/observations').then((r) => r.data),

  getSignalements: () => api.get<Signalement[]>('/patients/me/signalements').then((r) => r.data),

  createSignalement: (input: { symptome: string; gravite: Gravite; notes?: string | undefined }) =>

    api.post<Signalement>('/patients/me/signalements', input).then((r) => r.data),

  getObservance: () => api.get<ObservanceResponse>('/patients/me/observance').then((r) => r.data),

  declarerPrise: (input: { traitementId: number; rang: number; statut: StatutPrise; date?: string | undefined }) =>
    api.post('/patients/me/prises', input).then((r) => r.data),

  getAccesDossier: () => api.get<AccesDossier[]>('/patients/me/acces').then((r) => r.data),

  getCommuniques: () => api.get<Communique[]>('/patients/me/communiques').then((r) => r.data),

  getAlertesExamens: () =>
 api.get<AlerteExamen[]>('/patients/me/alertes-examens').then((r) => r.data),

  sendChatMessage: (messages: ChatMessage[]) =>
    api.post<ChatResponse>('/chat', { messages }).then((r) => r.data),
};
