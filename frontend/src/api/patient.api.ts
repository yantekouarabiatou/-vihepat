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

export const patientApi = {
  getRendezVous: () => api.get<RendezVous[]>('/patients/me/rendez-vous').then((r) => r.data),

  createRendezVous: (input: { motif?: string; dateHeure: string }) =>
    api.post<RendezVous>('/patients/me/rendez-vous', input).then((r) => r.data),

  getTraitements: () => api.get<Traitement[]>('/patients/me/traitements').then((r) => r.data),

  getObservations: () => api.get<Observation[]>('/patients/me/observations').then((r) => r.data),

  getSignalements: () => api.get<Signalement[]>('/patients/me/signalements').then((r) => r.data),

  createSignalement: (input: { symptome: string; gravite: Gravite; notes?: string }) =>
    api.post<Signalement>('/patients/me/signalements', input).then((r) => r.data),
};
