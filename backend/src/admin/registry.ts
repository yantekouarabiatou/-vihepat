import {
  User, Patient, Soignant, Affectation, Traitement, RendezVous, Observation,
  Signalement, PriseMedicament, AuditLog, Structure, GroupeSoutien, MembreGroupe,
  MessageGroupe, Communique,
} from '../models';

export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'fk' | 'password';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
  fkTable?: string;
}

export interface TableDef {
  key: string;
  label: string;
  model: any;
  fields: FieldDef[];
  allowCreate: boolean;
  allowUpdate: boolean;
  allowDelete: boolean;
}

const OPT_ROLE = [
  { value: 'patient', label: 'Patient' },
  { value: 'soignant', label: 'Soignant' },
  { value: 'admin', label: 'Administrateur' },
];
const OPT_PATHOLOGIE = [
  { value: 'vih', label: 'VIH' }, { value: 'vhb', label: 'Hépatite B' }, { value: 'vhc', label: 'Hépatite C' },
  { value: 'vih_vhb', label: 'VIH + Hépatite B' }, { value: 'vih_vhc', label: 'VIH + Hépatite C' },
  { value: 'vhb_vhc', label: 'Hépatite B + C' },
];
const OPT_SEXE = [{ value: 'M', label: 'Homme' }, { value: 'F', label: 'Femme' }];
const OPT_STATUT_RDV = [
  { value: 'prevu', label: 'Prévu' }, { value: 'confirme', label: 'Confirmé' }, { value: 'effectue', label: 'Effectué' },
  { value: 'manque', label: 'Manqué' }, { value: 'annule', label: 'Annulé' },
];
const OPT_TYPE_OBS = [
  { value: 'charge_virale', label: 'Charge virale' }, { value: 'cd4', label: 'CD4' },
  { value: 'transaminases', label: 'Transaminases' }, { value: 'creatinine', label: 'Créatinine' },
  { value: 'hemoglobine', label: 'Hémoglobine' }, { value: 'ag_hbs', label: 'Ag HBs' },
  { value: 'arn_vhc', label: 'ARN VHC' }, { value: 'autre', label: 'Autre' },
];
const OPT_GRAVITE = [
  { value: 'leger', label: 'Léger' }, { value: 'modere', label: 'Modéré' }, { value: 'severe', label: 'Sévère' },
];
const OPT_STATUT_SIGNALEMENT = [
  { value: 'nouveau', label: 'Nouveau' }, { value: 'vu', label: 'Vu' }, { value: 'traite', label: 'Traité' },
];
const OPT_STATUT_PRISE = [{ value: 'prise', label: 'Prise' }, { value: 'manquee', label: 'Manquée' }];
const OPT_CIBLE = [{ value: 'tous', label: 'Tous les patients' }, { value: 'patient', label: 'Un patient précis' }];

