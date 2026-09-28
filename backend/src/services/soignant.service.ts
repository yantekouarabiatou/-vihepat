import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import {
  Soignant, Patient, User, Affectation, RendezVous, Signalement, Observation, Traitement, Communique,
} from '../models';
import type { TypeObservation } from '../models/Observation';
import type { Pathologie } from '../models/Patient';
import { getAlertesExamens, getResumeObservance } from './observance.service';
import { genererCodePatient } from './auth.service';
import { sendPasswordResetEmail, sendWelcomePatientEmail } from './mail.service';

const SALT_ROUNDS = 12;

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/** Mot de passe temporaire lisible, remis en main propre au patient par le soignant/l'admin qui crée son dossier. */
function genererMotDePasseTemporaire(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let mdp = '';
  for (let i = 0; i < 10; i++) mdp += alphabet[Math.floor(Math.random() * alphabet.length)];
  return mdp;
}

/** Contexte d'accès d'un soignant : un `admin` voit et gère l'ensemble des patients. */
interface Contexte { soignant?: Soignant | null; admin: boolean; user: User; }

async function getContexte(userId: number): Promise<Contexte> {
  const [soignant, user] = await Promise.all([
    Soignant.findOne({ where: { userId } }),
    User.findByPk(userId),
  ]);
  if (!user) throw httpError(404, 'Utilisateur introuvable');
  const admin = user.role === 'admin';
  if (!soignant && !admin) {
    throw httpError(403, 'Profil soignant ou administrateur introuvable');
  }
  return { soignant: soignant ?? null, admin, user };
}

async function getSoignantOrThrow(userId: number): Promise<Soignant> {
  const ctx = await getContexte(userId);
  if (!ctx.soignant) {
    throw httpError(400, 'Cette action nécessite un profil soignant actif');
  }
  return ctx.soignant;
}

async function getPatientIds(ctx: Contexte) {
  if (ctx.admin) {
    const tous = await Patient.findAll({ attributes: ['id'] });
    return tous.map((p) => p.id);
  }
  if (!ctx.soignant) return [];
  const affectations = await Affectation.findAll({ where: { soignantId: ctx.soignant.id } });
  return affectations.map((a) => a.patientId);
}

/** Vérifie que le patient est bien affecté à ce soignant (séparation des rôles) — un admin passe toujours. */
async function assertPatientAffecte(ctx: Contexte, patientId: number) {
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

export async function rattacherPatient(userId: number, codePatient: string) {
  const soignant = await getSoignantOrThrow(userId);
  const patient = await Patient.findOne({
    where: { codePatient: codePatient.trim().toUpperCase() },
    include: [{ model: User, as: 'user', attributes: ['id', 'nom', 'prenom', 'email'] }],
  });
  if (!patient) throw httpError(404, 'Aucun patient avec ce code');

  const dejaSuivi = await Affectation.count({ where: { patientId: patient.id } });
  const [, created] = await Affectation.findOrCreate({
    where: { patientId: patient.id, soignantId: soignant.id },
    defaults: { patientId: patient.id, soignantId: soignant.id, principal: dejaSuivi === 0 },
  });
  if (!created) throw httpError(409, 'Ce patient est déjà dans votre file active');
  return patient;
}

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

export async function getPatientDetail(userId: number, patientId: number) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);

  const patient = await Patient.findByPk(patientId, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'nom', 'prenom', 'email'] },
      { model: Traitement, as: 'traitements', separate: true, order: [['actif', 'DESC'], ['dateDebut', 'DESC']] },
      {
        model: Observation,
        as: 'observations',
        separate: true,
        order: [['datePrelevement', 'DESC']],
        include: [{
          model: Soignant, as: 'soignant', attributes: ['id', 'structure'],
          include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
        }],
      },
      { model: Signalement, as: 'signalements', separate: true, order: [['createdAt', 'DESC']], limit: 20 },
      { model: RendezVous, as: 'rendezVous', separate: true, order: [['dateHeure', 'DESC']], limit: 20 },
    ],
  });
  if (!patient) throw httpError(404, 'Patient introuvable');

  const [observance, alertesExamens] = await Promise.all([
    getResumeObservance(patient.id),
    getAlertesExamens(patient.id, patient.pathologie),
  ]);
  return { ...patient.toJSON(), observance, alertesExamens };
}

