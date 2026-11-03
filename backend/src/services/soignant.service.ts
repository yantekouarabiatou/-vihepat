import { Soignant, Patient, User, Affectation, RendezVous, Signalement, Observation, Traitement, BilanInclusion } from '../models';
import type { BilanInclusionAttributes } from '../models/BilanInclusion';
import { evaluerRisquePatient } from './perte-de-suivi.service';
import type { TypeObservation } from '../models/Observation';
import type { Pathologie } from '../models/Patient';
import { getAlertesExamens, getResumeObservance } from './observance.service';
import { getEtatAgrege } from './rappels.service';
import { httpError, getContexte, assertMedecin, avertirPatient, getSoignantOrThrow, assertPatientAffecte } from './soignant-contexte';

export * from './soignant-suivi.service';

/** Profil du soignant connecté : l'interface s'adapte à sa fonction. */
export async function getMonProfil(userId: number) {
  const ctx = await getContexte(userId);
  return {
    fonction: ctx.soignant?.fonction ?? null,
    structure: ctx.soignant?.structure ?? null,
    medecin: ctx.medecin,
    admin: ctx.admin,
  };
}

export async function rattacherPatient(userId: number, codePatient: string) {
  assertMedecin(await getContexte(userId));
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

export async function getPatientDetail(userId: number, patientId: number) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);

  const patient = await Patient.findByPk(patientId, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'nom', 'prenom', 'email'] },
      {
        model: Traitement, as: 'traitements', separate: true, order: [['actif', 'DESC'], ['dateDebut', 'DESC']],
        include: [{
          model: Soignant, as: 'prescripteur', attributes: ['id', 'fonction'],
          include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
        }],
      },
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
      { model: BilanInclusion, as: 'bilanInclusion', required: false },
    ],
  });
  if (!patient) throw httpError(404, 'Patient introuvable');
  const bilan = (patient as any).bilanInclusion as BilanInclusion | null;

  const [observance, alertesExamens, rappels] = await Promise.all([
    getResumeObservance(patient.id),
    getAlertesExamens(patient.id, patient.pathologie),
    getEtatAgrege(patient.id),
  ]);
  return {
    ...patient.toJSON(), observance, alertesExamens, rappels,
    // Aide à la priorisation des relances : le soignant décide
    risquePerteSuivi: evaluerRisquePatient(patient, bilan),
  };
}

export type SaisieBilanInclusion = Omit<BilanInclusionAttributes, 'id' | 'patientId' | 'soignantId' | 'dateBilan'> & {
  dateBilan?: string | null;
};

/** Saisie ou correction du bilan d'inclusion (une fiche par patient) : le score est recalculé à la lecture. */
export async function enregistrerBilanInclusion(userId: number, patientId: number, input: SaisieBilanInclusion) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw httpError(404, 'Patient introuvable');

  const valeurs = {
    ...input,
    dateBilan: input.dateBilan ? new Date(input.dateBilan) : null,
    soignantId: ctx.soignant?.id ?? null,
  };
  const existant = await BilanInclusion.findOne({ where: { patientId } });
  if (existant) await existant.update(valeurs);
  else await BilanInclusion.create({ ...valeurs, patientId });
  return getPatientDetail(userId, patientId);
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
  // Prescription limitée aux patients rattachés au soignant
  await assertPatientAffecte(ctx, patientId);
  const traitement = await Traitement.create({
    patientId,
    prescripteurId: ctx.soignant?.id ?? null,
    molecule: input.molecule,
    dosage: input.dosage ?? null,
    frequence: input.frequence,
    heurePrise: input.heurePrise ?? null,
    dateDebut: new Date(input.dateDebut),
    dateFin: input.dateFin ? new Date(input.dateFin) : null,
    actif: true,
    notes: input.notes ?? null,
  });
  void avertirPatient(patientId);
  return traitement;
}
