import bcrypt from 'bcrypt';
import { Soignant, Patient, User, Affectation } from '../models';
import type { Pathologie } from '../models/Patient';
import { memoriserVersion } from '../utils/token-version';
import { genererCodePatient } from './auth.service';
import { sendPasswordResetEmail, sendWelcomePatientEmail } from './mail.service';
import { SALT_ROUNDS, httpError, genererMotDePasseTemporaire, getContexte, assertMedecin, assertPatientAffecte } from './soignant-contexte';

/** Ouverture des dossiers patients et remise des accès (mot de passe temporaire, fiche PDF). */

/**
 * Création d'un dossier patient directement par le soignant/l'admin (centre de santé) :
 * utile quand le patient n'a pas encore de compte (pas d'email/smartphone au moment de
 * l'accueil). Le patient est aussitôt rattaché au soignant qui l'a créé. Le mot de passe
 * temporaire généré est remis en main propre — il n'existe aucune capacité d'envoi d'email
 * dans cette version.
 */
export async function creerPatient(
  userId: number,
  input: {
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
) {
  const ctx = await getContexte(userId);
  // Le créateur est aussitôt rattaché au dossier : même règle que le rattachement
  assertMedecin(ctx);

  const exists = await User.findOne({ where: { email: input.email } });
  if (exists) throw httpError(409, 'Email déjà utilisé');

  const motDePasseTemporaire = genererMotDePasseTemporaire();
  const passwordHash = await bcrypt.hash(motDePasseTemporaire, SALT_ROUNDS);

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
    dateDiagnostic: input.dateDiagnostic ? new Date(input.dateDiagnostic) : null,
    sexe: input.sexe ?? null,
    telephone: input.telephone ?? null,
    region: input.region ?? null,
    commune: input.commune ?? null,
    consentementDonne: input.consentementDonne,
    dateConsentement: input.consentementDonne ? new Date() : null,
  });

  let targetSoignantId = ctx.soignant?.id;
  if (ctx.admin && input.soignantId) {
    const s = await Soignant.findByPk(input.soignantId);
    if (s) targetSoignantId = s.id;
  }
  if (!targetSoignantId) {
    const premierSoignant = await Soignant.findOne();
    if (premierSoignant) targetSoignantId = premierSoignant.id;
  }

  if (targetSoignantId) {
    await Affectation.create({ patientId: patient.id, soignantId: targetSoignantId, principal: true });
  }

  // Envoi de l'email de bienvenue avec identifiants sécurisés (Brevo)
  if (user.email) {
    void sendWelcomePatientEmail({
      to: user.email,
      prenom: user.prenom,
      nom: user.nom,
      codePatient: patient.codePatient,
      passwordTemporaire: motDePasseTemporaire,
      structureNom: ctx.soignant?.structure,
    });
  }

  return {
    patient: {
      id: patient.id,
      codePatient: patient.codePatient,
      pathologie: patient.pathologie,
      user: { nom: user.nom, prenom: user.prenom, email: user.email },
    },
    motDePasseTemporaire,
  };
}

export async function reinitialiserAccesPatient(userId: number, patientId: number) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);

  const patient = await Patient.findByPk(patientId, {
    include: [{ model: User, as: 'user' }],
  });
  if (!patient) throw httpError(404, 'Patient introuvable');

  const user = (patient as any).user;
  if (!user) throw httpError(404, 'Compte utilisateur associé introuvable');

  const motDePasseTemporaire = genererMotDePasseTemporaire();
  const passwordHash = await bcrypt.hash(motDePasseTemporaire, SALT_ROUNDS);

  user.passwordHash = passwordHash;
  user.actif = true;
  // Nouveaux accès : les sessions encore ouvertes avec l'ancien mot de passe sont fermées
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  memoriserVersion(user.id, user.tokenVersion);

  // Envoi de l'email de réinitialisation avec les nouveaux accès (Brevo)
  if (user.email) {
    void sendPasswordResetEmail({
      to: user.email,
      prenom: user.prenom,
      nom: user.nom,
      codePatient: patient.codePatient,
      newPassword: motDePasseTemporaire,
      structureNom: ctx.soignant?.structure,
    });
  }

  return {
    patient: {
      id: patient.id,
      codePatient: patient.codePatient,
      pathologie: patient.pathologie,
      telephone: patient.telephone,
      sexe: patient.sexe,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
      },
    },
    motDePasseTemporaire,
  };
}
