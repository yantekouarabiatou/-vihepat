import { api } from './client';
import type { RendezVous, Signalement, StatutRDV, StatutSignalement } from './patient.api';

export interface SoignantPatient {
  id: number;
  codePatient: string;
  pathologie: string;
  createdAt: string;
  user: { id: number; nom: string; prenom: string; email: string };
}

export interface SoignantRendezVous extends RendezVous {
  patient: { id: number; codePatient: string; user: { nom: string; prenom: string } };
}

export interface SoignantSignalement extends Signalement {
  patient: { id: number; codePatient: string; user: { nom: string; prenom: string } };
}

export const soignantApi = {
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
