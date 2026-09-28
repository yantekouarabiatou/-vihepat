import type { Role } from "@/store/auth.store";

export type Permission =
  // Gestion des dossiers patients
  | 'patient:create'
  | 'patient:read_all'
  | 'patient:read_assigned'
  | 'patient:read_own'
  | 'patient:update'
  | 'patient:attach'
  // Données médicales et prescriptions
  | 'observation:create'
  | 'observation:read'
  | 'traitement:manage'
  | 'traitement:read'
  // Observance et déclarations de prises
  | 'observance:declare'
  | 'observance:read'
  // Rendez-vous
  | 'rendez_vous:manage'
  | 'rendez_vous:request'
  // Signalements et alertes
  | 'signalement:create'
  | 'signalement:manage'
  // Communautés et échanges
  | 'groupe:participate'
  | 'communique:publish'
  | 'communique:read'
  // Administration et sécurité
  | 'user:manage'
  | 'role:assign'
  | 'user:toggle_status'
  | 'audit:read'
  | 'structure:manage';

export interface PermissionDefinition {
  key: Permission;
  label: string;
  category: 'patients' | 'medical' | 'observance' | 'communication' | 'admin';
  description: string;
}

export interface PermissionCategory {
  key: 'patients' | 'medical' | 'observance' | 'communication' | 'admin';
  label: string;
  description: string;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'patients',
    label: 'Dossiers Patients',
    description: 'Ouverture de dossiers, recherche, consultation et rattachement des patients.',
  },
  {
    key: 'medical',
    label: 'Suivi Médical & Biologie',
    description: 'Saisie de la charge virale, CD4, bilans hépatiques et prescriptions thérapeutiques.',
  },
  {
    key: 'observance',
    label: 'Observance & Alertes',
    description: 'Déclaration des prises, gestion des consultations et prise en charge des effets secondaires.',
  },
  {
    key: 'communication',
    label: 'Entraide & Communication',
    description: 'Groupes de soutien entre pairs et diffusion de communiqués de santé publique.',
  },
  {
    key: 'admin',
    label: 'Administration & Sécurité',
    description: 'Gestion des rôles, activation des comptes, journal d\'audit et structures sanitaires.',
  },
];

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Patients
  {
    key: 'patient:create',
    label: 'Création de dossiers patients',
    category: 'patients',
    description: 'Ouverture et création d\'un compte patient (réservé exclusivement aux soignants et administrateurs).',
  },
  {
    key: 'patient:read_all',
    label: 'Consultation globale de tous les patients',
    category: 'patients',
    description: 'Accès sans restriction géographique à l\'ensemble des dossiers de la plateforme.',
  },
  {
    key: 'patient:read_assigned',
    label: 'Consultation de sa file active',
    category: 'patients',
    description: 'Accès aux dossiers des patients affectés au soignant.',
  },
  {
    key: 'patient:read_own',
    label: 'Consultation de son propre dossier',
    category: 'patients',
    description: 'Accès chiffré et sécurisé réservé au patient titulaire du dossier.',
  },
  {
    key: 'patient:update',
    label: 'Modification du dossier patient',
    category: 'patients',
    description: 'Mise à jour des données administratives et paramètres de suivi.',
  },
  {
    key: 'patient:attach',
    label: 'Rattachement d\'un patient existant',
    category: 'patients',
    description: 'Ajout d\'un patient à sa file active via son code d\'identification unique.',
  },

  // Médical
  {
    key: 'observation:create',
    label: 'Saisie de résultats biologiques',
    category: 'medical',
    description: 'Enregistrement de bilans sanguins (charge virale, CD4, créatinine, transaminases, etc.).',
  },
  {
    key: 'observation:read',
    label: 'Consultation de l\'historique biologique',
    category: 'medical',
    description: 'Graphiques d\'évolution et alertes sur les seuils critiques.',
  },
  {
    key: 'traitement:manage',
    label: 'Prescription & arrêt de traitements',
    category: 'medical',
    description: 'Prescription de molécules antirétrovirales, posologie et fréquence.',
  },
  {
    key: 'traitement:read',
    label: 'Visualisation des traitements prescrits',
    category: 'medical',
    description: 'Affichage des médicaments actifs et historiques.',
  },

  // Observance
  {
    key: 'observance:declare',
    label: 'Déclaration des prises quotidiennes',
    category: 'observance',
    description: 'Pointage journalier des comprimés pris ou oubliés.',
  },
  {
    key: 'observance:read',
    label: 'Consultation des taux d\'observance',
    category: 'observance',
    description: 'Analyse sur 7 jours, 30 jours et détection de ruptures.',
  },
  {
    key: 'rendez_vous:manage',
    label: 'Gestion complète des rendez-vous',
    category: 'observance',
    description: 'Planification, confirmation, envoi de rappels SMS/notification.',
  },
  {
    key: 'rendez_vous:request',
    label: 'Demande de consultation',
    category: 'observance',
    description: 'Demande directe d\'un créneau avec son soignant référent.',
  },
  {
    key: 'signalement:create',
    label: 'Signalement d\'effets indésirables',
    category: 'observance',
    description: 'Envoi d\'une alerte clinique suite à un effet secondaire ou symptôme inhabituel.',
  },
  {
    key: 'signalement:manage',
    label: 'Prise en charge des alertes cliniques',
    category: 'observance',
    description: 'Traitement, suivi et clôture des alertes remontées par les patients.',
  },

  // Communication
  {
    key: 'groupe:participate',
    label: 'Groupes de soutien entre pairs',
    category: 'communication',
    description: 'Discussions communautaires anonymisées et partage d\'expérience entre patients.',
  },
  {
    key: 'communique:publish',
    label: 'Publication de communiqués',
    category: 'communication',
    description: 'Diffusion d\'annonces sanitaires à destination de l\'ensemble des patients ou d\'un patient.',
  },
  {
    key: 'communique:read',
    label: 'Lecture des annonces officielles',
    category: 'communication',
    description: 'Réception des campagnes de sensibilisation et consignes de suivi.',
  },

  // Administration
  {
    key: 'user:manage',
    label: 'Gestion globale des utilisateurs',
    category: 'admin',
    description: 'Création, modification et suppression des comptes de la plateforme.',
  },
  {
    key: 'role:assign',
    label: 'Attribution & mutation des rôles',
    category: 'admin',
    description: 'Définition des privilèges (Patient, Soignant, Administrateur).',
  },
  {
    key: 'user:toggle_status',
    label: 'Activation & suspension de comptes',
    category: 'admin',
    description: 'Blocage immédiat d\'un compte ou réactivation d\'un utilisateur.',
  },
  {
    key: 'audit:read',
    label: 'Journal d\'audit et traçabilité',
    category: 'admin',
    description: 'Historique exhaustif de toutes les actions, accès et modifications de données.',
  },
  {
    key: 'structure:manage',
    label: 'Centres de santé & codes d\'habilitation',
    category: 'admin',
    description: 'Gestion des structures partenaires et génération des codes de rattachement soignants.',
  },
];