export async function updatePatient(
  userId: number,
  patientId: number,
  input: {
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
) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);

  const patient = await Patient.findByPk(patientId, {
    include: [{ model: User, as: 'user' }],
  });
  if (!patient) throw httpError(404, 'Patient introuvable');

  const user = (patient as any).user;
  if (user) {
    if (input.nom !== undefined) user.nom = input.nom;
    if (input.prenom !== undefined) user.prenom = input.prenom;
    if (input.email !== undefined && input.email !== user.email) {
      const exists = await User.findOne({ where: { email: input.email } });
      if (exists && exists.id !== user.id) throw httpError(409, 'Email déjà utilisé');
      user.email = input.email;
    }
    await user.save();
  }

  if (input.pathologie !== undefined) patient.pathologie = input.pathologie;
  if (input.sexe !== undefined) patient.sexe = input.sexe;
  if (input.telephone !== undefined) patient.telephone = input.telephone;
  if (input.region !== undefined) patient.region = input.region;
  if (input.commune !== undefined) patient.commune = input.commune;
  if (input.languePreferee !== undefined) patient.languePreferee = input.languePreferee;
  if (input.dateNaissance !== undefined) {
    patient.dateNaissance = input.dateNaissance ? new Date(input.dateNaissance) : null;
  }
  if (input.dateDiagnostic !== undefined) {
    patient.dateDiagnostic = input.dateDiagnostic ? new Date(input.dateDiagnostic) : null;
  }

  await patient.save();
  return getPatientDetail(userId, patientId);
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
  await user.save();

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

export async function createObservation(
  userId: number,
  patientId: number,
  input: {
    type: TypeObservation;
    valeur: number;
    unite: string;
    datePrelevement: string;
    commentaire?: string;
  }
) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);
  const defaultSoignantId = ctx.soignant?.id ?? (await Soignant.findOne())?.id ?? 1;
  return Observation.create({
    patientId,
    soignantId: defaultSoignantId,
    type: input.type,
    valeur: input.valeur,
    unite: input.unite,
    datePrelevement: new Date(input.datePrelevement),
    commentaire: input.commentaire ?? null,
  });
}

export async function createTraitement(
  userId: number,
  patientId: number,
  input: {
    molecule: string;
    dosage?: string;
    frequence: string;
    heurePrise?: string;
    dateDebut: string;
    dateFin?: string;
    notes?: string;
  }
) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);
  return Traitement.create({
    patientId,
    molecule: input.molecule,
    dosage: input.dosage ?? null,
    frequence: input.frequence,
    heurePrise: input.heurePrise ?? null,
    dateDebut: new Date(input.dateDebut),
    dateFin: input.dateFin ? new Date(input.dateFin) : null,
    actif: true,
    notes: input.notes ?? null,
  });
}

export async function updateTraitement(
  userId: number,
  traitementId: number,
  input: {
    molecule?: string;
    dosage?: string | null;
    frequence?: string;
    heurePrise?: string | null;
    dateFin?: string | null;
    actif?: boolean;
    notes?: string | null;
  }
) {
  const ctx = await getContexte(userId);
  const traitement = await Traitement.findByPk(traitementId);
  if (!traitement) throw httpError(404, 'Traitement introuvable');
  await assertPatientAffecte(ctx, traitement.patientId);

  if (input.molecule !== undefined) traitement.molecule = input.molecule;
  if (input.dosage !== undefined) traitement.dosage = input.dosage;
  if (input.frequence !== undefined) traitement.frequence = input.frequence;
  if (input.heurePrise !== undefined) traitement.heurePrise = input.heurePrise;
  if (input.notes !== undefined) traitement.notes = input.notes;
  if (input.dateFin !== undefined) traitement.dateFin = input.dateFin ? new Date(input.dateFin) : null;
  if (input.actif !== undefined) {
    traitement.actif = input.actif;
    // Arrêt d'un traitement : on date la fin si elle n'est pas renseignée
    if (!input.actif && !traitement.dateFin) traitement.dateFin = new Date();
  }
  await traitement.save();
  return traitement;
}


