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

export type CibleCommunique = 'tous' | 'patient';

export interface Communique {
  id: number;
  soignantId: number;
  titre: string;
  contenu: string;
  cible: CibleCommunique;
  patientId: number | null;
  createdAt: string;
  patient?: { id: number; user: { nom: string; prenom: string } } | null;
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

export interface CreatePatientInput {
  email: string;
  nom: string;
  prenom: string;
  pathologie: Pathologie;
  sexe?: 'M' | 'F';
  telephone?: string;
  region?: string;
  commune?: string;
  dateNaissance?: string;
  dateDiagnostic?: string;
  languePreferee?: string;
  consentementDonne: boolean;
  soignantId?: number;
}

export interface CreatePatientResult {
  patient: {
    id: number;
    codePatient: string;
    pathologie: string;
    user: { nom: string; prenom: string; email: string };
  };
  motDePasseTemporaire: string;
}

export interface UpdatePatientInput {
  nom?: string;
  prenom?: string;
  email?: string;
  pathologie?: Pathologie;
  sexe?: 'M' | 'F' | null;
  telephone?: string | null;
  region?: string | null;
  commune?: string | null;
  languePreferee?: string;
  dateNaissance?: string | null;
  dateDiagnostic?: string | null;
}

export const soignantApi = {
  rattacherPatient: (codePatient: string) =>
    api.post<SoignantPatient>('/soignant/patients/rattacher', { codePatient }).then((r) => r.data),

  creerPatient: (input: CreatePatientInput) =>
    api.post<CreatePatientResult>('/soignant/patients', input).then((r) => r.data),

  updatePatient: (id: number, input: UpdatePatientInput) =>
    api.patch<PatientDetail>(`/soignant/patients/${id}`, input).then((r) => r.data),

  reinitialiserAcces: (id: number) =>
    api.post<CreatePatientResult>(`/soignant/patients/${id}/reinitialiser-acces`).then((r) => r.data),

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

  createRendezVous: (input: { patientId: number; dateHeure: string; motif?: string }) =>
    api.post<SoignantRendezVous>('/soignant/rendez-vous', input).then((r) => r.data),

  envoyerRappelRdv: (id: number) =>
    api.post<SoignantRendezVous>(`/soignant/rendez-vous/${id}/rappel`).then((r) => r.data),

  updateRendezVous: (id: number, input: { statut?: StatutRDV; notes?: string }) =>
    api.patch<SoignantRendezVous>(`/soignant/rendez-vous/${id}`, input).then((r) => r.data),

  getCommuniques: () => api.get<Communique[]>('/soignant/communiques').then((r) => r.data),

  createCommunique: (input: { titre: string; contenu: string; cible: CibleCommunique; patientId?: number }) =>
    api.post<Communique>('/soignant/communiques', input).then((r) => r.data),

  getSignalements: (statut?: StatutSignalement) =>
    api
      .get<SoignantSignalement[]>('/soignant/signalements', { params: statut ? { statut } : undefined })
      .then((r) => r.data),

  updateSignalement: (id: number, statut: 'vu' | 'traite') =>
    api.patch<SoignantSignalement>(`/soignant/signalements/${id}`, { statut }).then((r) => r.data),
};