export interface RoleConfig {
  role: Role;
  name: string;
  badge: string;
  colorClass: string;
  badgeBg: string;
  description: string;
  permissions: Permission[];
}

export const ROLES_CONFIG: Record<Role, RoleConfig> = {
  admin: {
    role: 'admin',
    name: 'Administrateur & Coordinateur',
    badge: 'Administrateur',
    colorClass: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-50 dark:bg-amber-950/40',
    badgeBg: 'bg-amber-500 text-white',
    description:
      'Supervise la plateforme, les structures médicales, gère les habilitations et les comptes utilisateurs, contrôle le journal d\'audit et possède un accès médical transverse.',
    permissions: [
      'patient:create',
      'patient:read_all',
      'patient:read_assigned',
      'patient:update',
      'patient:attach',
      'observation:create',
      'observation:read',
      'traitement:manage',
      'traitement:read',
      'observance:read',
      'rendez_vous:manage',
      'signalement:manage',
      'communique:publish',
      'communique:read',
      'user:manage',
      'role:assign',
      'user:toggle_status',
      'audit:read',
      'structure:manage',
    ],
  },
  soignant: {
    role: 'soignant',
    name: 'Professionnel de Santé (Soignant)',
    badge: 'Soignant',
    colorClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40',
    badgeBg: 'bg-emerald-600 text-white',
    description:
      'Médecin, infirmier ou médiateur rattaché à un centre de santé. Habilité à créer les dossiers patients, prescrire, suivre la biologie et gérer les rendez-vous de sa file active.',
    permissions: [
      'patient:create',
      'patient:read_assigned',
      'patient:update',
      'patient:attach',
      'observation:create',
      'observation:read',
      'traitement:manage',
      'traitement:read',
      'observance:read',
      'rendez_vous:manage',
      'signalement:manage',
      'communique:publish',
      'communique:read',
    ],
  },
  patient: {
    role: 'patient',
    name: 'Patient·e suivi·e',
    badge: 'Patient',
    colorClass: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-50 dark:bg-sky-950/40',
    badgeBg: 'bg-sky-600 text-white',
    description:
      'Personne vivant avec le VIH ou une hépatite. Le compte est créé et délivré par son soignant ou l\'administrateur. Accède strictement à son suivi personnel et à l\'entraide par les pairs.',
    permissions: [
      'patient:read_own',
      'observation:read',
      'traitement:read',
      'observance:declare',
      'observance:read',
      'rendez_vous:request',
      'signalement:create',
      'groupe:participate',
      'communique:read',
    ],
  },
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  const cfg = ROLES_CONFIG[role];
  return cfg ? cfg.permissions.includes(permission) : false;
}
