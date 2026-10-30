import { Affectation, Patient, Soignant, User } from '../models';
import { roleAPermission } from './permissions.service';

/**
 * Patients qu'un soignant peut identifier : ceux de son équipe, tous pour qui a `patient:read_all`
 * (l'admin par défaut). Même règle que soignant.service (getContexte / getPatientIds), isolée ici
 * pour la veille des groupes de soutien.
 */
export async function patientsAccessibles(userId: number) {
  const [user, soignant] = await Promise.all([User.findByPk(userId), Soignant.findOne({ where: { userId } })]);
  const admin = !!user && roleAPermission(user.role, 'patient:read_all');
  if (admin) {
    const tous = await Patient.findAll({ attributes: ['id'] });
    return { admin, ids: new Set(tous.map((p) => p.id)) };
  }
  if (!soignant) return { admin, ids: new Set<number>() };
  const affectations = await Affectation.findAll({ where: { soignantId: soignant.id }, attributes: ['patientId'] });
  return { admin, ids: new Set(affectations.map((a) => a.patientId)) };
}
