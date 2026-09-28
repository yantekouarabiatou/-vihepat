import { Role } from '../models/User';
export { Role };

export type Permission =
  // Gestion des dossiers patients
  | 'patient:create'           // Créer un nouveau dossier patient
  | 'patient:read_all'         // Consulter tous les dossiers patients
  | 'patient:read_assigned'    // Consulter les patients de sa file active
  | 'patient:read_own'         // Consulter son propre dossier patient
  | 'patient:update'           // Mettre à jour les données d'un patient
  | 'patient:attach'           // Rattacher un patient à sa file active
  // Données médicales et prescriptions
  | 'observation:create'       // Saisir un bilan biologique (charge virale, CD4, etc.)
  | 'observation:read'         // Consulter les observations biologiques
  | 'traitement:manage'        // Prescrire ou modifier des traitements
  | 'traitement:read'          // Consulter la liste des traitements
  // Observance et déclarations de prises
  | 'observance:declare'       // Déclarer la prise quotidienne de médicaments
  | 'observance:read'          // Consulter les indicateurs d'observance
  // Rendez-vous
  | 'rendez_vous:manage'       // Planifier, confirmer ou annuler des rendez-vous
  | 'rendez_vous:request'      // Demander un rendez-vous (patient)
  // Signalements et alertes
  | 'signalement:create'       // Signaler des symptômes ou effets indésirables
  | 'signalement:manage'       // Traiter et clôturer les signalements médicaux
  // Communautés et échanges
  | 'groupe:participate'       // Participer aux groupes de soutien entre pairs
  | 'communique:publish'       // Rédiger et diffuser des communiqués de santé
  | 'communique:read'          // Lire les communiqués de santé
  // Administration et sécurité
  | 'user:manage'              // Gestion des comptes utilisateurs
  | 'role:assign'              // Attribution et modification des rôles
  | 'user:toggle_status'       // Activer ou suspendre un compte
  | 'audit:read'               // Consulter le journal d'audit de sécurité
  | 'structure:manage';        // Gérer les centres de santé et codes d'habilitation

