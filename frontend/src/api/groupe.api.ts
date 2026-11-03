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

export interface GroupesMembre {
  /** Le nom sous lequel les autres membres voient le patient (initiales + nom généré) */
  monPseudo: string;
  groupes: Groupe[];
}

export type TypeReaction = 'soutien' | 'merci';
export type MotifSignalementMessage = 'propos_blessants' | 'mauvais_conseil' | 'coordonnees' | 'autre';

export interface MessageGroupe {
  id: number;
  contenu: string;
  createdAt: string;
  /** Pseudonyme de l'auteur, jamais son prénom */
  auteur: string;
  deMoi: boolean;
  /** Masqué par l'équipe soignante (visible de son seul auteur) */
  masque?: boolean;
  /** Réponse à un envoi : le message laisse penser à une détresse, on affiche les numéros d'aide */
  soutien?: boolean;
  /** Message auquel celui-ci répond (extrait null si ce message a été masqué) */
  reponseA?: { id: number; auteur: string; extrait: string | null } | null;
  reactions?: { soutien: number; merci: number; miennes: TypeReaction[] };
  signaleParMoi?: boolean;
}

export const groupeApi = {
  getGroupes: () => api.get<GroupesMembre>('/patients/me/groupes').then((r) => r.data),

  rejoindre: (groupeId: number) =>
    api.post(`/patients/me/groupes/${groupeId}/rejoindre`).then((r) => r.data),

  getMessages: (groupeId: number) =>
    api.get<MessageGroupe[]>(`/patients/me/groupes/${groupeId}/messages`).then((r) => r.data),

  postMessage: (groupeId: number, contenu: string, reponseA?: number | null) =>
    api.post<MessageGroupe>(`/patients/me/groupes/${groupeId}/messages`, { contenu, reponseA: reponseA ?? null }).then((r) => r.data),

  reagir: (messageId: number, type: TypeReaction) =>
    api.post<{ actif: boolean }>(`/patients/me/groupes/messages/${messageId}/reactions`, { type }).then((r) => r.data),

  signaler: (messageId: number, motif: MotifSignalementMessage, commentaire?: string) =>
    api.post(`/patients/me/groupes/messages/${messageId}/signaler`, { motif, ...(commentaire ? { commentaire } : {}) }).then((r) => r.data),
};
