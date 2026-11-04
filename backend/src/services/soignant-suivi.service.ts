import { Op } from 'sequelize';
import { Soignant, Patient, User, Affectation, Traitement, BilanInclusion } from '../models';
import { evaluerRisquePatient } from './perte-de-suivi.service';
import { getAlertesExamens, getResumeObservance } from './observance.service';
import { getEtatAgrege } from './rappels.service';
import { resumesSuivi } from './soignant-vue-globale.service';
import type { FonctionSoignant } from '../models/Soignant';
import { httpError, getContexte, assertMedecin, getPatientIds, assertPatientAffecte } from './soignant-contexte';

export * from './soignant-agenda.service';
export * from './soignant-acces.service';

/** Équipe et file active. Rendez-vous, communiqués et signalements : soignant-agenda.service. */

/** Équipe qui suit un patient, et soignants que le médecin peut y ajouter. */
export async function getEquipePatient(userId: number, patientId: number) {
  const ctx = await getContexte(userId);
  await assertPatientAffecte(ctx, patientId);

  const affectations = await Affectation.findAll({
    where: { patientId },
    include: [{
      model: Soignant, as: 'soignant',
      include: [{ model: User, as: 'user', attributes: ['nom', 'prenom', 'email', 'actif'] }],
    }],
    order: [['principal', 'DESC'], ['dateDebut', 'ASC']],
  });
  const membres = affectations.map((a) => {
    const s = (a as any).soignant;
    return {
      soignantId: a.soignantId,
      principal: a.principal,
      depuis: a.dateDebut,
      nom: s?.user?.nom ?? '',
      prenom: s?.user?.prenom ?? '',
      fonction: (s?.fonction ?? 'autre') as FonctionSoignant,
      specialite: s?.specialite ?? null,
      structure: s?.structure ?? '',
      moi: s?.id === ctx.soignant?.id,
    };
  });

  // Candidats : soignants actifs de la même structure (toutes structures pour l'admin)
  let candidats: Array<{ soignantId: number; nom: string; prenom: string; fonction: FonctionSoignant; structure: string }> = [];
  if (ctx.medecin) {
    const dejaLa = membres.map((m) => m.soignantId);
    const soignants = await Soignant.findAll({
      where: {
        id: { [Op.notIn]: dejaLa.length ? dejaLa : [0] },
        ...(ctx.admin || !ctx.soignant ? {} : { structure: ctx.soignant.structure }),
      },
      include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'], where: { actif: true, role: 'soignant' } }],
      order: [['fonction', 'ASC']],
    });
    candidats = soignants.map((s) => ({
      soignantId: s.id,
      nom: (s as any).user.nom,
      prenom: (s as any).user.prenom,
      fonction: s.fonction,
      structure: s.structure,
    }));
  }
  return { peutGerer: ctx.medecin, membres, candidats };
}

export async function rattacherSoignant(userId: number, patientId: number, soignantId: number) {
  const ctx = await getContexte(userId);
  assertMedecin(ctx);
  await assertPatientAffecte(ctx, patientId);

  const cible = await Soignant.findByPk(soignantId, { include: [{ model: User, as: 'user', attributes: ['actif'] }] });
  if (!cible || !(cible as any).user?.actif) throw httpError(404, 'Soignant introuvable');
  if (!ctx.admin && ctx.soignant && cible.structure !== ctx.soignant.structure) {
    throw httpError(403, "Ce soignant n'appartient pas à votre structure");
  }
  const [, created] = await Affectation.findOrCreate({
    where: { patientId, soignantId },
    defaults: { patientId, soignantId, principal: false },
  });
  if (!created) throw httpError(409, 'Ce soignant suit déjà ce patient');
  return getEquipePatient(userId, patientId);
}

export async function detacherSoignant(userId: number, patientId: number, soignantId: number) {
  const ctx = await getContexte(userId);
  assertMedecin(ctx);
  await assertPatientAffecte(ctx, patientId);
  if (!ctx.admin && ctx.soignant?.id === soignantId) {
    throw httpError(400, 'Vous ne pouvez pas vous retirer vous-même du suivi');
  }
  const affectation = await Affectation.findOne({ where: { patientId, soignantId } });
  if (!affectation) throw httpError(404, 'Ce soignant ne suit pas ce patient');
  await affectation.destroy();
  return getEquipePatient(userId, patientId);
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
      { model: BilanInclusion, as: 'bilanInclusion', required: false },
    ],
    order: [['createdAt', 'DESC']],
  });

  // Indicateurs de suivi pour repérer rapidement les patients qui décrochent
  const suivis = await resumesSuivi(patients.map((p) => p.id));
  return Promise.all(
    patients.map(async (p) => {
      const [resume, alertes, rappels] = await Promise.all([
        getResumeObservance(p.id),
        getAlertesExamens(p.id, p.pathologie),
        getEtatAgrege(p.id),
      ]);
      // Le bilan lui-même n'est pas utile à la liste : seul le niveau de risque est renvoyé
      const { bilanInclusion: _bilan, ...patient } = p.toJSON() as any;
      const risque = evaluerRisquePatient(p, (p as any).bilanInclusion);
      return {
        ...patient,
        observance: { taux7: resume.taux7, taux30: resume.taux30 },
        risquePerteSuivi: risque.statut === 'calcule' ? { niveau: risque.niveau, probabilite: risque.probabilite } : null,
        examensEnRetard: alertes.filter((a) => a.statut === 'en_retard').length,
        // Aide à la priorisation seulement : aucune décision automatique
        rappelsARegarder: rappels.aRegarder,
        // Vue globale : prochain et dernier rendez-vous, soignants attribués
        ...suivis.get(p.id),
      };
    })
  );
}