export async function getPatients(userId: number, search?: string) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return [];

  const patients = await Patient.findAll({
    where: { id: { [Op.in]: patientIds } },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'nom', 'prenom', 'email'],
        where: search
          ? {
              [Op.or]: [
                { nom: { [Op.like]: `%${search}%` } },
                { prenom: { [Op.like]: `%${search}%` } },
              ],
            }
          : undefined,
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  // Indicateurs de suivi pour repérer rapidement les patients qui décrochent
  return Promise.all(
    patients.map(async (p) => {
      const [resume, alertes] = await Promise.all([
        getResumeObservance(p.id),
        getAlertesExamens(p.id, p.pathologie),
      ]);
      return {
        ...p.toJSON(),
        observance: { taux7: resume.taux7, taux30: resume.taux30 },
        examensEnRetard: alertes.filter((a) => a.statut === 'en_retard').length,
      };
    })
  );
}

export async function getRendezVous(userId: number) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return [];

  return RendezVous.findAll({
    where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.gte]: new Date() } },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['dateHeure', 'ASC']],
    limit: 20,
  });
}

export async function createRendezVous(
  userId: number,
  input: { patientId: number; dateHeure: string; motif?: string }
) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, input.patientId);
  const soignantId = ctx.soignant
    ? ctx.soignant.id
    : (await Affectation.findOne({ where: { patientId: input.patientId } }))?.soignantId ??
      ((await Soignant.findOne())?.id ?? 1);

  return RendezVous.create({
    patientId: input.patientId,
    soignantId,
    dateHeure: new Date(input.dateHeure),
    motif: input.motif ?? null,
    statut: 'prevu',
  });
}

export async function envoyerRappelRdv(userId: number, rendezVousId: number) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);

  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) {
    const e: any = new Error('Rendez-vous introuvable');
    e.status = 404;
    throw e;
  }
  rdv.rappelEnvoyeLe = new Date();
  await rdv.save();
  return rdv;
}

export async function updateRendezVous(
  userId: number,
  rendezVousId: number,
  input: { statut?: string; notes?: string }
) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);

  const rdv = await RendezVous.findByPk(rendezVousId);
  if (!rdv || !patientIds.includes(rdv.patientId)) {
    const e: any = new Error('Rendez-vous introuvable');
    e.status = 404;
    throw e;
  }

  if (input.statut) rdv.statut = input.statut as any;
  if (input.notes !== undefined) rdv.notes = input.notes;
  if (ctx.soignant) rdv.soignantId = ctx.soignant.id;
  await rdv.save();
  return rdv;
}

export async function getCommuniques(userId: number) {
  const ctx = await getContexte(userId);
  return Communique.findAll({
    where: ctx.admin ? {} : (ctx.soignant ? { soignantId: ctx.soignant.id } : {}),
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
}

export async function createCommunique(
  userId: number,
  input: { titre: string; contenu: string; cible: 'tous' | 'patient'; patientId?: number }
) {
  const ctx = await getContexte(userId);
  if (input.cible === 'patient') {
    if (!input.patientId) throw httpError(400, 'Patient requis pour un communiqué ciblé');
    await assertPatientAffecte(ctx, input.patientId);
  }
  const defaultSoignantId = ctx.soignant?.id ?? (await Soignant.findOne())?.id ?? 1;
  return Communique.create({
    soignantId: defaultSoignantId,
    titre: input.titre,
    contenu: input.contenu,
    cible: input.cible,
    patientId: input.cible === 'patient' ? input.patientId : null,
  });
}

export async function getSignalements(userId: number, statut?: string) {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return [];

  return Signalement.findAll({
    where: {
      patientId: { [Op.in]: patientIds },
      statut: statut ? statut : { [Op.ne]: 'traite' },
    },
    include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
    order: [['createdAt', 'DESC']],
  });
}

export async function updateSignalement(userId: number, signalementId: number, statut: 'vu' | 'traite') {
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);

  const signalement = await Signalement.findByPk(signalementId);
  if (!signalement || !patientIds.includes(signalement.patientId)) {
    const e: any = new Error('Signalement introuvable');
    e.status = 404;
    throw e;
  }

  signalement.statut = statut;
  await signalement.save();
  return signalement;
}