export const ADMIN_TABLES: Record<string, TableDef> = {
  users: {
    key: 'users', label: 'Utilisateurs', model: User, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'role', label: 'Rôle', type: 'select', required: true, options: OPT_ROLE },
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'prenom', label: 'Prénom', type: 'text', required: true },
      { key: 'actif', label: 'Actif', type: 'boolean' },
      { key: 'password', label: 'Mot de passe', type: 'password' },
      { key: 'derniereConnexion', label: 'Dernière connexion', type: 'datetime', readOnly: true },
    ],
  },
  patients: {
    key: 'patients', label: 'Patients', model: Patient, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'userId', label: 'Utilisateur', type: 'fk', fkTable: 'users', required: true },
      { key: 'codePatient', label: 'Code patient', type: 'text', required: true },
      { key: 'pathologie', label: 'Pathologie', type: 'select', required: true, options: OPT_PATHOLOGIE },
      { key: 'dateNaissance', label: 'Date de naissance', type: 'date' },
      { key: 'sexe', label: 'Sexe', type: 'select', options: OPT_SEXE },
      { key: 'telephone', label: 'Téléphone', type: 'text' },
      { key: 'region', label: 'Région', type: 'text' },
      { key: 'commune', label: 'Commune', type: 'text' },
      { key: 'dateDiagnostic', label: 'Date de diagnostic', type: 'date' },
      { key: 'languePreferee', label: 'Langue préférée', type: 'text' },
      { key: 'consentementDonne', label: 'Consentement donné', type: 'boolean' },
      { key: 'dateConsentement', label: 'Date du consentement', type: 'datetime' },
    ],
  },
  soignants: {
    key: 'soignants', label: 'Soignants', model: Soignant, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'userId', label: 'Utilisateur', type: 'fk', fkTable: 'users', required: true },
      { key: 'matricule', label: 'Matricule', type: 'text', required: true },
      { key: 'structure', label: 'Structure', type: 'text', required: true },
      { key: 'specialite', label: 'Spécialité', type: 'text' },
      { key: 'telephone', label: 'Téléphone', type: 'text' },
    ],
  },
  affectations: {
    key: 'affectations', label: 'Affectations', model: Affectation, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'soignantId', label: 'Soignant', type: 'fk', fkTable: 'soignants', required: true },
      { key: 'principal', label: 'Soignant principal', type: 'boolean' },
      { key: 'dateDebut', label: 'Date de début', type: 'date' },
      { key: 'dateFin', label: 'Date de fin', type: 'date' },
    ],
  },
  traitements: {
    key: 'traitements', label: 'Traitements', model: Traitement, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'molecule', label: 'Molécule', type: 'text', required: true },
      { key: 'dosage', label: 'Dosage', type: 'text' },
      { key: 'frequence', label: 'Fréquence', type: 'text', required: true },
      { key: 'heurePrise', label: 'Heure de prise', type: 'text' },
      { key: 'dateDebut', label: 'Date de début', type: 'date', required: true },
      { key: 'dateFin', label: 'Date de fin', type: 'date' },
      { key: 'actif', label: 'Actif', type: 'boolean' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  rendez_vous: {
    key: 'rendez_vous', label: 'Rendez-vous', model: RendezVous, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'soignantId', label: 'Soignant', type: 'fk', fkTable: 'soignants' },
      { key: 'dateHeure', label: 'Date et heure', type: 'datetime', required: true },
      { key: 'motif', label: 'Motif', type: 'text' },
      { key: 'statut', label: 'Statut', type: 'select', options: OPT_STATUT_RDV },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'rappelEnvoyeLe', label: 'Rappel envoyé le', type: 'datetime', readOnly: true },
    ],
  },
  observations: {
    key: 'observations', label: 'Observations', model: Observation, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'soignantId', label: 'Soignant', type: 'fk', fkTable: 'soignants', required: true },
      { key: 'type', label: 'Type', type: 'select', required: true, options: OPT_TYPE_OBS },
      { key: 'valeur', label: 'Valeur', type: 'number', required: true },
      { key: 'unite', label: 'Unité', type: 'text', required: true },
      { key: 'datePrelevement', label: 'Date de prélèvement', type: 'datetime', required: true },
      { key: 'commentaire', label: 'Commentaire', type: 'textarea' },
    ],
  },
  signalements: {
    key: 'signalements', label: 'Signalements', model: Signalement, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'symptome', label: 'Symptôme', type: 'text', required: true },
      { key: 'gravite', label: 'Gravité', type: 'select', required: true, options: OPT_GRAVITE },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'statut', label: 'Statut', type: 'select', options: OPT_STATUT_SIGNALEMENT },
    ],
  },
  prises_medicaments: {
    key: 'prises_medicaments', label: 'Prises de médicaments', model: PriseMedicament,
    allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'traitementId', label: 'Traitement', type: 'fk', fkTable: 'traitements', required: true },
      { key: 'datePrevue', label: 'Date prévue', type: 'date', required: true },
      { key: 'rang', label: 'Rang', type: 'number' },
      { key: 'statut', label: 'Statut', type: 'select', required: true, options: OPT_STATUT_PRISE },
    ],
  },
  audit_logs: {
    key: 'audit_logs', label: "Journal d'audit", model: AuditLog,
    allowCreate: false, allowUpdate: false, allowDelete: true,
    fields: [
      { key: 'userId', label: 'Utilisateur', type: 'fk', fkTable: 'users' },
      { key: 'action', label: 'Action', type: 'text' },
      { key: 'cible', label: 'Cible', type: 'text' },
      { key: 'ip', label: 'IP', type: 'text' },
      { key: 'userAgent', label: 'Agent utilisateur', type: 'text' },
    ],
  },
  structures: {
    key: 'structures', label: 'Structures', model: Structure, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'codeInvitation', label: "Code d'habilitation", type: 'text', required: true },
      { key: 'actif', label: 'Actif', type: 'boolean' },
    ],
  },
  groupes_soutien: {
    key: 'groupes_soutien', label: 'Groupes de soutien', model: GroupeSoutien,
    allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'nom', label: 'Nom', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'pathologie', label: 'Pathologie (optionnel)', type: 'select', options: OPT_PATHOLOGIE },
      { key: 'actif', label: 'Actif', type: 'boolean' },
    ],
  },
  membres_groupe: {
    key: 'membres_groupe', label: 'Membres de groupe', model: MembreGroupe,
    allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'groupeId', label: 'Groupe', type: 'fk', fkTable: 'groupes_soutien', required: true },
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'dateAdhesion', label: "Date d'adhésion", type: 'datetime' },
    ],
  },
  messages_groupe: {
    key: 'messages_groupe', label: 'Messages de groupe', model: MessageGroupe,
    allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'groupeId', label: 'Groupe', type: 'fk', fkTable: 'groupes_soutien', required: true },
      { key: 'patientId', label: 'Patient', type: 'fk', fkTable: 'patients', required: true },
      { key: 'contenu', label: 'Contenu', type: 'textarea', required: true },
    ],
  },
  communiques: {
    key: 'communiques', label: 'Communiqués', model: Communique, allowCreate: true, allowUpdate: true, allowDelete: true,
    fields: [
      { key: 'soignantId', label: 'Auteur', type: 'fk', fkTable: 'soignants', required: true },
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'contenu', label: 'Contenu', type: 'textarea', required: true },
      { key: 'cible', label: 'Cible', type: 'select', required: true, options: OPT_CIBLE },
      { key: 'patientId', label: 'Patient (si ciblé)', type: 'fk', fkTable: 'patients' },
    ],
  },
};

export function getTableDefOrThrow(key: string): TableDef {
  const def = ADMIN_TABLES[key];
  if (!def) {
    const e: any = new Error(`Table inconnue : ${key}`);
    e.status = 404;
    throw e;
  }
  return def;
}
