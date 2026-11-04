import { Op } from 'sequelize';
import { Affectation, Patient, RendezVous, Soignant, User } from '../models';
import { getContexte, getPatientIds, httpError } from './soignant-contexte';

/**
 * Vue globale du soignant : tous les rendez-vous (qui, quand, pourquoi, avec quel soignant) et,
 * pour chaque patient, prochain et dernier rendez-vous et équipe. Le médecin voit toute la
 * patientèle ; les autres soignants, leurs patients attribués (getPatientIds).
 */

const MAX_LIGNES = 2000;

/** Factories : Sequelize modifie les objets d'inclusion, ils ne doivent jamais être partagés */
const inclurePatient = () => ({
  model: Patient,
  as: 'patient',
  attributes: ['id', 'codePatient', 'pathologie', 'telephone'],
  include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
});
const inclureSoignant = () => ({
  model: Soignant,
  as: 'soignant',
  attributes: ['id', 'fonction'],
  include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
});

/** Rendez-vous de la période ; sans fin de période : tout ce qui est en cours et à venir */
export async function listeRendezVous(userId: number, du?: Date, au?: Date) {
  const debut = du ?? new Date(new Date().setHours(0, 0, 0, 0));
  if (au && au.getTime() <= debut.getTime()) throw httpError(400, 'Période invalide');
  const ctx = await getContexte(userId);
  const patientIds = await getPatientIds(ctx);
  if (patientIds.length === 0) return [];
  return RendezVous.findAll({
    where: { patientId: { [Op.in]: patientIds }, dateHeure: au ? { [Op.between]: [debut, au] } : { [Op.gte]: debut } },
    include: [inclurePatient(), inclureSoignant()],
    order: [['dateHeure', 'ASC']],
    limit: MAX_LIGNES,
  });
}

/** Prochain rendez-vous, dernier rendez-vous passé et équipe de chaque patient */
export async function resumesSuivi(patientIds: number[]) {
  const maintenant = new Date();
  const [aVenir, passes, affectations] = await Promise.all([
    RendezVous.findAll({
      where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.gte]: maintenant }, statut: { [Op.in]: ['prevu', 'confirme'] } },
      attributes: ['patientId', 'dateHeure', 'motif', 'statut'],
      order: [['dateHeure', 'ASC']],
    }),
    RendezVous.findAll({
      where: { patientId: { [Op.in]: patientIds }, dateHeure: { [Op.lt]: maintenant }, statut: { [Op.in]: ['effectue', 'manque'] } },
      attributes: ['patientId', 'dateHeure', 'statut'],
      order: [['dateHeure', 'DESC']],
    }),
    Affectation.findAll({ where: { patientId: { [Op.in]: patientIds } }, include: [inclureSoignant()] }),
  ]);
  const resumes = new Map<number, { prochainRdv: object | null; dernierRdv: object | null; equipe: string[] }>();
  for (const id of patientIds) resumes.set(id, { prochainRdv: null, dernierRdv: null, equipe: [] });
  for (const r of aVenir) {
    const s = resumes.get(r.patientId)!;
    if (!s.prochainRdv) s.prochainRdv = { dateHeure: r.dateHeure, motif: r.motif ?? null, statut: r.statut };
  }
  for (const r of passes) {
    const s = resumes.get(r.patientId)!;
    if (!s.dernierRdv) s.dernierRdv = { dateHeure: r.dateHeure, statut: r.statut };
  }
  for (const a of affectations) {
    const u = (a as any).soignant?.user;
    if (u) resumes.get(a.patientId)!.equipe.push(`${u.prenom} ${u.nom}`);
  }
  return resumes;
}
