import { User } from './User';
import { Patient } from './Patient';
import { Soignant } from './Soignant';
import { Affectation } from './Affectation';
import { Traitement } from './Traitement';
import { RendezVous } from './RendezVous';
import { Observation } from './Observation';
import { Signalement } from './Signalement';
import { AuditLog } from './AuditLog';

// User ↔ Patient (1-1)
User.hasOne(Patient, { foreignKey: 'userId', as: 'patient' });
Patient.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ Soignant (1-1)
User.hasOne(Soignant, { foreignKey: 'userId', as: 'soignant' });
Soignant.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Patient ↔ Soignant (N-N via Affectation)
Patient.belongsToMany(Soignant, {
  through: Affectation, foreignKey: 'patientId', otherKey: 'soignantId', as: 'soignants',
});
Soignant.belongsToMany(Patient, {
  through: Affectation, foreignKey: 'soignantId', otherKey: 'patientId', as: 'patients',
});
Affectation.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Affectation.belongsTo(Soignant, { foreignKey: 'soignantId', as: 'soignant' });

// Patient ↔ Traitement (1-N)
Patient.hasMany(Traitement, { foreignKey: 'patientId', as: 'traitements' });
Traitement.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// Patient ↔ RendezVous (1-N)
Patient.hasMany(RendezVous, { foreignKey: 'patientId', as: 'rendezVous' });
RendezVous.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
RendezVous.belongsTo(Soignant, { foreignKey: 'soignantId', as: 'soignant' });

// Patient ↔ Observation (1-N)
Patient.hasMany(Observation, { foreignKey: 'patientId', as: 'observations' });
Observation.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Observation.belongsTo(Soignant, { foreignKey: 'soignantId', as: 'soignant' });

// Patient ↔ Signalement (1-N)
Patient.hasMany(Signalement, { foreignKey: 'patientId', as: 'signalements' });
Signalement.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// AuditLog
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User, Patient, Soignant, Affectation,
  Traitement, RendezVous, Observation, Signalement, AuditLog,
};