export interface PermissionDefinition {
  key: Permission;
  label: string;
  category: 'patients' | 'medical' | 'observance' | 'communication' | 'admin';
  description: string;
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Patients
  {
    key: 'patient:create',
    label: 'Création de dossiers patients',
    category: 'patients',
    description: 'Ouverture et initialisation de nouveaux dossiers patients (exclusivement réservé aux soignants et admins).',
  },
  {
    key: 'patient:read_all',
    label: 'Accès global aux patients',
    category: 'patients',
    description: 'Consultation de la totalité des patients de la plateforme.',
  },
  {
    key: 'patient:read_assigned',
    label: 'Accès à la file active',
    category: 'patients',
    description: 'Consultation des patients rattachés au soignant.',
  },
  {
    key: 'patient:read_own',
    label: 'Accès au dossier personnel',
    category: 'patients',
    description: 'Consultation sécurisée de son propre carnet de santé.',
  },
  {
    key: 'patient:update',
    label: 'Modification du dossier patient',
    category: 'patients',
    description: 'Mise à jour des coordonnées et données cliniques.',
  },
  {
    key: 'patient:attach',
    label: 'Rattachement de patient',
    category: 'patients',
    description: 'Rattachement d\'un patient existant à sa file active via son code.',
  },
  // Médical
  {
    key: 'observation:create',
    label: 'Saisie de bilans biologiques',
    category: 'medical',
    description: 'Enregistrement des résultats de charge virale, CD4, ALAT, etc.',
  },
  {
    key: 'observation:read',
    label: 'Consultation des bilans biologiques',
    category: 'medical',
    description: 'Visualisation des courbes biologiques et alertes de suivi.',
  },
  {
    key: 'traitement:manage',
    label: 'Prescription & gestion des traitements',
    category: 'medical',
    description: 'Ajout, modification et arrêt de schémas thérapeutiques.',
  },
  {
    key: 'traitement:read',
    label: 'Consultation des traitements',
    category: 'medical',
    description: 'Visualisation de la prescription active et de l\'historique.',
  },
  // Observance
  {
    key: 'observance:declare',
    label: 'Déclaration des prises médicamenteuses',
    category: 'observance',
    description: 'Pointage quotidien des prises par le patient.',
  },
  {
    key: 'observance:read',
    label: 'Suivi de l\'observance',
    category: 'observance',
    description: 'Calcul du taux d\'observance et identification des ruptures.',
  },
  {
    key: 'rendez_vous:manage',
    label: 'Gestion des rendez-vous',
    category: 'observance',
    description: 'Planification, confirmation et rappels de consultations.',
  },
  {
    key: 'rendez_vous:request',
    label: 'Demande de rendez-vous',
    category: 'observance',
    description: 'Sollicitation d\'un rendez-vous auprès de son équipe de suivi.',
  },
  {
    key: 'signalement:create',
    label: 'Signalement d\'effets indésirables',
    category: 'observance',
    description: 'Déclaration de symptômes ou effets secondaires ressentis.',
  },
  {
    key: 'signalement:manage',
    label: 'Traitement des alertes cliniques',
    category: 'observance',
    description: 'Prise en charge et clôture des signalements remontés par les patients.',
  },
  // Communication
  {
    key: 'groupe:participate',
    label: 'Groupes de soutien entre pairs',
    category: 'communication',
    description: 'Participation anonymisée aux groupes d\'échange et d\'entraide.',
  },
  {
    key: 'communique:publish',
    label: 'Diffusion de communiqués',
    category: 'communication',
    description: 'Publication de messages sanitaires et annonces de santé publique.',
  },
  {
    key: 'communique:read',
    label: 'Lecture des communiqués',
    category: 'communication',
    description: 'Réception des alertes et informations de suivi.',
  },
  // Administration
  {
    key: 'user:manage',
    label: 'Gestion des comptes',
    category: 'admin',
    description: 'Création, modification et suppression des comptes de la plateforme.',
  },
  {
    key: 'role:assign',
    label: 'Attribution des rôles & permissions',
    category: 'admin',
    description: 'Changement de rôle et gestion des habilitations des utilisateurs.',
  },
  {
    key: 'user:toggle_status',
    label: 'Activation & suspension de comptes',
    category: 'admin',
    description: 'Suspension d\'accès ou réactivation en cas de besoin.',
  },
  {
    key: 'audit:read',
    label: 'Consultation du journal d\'audit',
    category: 'admin',
    description: 'Traçabilité complète des actions sensibles et connexions.',
  },
  {
    key: 'structure:manage',
    label: 'Gestion des structures de santé',
    category: 'admin',
    description: 'Création d\'établissements et émission des codes d\'habilitation.',
  },
];

export interface RoleInfo {
  role: Role;
  name: string;
  badge: string;
  description: string;
  permissions: Permission[];
}

export const ROLES_CONFIG: Record<Role, RoleInfo> = {
  admin: {
    role: 'admin',
    name: 'Administrateur & Coordinateur',
    badge: 'Administrateur',
    description:
      'Supervise l\'ensemble de la plateforme, gère les structures de santé, les comptes utilisateurs, les habilitations, l\'audit et dispose d\'un accès médical global.',
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
    description:
      'Médecin, infirmier ou médiateur rattaché à une structure de santé. Habilité à créer les dossiers patients, prescrire, suivre la biologie et gérer les rendez-vous.',
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
    description:
      'Personne suivie pour le VIH et/ou les hépatites. Compte ouvert obligatoirement par son soignant ou l\'administrateur. Accède strictement à son carnet personnel et aux groupes de soutien.',
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

export function hasPermission(role: Role, permission: Permission): boolean {
  const cfg = ROLES_CONFIG[role];
  if (!cfg) return false;
  return cfg.permissions.includes(permission);
}
