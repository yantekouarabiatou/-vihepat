import bcrypt from 'bcrypt';
import { User, Patient, Soignant, Structure } from '../models';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendWelcomeSoignantEmail } from './mail.service';

const SALT_ROUNDS = 12;

export function genererCodePatient(): string {
  const annee = new Date().getFullYear();
  const aleatoire = Math.floor(100000 + Math.random() * 900000);
  return `VHP-${annee}-${aleatoire}`;
}

export async function getStructures() {
  const structures = await Structure.findAll({
    where: { actif: true },
    attributes: ['id', 'nom'],
    order: [['nom', 'ASC']],
  });
  return structures;
}

export async function registerPatient(input: {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  pathologie: 'vih' | 'vhb' | 'vhc' | 'vih_vhb' | 'vih_vhc' | 'vhb_vhc';
  languePreferee?: string;
  dateNaissance?: string;
  sexe?: 'M' | 'F';
  telephone?: string;
  region?: string;
  commune?: string;
  consentementDonne: boolean;
}) {
  const exists = await User.findOne({ where: { email: input.email } });
  if (exists) {
    const e: any = new Error('Email déjà utilisé');
    e.status = 409;
    throw e;
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    email: input.email,
    passwordHash,
    role: 'patient',
    nom: input.nom,
    prenom: input.prenom,
    actif: true,
  });

  const patient = await Patient.create({
    userId: user.id,
    codePatient: genererCodePatient(),
    pathologie: input.pathologie,
    languePreferee: input.languePreferee ?? 'fr',
    dateNaissance: input.dateNaissance ? new Date(input.dateNaissance) : null,
    sexe: input.sexe ?? null,
    telephone: input.telephone ?? null,
    region: input.region ?? null,
    commune: input.commune ?? null,
    consentementDonne: input.consentementDonne,
    dateConsentement: input.consentementDonne ? new Date() : null,
  });

  const payload = { userId: user.id, role: user.role };
  return {
    user: {
      id: user.id, email: user.email, nom: user.nom,
      prenom: user.prenom, role: user.role,
    },
    patient: {
      id: patient.id, codePatient: patient.codePatient,
      pathologie: patient.pathologie,
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function registerSoignant(input: {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  matricule: string;
  structureId: number;
  codeInvitation: string;
  specialite?: string;
  telephone?: string;
}) {
  const exists = await User.findOne({ where: { email: input.email } });
  if (exists) {
    const e: any = new Error('Email déjà utilisé');
    e.status = 409;
    throw e;
  }

  const structure = await Structure.findOne({ where: { id: input.structureId, actif: true } });
  if (!structure) {
    const e: any = new Error('Structure introuvable');
    e.status = 404;
    throw e;
  }
  if (structure.codeInvitation !== input.codeInvitation) {
    const e: any = new Error("Code d'habilitation invalide. Demandez-le à votre structure de santé.");
    e.status = 403;
    throw e;
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    email: input.email,
    passwordHash,
    role: 'soignant',
    nom: input.nom,
    prenom: input.prenom,
    actif: true,
  });

  // Le nom de la structure est dénormalisé sur Soignant (affiché partout côté UI) ;
  // seul le code d'habilitation, propre à chaque Structure, est vérifié plus haut.
  const soignant = await Soignant.create({
    userId: user.id,
    matricule: input.matricule,
    structure: structure.nom,
    specialite: input.specialite ?? null,
    telephone: input.telephone ?? null,
  });

  // Envoi de l'email de bienvenue pour le soignant (Brevo)
  void sendWelcomeSoignantEmail({
    to: user.email,
    prenom: user.prenom,
    nom: user.nom,
    matricule: input.matricule,
    structureNom: structure.nom,
  });

  const payload = { userId: user.id, role: user.role };
  return {
    user: {
      id: user.id, email: user.email, nom: user.nom,
      prenom: user.prenom, role: user.role,
    },
    soignant: {
      id: soignant.id, matricule: soignant.matricule,
      structure: soignant.structure,
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({
    where: { email, actif: true },
    include: [
      { model: Patient, as: 'patient', required: false },
      { model: Soignant, as: 'soignant', required: false },
    ],
  });

  if (!user) {
    const e: any = new Error('Identifiants invalides');
    e.status = 401;
    throw e;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const e: any = new Error('Identifiants invalides');
    e.status = 401;
    throw e;
  }

  user.derniereConnexion = new Date();
  await user.save();

  const payload = { userId: user.id, role: user.role };
  return {
    user: {
      id: user.id, email: user.email, nom: user.nom,
      prenom: user.prenom, role: user.role,
      patient: (user as any).patient ?? null,
      soignant: (user as any).soignant ?? null,
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    const e: any = new Error('Refresh token invalide');
    e.status = 401;
    throw e;
  }
  const user = await User.findByPk(payload.userId);
  if (!user || !user.actif) {
    const e: any = new Error('Utilisateur introuvable');
    e.status = 401;
    throw e;
  }
  const newPayload = { userId: user.id, role: user.role };
  return {
    accessToken: signAccessToken(newPayload),
    refreshToken: signRefreshToken(newPayload),
  };
}

export async function me(userId: number) {
  const user = await User.findByPk(userId, {
    include: [
      { model: Patient, as: 'patient', required: false },
      { model: Soignant, as: 'soignant', required: false },
    ],
  });
  if (!user) {
    const e: any = new Error('Utilisateur introuvable');
    e.status = 404;
    throw e;
  }
  return {
    id: user.id, email: user.email, nom: user.nom,
    prenom: user.prenom, role: user.role,
    patient: (user as any).patient ?? null,
    soignant: (user as any).soignant ?? null,
  };
}