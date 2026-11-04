import { Affectation, Patient, Soignant, User } from '../models';
import { roleAPermission } from './permissions.service';

/**
 * Patients qu'un soignant peut identifier : ceux de son équipe, tous pour le médecin et pour qui a
 * `patient:read_all` (le super admin par défaut). Même règle que soignant.service (getContexte / getPatientIds), isolée ici
 * pour la veille des groupes de soutien.
 */
export async function patientsAccessibles(userId: number) {
  const [user, soignant] = await Promise.all([User.findByPk(userId), Soignant.findOne({ where: { userId } })]);
  // Le médecin suit tous les patients, comme le super admin
  const admin = (!!user && roleAPermission(user.role, 'patient:read_all')) || soignant?.fonction === 'medecin';
  if (admin) {
    const tous = await Patient.findAll({ attributes: ['id'] });
    return { admin, ids: new Set(tous.map((p) => p.id)) };
  }
  if (!soignant) return { admin, ids: new Set<number>() };
  const affectations = await Affectation.findAll({ where: { soignantId: soignant.id }, attributes: ['patientId'] });
  return { admin, ids: new Set(affectations.map((a) => a.patientId)) };
}
