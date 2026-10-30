import { api } from './client';
import type {
  AlerteExamen, FonctionSoignant, Observation, Pathologie, RendezVous, ResumeObservance, Signalement, StatutRDV,
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
  /** Série de rappels non confirmés : aide à la priorisation, sans décision automatique */
  rappelsARegarder?: boolean;
  /** Null tant qu'aucun bilan d'inclusion n'est saisi (ou hors VIH) */
  risquePerteSuivi?: { niveau: NiveauRisque; probabilite: number } | null;
}

/* Groupes de soutien vus par l'équipe soignante */

export type CategorieAlerteGroupe = 'detresse' | 'traitement' | 'injure' | 'stigmatisation' | 'coordonnees';

export interface GroupeEquipe {
  id: number;
  nom: string;
  description: string;
  pathologie: Pathologie | null;
  actif: boolean;
  nbMembres: number;
  nbMessages: number;
  alertesATraiter: number;
}

export interface MessageGroupeEquipe {
  id: number;
  groupeId: number;
  /** Présent dans la liste des signalements */
  groupe?: string;
  contenu: string;
  createdAt: string;
  /** Prénom, comme les membres le voient */
  auteur: string;
  /** Seulement pour un patient que ce soignant suit (tous pour un admin) */
  patient: { id: number; codePatient: string } | null;
  masque: boolean;
  alerte: { categorie: CategorieAlerteGroupe; mots: string; statut: 'a_traiter' | 'traitee' | null; traiteeLe: string | null } | null;
}

export interface AlertesGroupes {
  aTraiter: MessageGroupeEquipe[];
  traitees: MessageGroupeEquipe[];
}

export type SituationMatrimoniale = 'marie' | 'celibataire' | 'divorce' | 'separe' | 'veuf';
export type NiveauEtudes = 'aucun' | 'primaire' | 'secondaire' | 'superieur';

/** Bilan d'inclusion : entrées du modèle de perte de suivi. Null = examen non réalisé. */
export interface BilanInclusion {
  dateBilan: string | null;
  situationMatrimoniale: SituationMatrimoniale | null;
  niveauEtudes: NiveauEtudes | null;
  stadeOms: number | null;
  cd4: number | null;
  chargeVirale: number | null;
  alat: number | null;
  creatinine: number | null;
  hemoglobine: number | null;
  plaquettes: number | null;
  proteinesTotales: number | null;
  uree: number | null;
  leucocytes: number | null;
}

export type NiveauRisque = 'faible' | 'modere' | 'eleve';

/** Variable du modèle expliquée au soignant (voir backend/src/ia/perte-de-suivi.ts) */
export type VariableRisque =
  | 'Age' | 'annees_exposition' | 'nb_examens_manquants'
  | 'log_ALT' | 'sqrt_CD4' | 'log_Creatin' | 'Hemoglob' | 'log_Platelet' | 'log10_CV' | 'TotProt' | 'log_Urea' | 'log_WBC'
  | 'vih_avance' | 'cv_inf_1000' | 'Sex' | 'MaritalStatus' | 'Education' | 'WHOStage';

export interface FacteurRisque { variable: VariableRisque; contribution: number }

export type RisquePerteSuivi =
  | { statut: 'non_concerne' | 'bilan_absent' | 'indisponible' }
  | {
      statut: 'calcule';
      probabilite: number;
      niveau: NiveauRisque;
      examensManquants: number;
      hausse: FacteurRisque[];
      baisse: FacteurRisque[];
      modele: { version: string; date: string; source: string; seuils: { modere: number; eleve: number } };
    };

/** État agrégé des rappels du patient : jamais le libellé ni l'heure personnelle. */
export interface EtatRappels {
  partage: boolean;
  periodeJours: number;
  prises: { confirmees: number; nonConfirmees: number };
  rendezVous: { confirmees: number; nonConfirmees: number };
  serieNonConfirmees: number;
  aRegarder: boolean;
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
  rappels?: EtatRappels;
  bilanInclusion: (BilanInclusion & { updatedAt: string }) | null;
  risquePerteSuivi: RisquePerteSuivi;
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

export interface MonProfilSoignant {
  fonction: FonctionSoignant | null;
  structure: string | null;
  /** Peut ouvrir des dossiers et rattacher des soignants à ses patients */
  medecin: boolean;
  admin: boolean;
}

export interface MembreEquipe {
  soignantId: number;
  principal: boolean;
  depuis: string;
  nom: string;
  prenom: string;
  fonction: FonctionSoignant;
  specialite: string | null;
  structure: string;
  moi: boolean;
}

export interface EquipePatient {
  peutGerer: boolean;
  membres: MembreEquipe[];
  candidats: Array<{ soignantId: number; nom: string; prenom: string; fonction: FonctionSoignant; structure: string }>;
}

export const soignantApi = {
  getMonProfil: () => api.get<MonProfilSoignant>('/soignant/moi').then((r) => r.data),

  getEquipe: (patientId: number) =>
    api.get<EquipePatient>(`/soignant/patients/${patientId}/equipe`).then((r) => r.data),

  rattacherSoignant: (patientId: number, soignantId: number) =>
    api.post<EquipePatient>(`/soignant/patients/${patientId}/equipe`, { soignantId }).then((r) => r.data),

  detacherSoignant: (patientId: number, soignantId: number) =>
    api.delete<EquipePatient>(`/soignant/patients/${patientId}/equipe/${soignantId}`).then((r) => r.data),

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

  getCommunautes: () => api.get<GroupeEquipe[]>('/soignant/communautes').then((r) => r.data),

  getAlertesCommunautes: () => api.get<AlertesGroupes>('/soignant/communautes/alertes').then((r) => r.data),

  getMessagesCommunaute: (groupeId: number) =>
    api.get<MessageGroupeEquipe[]>(`/soignant/communautes/${groupeId}/messages`).then((r) => r.data),

  modererMessage: (messageId: number, input: { traitee?: boolean; masque?: boolean }) =>
    api.patch<MessageGroupeEquipe>(`/soignant/communautes/messages/${messageId}`, input).then((r) => r.data),

  enregistrerBilanInclusion: (patientId: number, input: BilanInclusion) =>
    api.put<PatientDetail>(`/soignant/patients/${patientId}/bilan-inclusion`, input).then((r) => r.data),

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
