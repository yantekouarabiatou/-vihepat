import { api } from './client';
import type {
  AlerteExamen, Observation, Pathologie, RendezVous, ResumeObservance, Signalement, StatutRDV,
  StatutSignalement, Traitement,
} from './patient.api';
import type { TypeObservation } from '@/lib/observations';

export interface SoignantPatient {
  id: number;
  codePatient: string;
  pathologie: string;
  createdAt: string;
  user: { id: number; nom: string; prenom: string; email: string };
  observance?: { taux7: number | null; taux30: number | null };
  examensEnRetard?: number;
}

export interface SoignantRendezVous extends RendezVous {
  patient: { id: number; codePatient: string; user: { nom: string; prenom: string } };
}

export interface SoignantSignalement extends Signalement {
  patient: { id: number; codePatient: string; user: { nom: string; prenom: string } };
}

export interface ObservationDetail extends Observation {
  soignantId: number;
  createdAt: string;
  soignant?: { id: number; structure: string; user: { nom: string; prenom: string } } | null;
}

export interface PatientDetail {
  id: number;
  codePatient: string;
  pathologie: Pathologie;
  dateNaissance: string | null;
  sexe: 'M' | 'F' | null;
  telephone: string | null;
  region: string | null;
  commune: string | null;
  languePreferee: string;
  dateDiagnostic: string | null;
  createdAt: string;
  user: { id: number; nom: string; prenom: string; email: string };
  traitements: Traitement[];
  observations: ObservationDetail[];
  signalements: Signalement[];
  rendezVous: RendezVous[];
  observance: ResumeObservance;
  alertesExamens: AlerteExamen[];
}


export interface CreateObservationInput {
  type: TypeObservation;
  valeur: number;
  unite: string;
  datePrelevement: string;
  commentaire?: string | undefined;
}

export interface CreateTraitementInput {
  molecule: string;
  dosage?: string | undefined;
  frequence: string;
  heurePrise?: string | undefined;
  dateDebut: string;
  dateFin?: string | undefined;
  notes?: string | undefined;
}

export interface UpdateTraitementInput {
  molecule?: string;
  dosage?: string | null;
  frequence?: string;
  heurePrise?: string | null;
  dateFin?: string | null;
  actif?: boolean;
  notes?: string | null;
}

export const soignantApi = {
  rattacherPatient: (codePatient: string) =>
    api.post<SoignantPatient>('/soignant/patients/rattacher', { codePatient }).then((r) => r.data),

  getPatient: (id: number) =>
    api.get<PatientDetail>(`/soignant/patients/${id}`).then((r) => r.data),

  createObservation: (patientId: number, input: CreateObservationInput) =>
    api.post<ObservationDetail>(`/soignant/patients/${patientId}/observations`, input).then((r) => r.data),

  createTraitement: (patientId: number, input: CreateTraitementInput) =>
    api.post<Traitement>(`/soignant/patients/${patientId}/traitements`, input).then((r) => r.data),

  updateTraitement: (id: number, input: UpdateTraitementInput) =>
    api.patch<Traitement>(`/soignant/traitements/${id}`, input).then((r) => r.data),


  getPatients: (search?: string) =>
    api
      .get<SoignantPatient[]>('/soignant/patients', { params: search ? { search } : undefined })
      .then((r) => r.data),

  getRendezVous: () => api.get<SoignantRendezVous[]>('/soignant/rendez-vous').then((r) => r.data),

  updateRendezVous: (id: number, input: { statut?: StatutRDV; notes?: string }) =>
    api.patch<SoignantRendezVous>(`/soignant/rendez-vous/${id}`, input).then((r) => r.data),

  getSignalements: (statut?: StatutSignalement) =>
    api
      .get<SoignantSignalement[]>('/soignant/signalements', { params: statut ? { statut } : undefined })
      .then((r) => r.data),

  updateSignalement: (id: number, statut: 'vu' | 'traite') =>
    api.patch<SoignantSignalement>(`/soignant/signalements/${id}`, { statut }).then((r) => r.data),
};
