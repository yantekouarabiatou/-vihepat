import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, Patient, Soignant, Structure } from '../models';
import type { FonctionSoignant } from '../models/Soignant';
import { env } from '../config/env';
import { memoriserVersion } from '../utils/token-version';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendPasswordChangedEmail, sendPasswordResetLinkEmail, sendWelcomeSoignantEmail } from './mail.service';

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

  const payload = { userId: user.id, role: user.role, tv: user.tokenVersion ?? 0 };
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
  fonction: FonctionSoignant;
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
    fonction: input.fonction,
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

  const payload = { userId: user.id, role: user.role, tv: user.tokenVersion ?? 0 };
  return {
    user: {
      id: user.id, email: user.email, nom: user.nom,
      prenom: user.prenom, role: user.role,
    },
    soignant: {
      id: soignant.id, matricule: soignant.matricule,
      structure: soignant.structure, fonction: soignant.fonction,
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

  const payload = { userId: user.id, role: user.role, tv: user.tokenVersion ?? 0 };
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
  // Mot de passe changé depuis : cette session a été fermée
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    const e: any = new Error('Session expirée');
    e.status = 401;
    e.code = 'SESSION_REVOKED';
    throw e;
  }
  const newPayload = { userId: user.id, role: user.role, tv: user.tokenVersion ?? 0 };
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
// ---------------------------------------------------------------------------
// Mot de passe : changement, oubli, réinitialisation
// ---------------------------------------------------------------------------

/** Durée de validité d'un lien « mot de passe oublié ». */
const DUREE_LIEN_REINIT_MS = 30 * 60 * 1000;

function erreur(status: number, code: string, message: string) {
  const e: any = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function empreinteJeton(jeton: string) {
  return crypto.createHash('sha256').update(jeton).digest('hex');
}

/** Langue des e-mails neutres : celle choisie par le patient, sinon le français. */
async function langueDe(user: User): Promise<string> {
  if (user.role !== 'patient') return 'fr';
  const patient = await Patient.findOne({ where: { userId: user.id }, attributes: ['languePreferee'] });
  return patient?.languePreferee ?? 'fr';
}

/**
 * Changement par l'utilisateur connecté. Vérifie le mot de passe actuel, refuse un
 * nouveau mot de passe identique, puis incrémente la version des jetons : toutes les
 * autres sessions sont fermées. De nouveaux jetons sont renvoyés pour la session courante.
 */
export async function changerMotDePasse(userId: number, actuel: string, nouveau: string) {
  const user = await User.findByPk(userId);
  if (!user || !user.actif) throw erreur(401, 'SESSION_REVOKED', 'Session expirée');

  // 400 (et non 401) : une erreur de saisie ne doit pas déconnecter l'utilisateur
  if (!(await bcrypt.compare(actuel, user.passwordHash))) {
    throw erreur(400, 'CURRENT_PASSWORD_INVALID', 'Mot de passe actuel incorrect');
  }
  if (await bcrypt.compare(nouveau, user.passwordHash)) {
    throw erreur(400, 'PASSWORD_UNCHANGED', "Le nouveau mot de passe doit être différent de l'ancien");
  }

  user.passwordHash = await bcrypt.hash(nouveau, SALT_ROUNDS);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.resetTokenHash = null;
  user.resetTokenExpire = null;
  await user.save();
  memoriserVersion(user.id, user.tokenVersion);

  void sendPasswordChangedEmail({ to: user.email, langue: await langueDe(user) });

  const payload = { userId: user.id, role: user.role, tv: user.tokenVersion };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/**
 * « Mot de passe oublié ». Ne révèle jamais si un compte existe : l'appelant répond
 * toujours la même chose. Seule l'empreinte du jeton est conservée en base.
 * Retourne l'identifiant du compte concerné (pour le journal d'audit) ou null.
 */
export async function demanderReinitialisation(email: string): Promise<number | null> {
  const user = await User.findOne({ where: { email, actif: true } });
  if (!user) return null;

  const jeton = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = empreinteJeton(jeton);
  user.resetTokenExpire = new Date(Date.now() + DUREE_LIEN_REINIT_MS);
  await user.save();

  const base = env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173';
  void sendPasswordResetLinkEmail({
    to: user.email,
    lien: `${base}/reinitialiser?jeton=${jeton}`,
    langue: await langueDe(user),
  });
  return user.id;
}

/** Fin du parcours « mot de passe oublié » : lien à usage unique, sessions existantes fermées. */
export async function reinitialiserMotDePasse(jeton: string, nouveau: string): Promise<number> {
  const user = await User.findOne({
    where: { resetTokenHash: empreinteJeton(jeton), resetTokenExpire: { [Op.gt]: new Date() }, actif: true },
  });
  if (!user) throw erreur(400, 'RESET_LINK_INVALID', 'Lien invalide ou expiré');

  user.passwordHash = await bcrypt.hash(nouveau, SALT_ROUNDS);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.resetTokenHash = null;
  user.resetTokenExpire = null;
  await user.save();
  memoriserVersion(user.id, user.tokenVersion);

  void sendPasswordChangedEmail({ to: user.email, langue: await langueDe(user) });
  return user.id;
}
