import { api } from './client';
import type { Pathologie } from './patient.api';

export interface Groupe {
  id: number;
  nom: string;
  description: string;
  pathologie: Pathologie | null;
  estMembre: boolean;
  nbMembres: number;
}

export interface MessageGroupe {
  id: number;
  contenu: string;
  createdAt: string;
  auteur: string;
  deMoi: boolean;
}

export const groupeApi = {
  getGroupes: () => api.get<Groupe[]>('/patients/me/groupes').then((r) => r.data),

  rejoindre: (groupeId: number) =>
    api.post(`/patients/me/groupes/${groupeId}/rejoindre`).then((r) => r.data),

  getMessages: (groupeId: number) =>
    api.get<MessageGroupe[]>(`/patients/me/groupes/${groupeId}/messages`).then((r) => r.data),

  postMessage: (groupeId: number, contenu: string) =>
    api.post<MessageGroupe>(`/patients/me/groupes/${groupeId}/messages`, { contenu }).then((r) => r.data),
};
