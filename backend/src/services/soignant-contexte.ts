import { Soignant, Patient, User, Affectation } from '../models';
import { roleAPermission } from './permissions.service';
import { sendNouvelleInfoEmail } from './mail.service';


/** Contexte d'accès et utilitaires du service soignant (découpé pour l'hébergement). */

export const SALT_ROUNDS = 12;

export function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/** Mot de passe temporaire lisible, remis en main propre au patient par le soignant/l'admin qui crée son dossier. */
export function genererMotDePasseTemporaire(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let mdp = '';
  for (let i = 0; i < 10; i++) mdp += alphabet[Math.floor(Math.random() * alphabet.length)];
  return mdp;
}

/**
 * Contexte d'accès d'un soignant : un `admin` voit et gère l'ensemble des patients.
 * `medecin` : peut ouvrir des dossiers et rattacher des soignants à ses patients.
 */
export interface Contexte { soignant?: Soignant | null; admin: boolean; medecin: boolean; user: User; }

export async function getContexte(userId: number): Promise<Contexte> {
  const [soignant, user] = await Promise.all([
    Soignant.findOne({ where: { userId } }),
    User.findByPk(userId),
  ]);
  if (!user) throw httpError(404, 'Utilisateur introuvable');
  // Accès à toute la patientèle : permission `patient:read_all` (le super admin par défaut) ou fonction
  // médecin. Le médecin suit tous les patients et gère comme l'admin ; les autres soignants, leur équipe.
  const medecinSoignant = soignant?.fonction === 'medecin';
  const admin = roleAPermission(user.role, 'patient:read_all') || medecinSoignant;
  if (!soignant && !admin) {
    throw httpError(403, 'Profil soignant ou administrateur introuvable');
  }
  const medecin = admin || medecinSoignant;
  return { soignant: soignant ?? null, admin, medecin, user };
}

/** Rattacher un patient à une équipe est une décision médicale : réservée au médecin (et à l'admin). */
export function assertMedecin(ctx: Contexte) {
  if (!ctx.medecin) {
    throw httpError(403, 'Seul le médecin peut rattacher un patient ou un soignant');
  }
}

/** Avertit le patient, sans aucun détail médical (la boîte mail peut être lue par l'entourage). */
export async function avertirPatient(patientId: number) {
  const patient = await Patient.findByPk(patientId, { include: [{ model: User, as: 'user', attributes: ['email', 'actif'] }] });
  const user = (patient as any)?.user;
  if (!patient || !user?.email || !user.actif) return;
  void sendNouvelleInfoEmail({ to: user.email, langue: patient.languePreferee ?? 'fr' });
}

export async function getSoignantOrThrow(userId: number): Promise<Soignant> {
  const ctx = await getContexte(userId);
  if (!ctx.soignant) {
    throw httpError(400, 'Cette action nécessite un profil soignant actif');
  }
  return ctx.soignant;
}

export async function getPatientIds(ctx: Contexte) {
  if (ctx.admin) {
    const tous = await Patient.findAll({ attributes: ['id'] });
    return tous.map((p) => p.id);
  }
  if (!ctx.soignant) return [];
  const affectations = await Affectation.findAll({ where: { soignantId: ctx.soignant.id } });
  return affectations.map((a) => a.patientId);
}

/** Vérifie que le patient est bien affecté à ce soignant (séparation des rôles) — un admin passe toujours. */
export async function assertPatientAffecte(ctx: Contexte, patientId: number) {
  if (ctx.admin) {
    const patient = await Patient.findByPk(patientId);
    if (!patient) throw httpError(404, 'Patient introuvable');
    return patient;
  }
  if (!ctx.soignant) throw httpError(403, 'Accès refusé');
  const affectation = await Affectation.findOne({ where: { soignantId: ctx.soignant.id, patientId } });
  if (!affectation) throw httpError(404, 'Patient introuvable ou non affecté');
  return affectation;
}
