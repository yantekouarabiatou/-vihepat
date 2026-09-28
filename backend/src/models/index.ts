import { User } from './User';
import { Patient } from './Patient';
import { Soignant } from './Soignant';
import { Affectation } from './Affectation';
import { Traitement } from './Traitement';
import { RendezVous } from './RendezVous';
import { Observation } from './Observation';
import { Signalement } from './Signalement';
import { AuditLog } from './AuditLog';
import { PriseMedicament } from './PriseMedicament';
import { Structure } from './Structure';
import { GroupeSoutien } from './GroupeSoutien';
import { MembreGroupe } from './MembreGroupe';
import { MessageGroupe } from './MessageGroupe';
import { Communique } from './Communique';

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

// Patient / Traitement ↔ PriseMedicament (1-N)
Patient.hasMany(PriseMedicament, { foreignKey: 'patientId', as: 'prises' });
Traitement.hasMany(PriseMedicament, { foreignKey: 'traitementId', as: 'prises' });
PriseMedicament.belongsTo(Traitement, { foreignKey: 'traitementId', as: 'traitement' });

// GroupeSoutien ↔ MembreGroupe / MessageGroupe (1-N)
GroupeSoutien.hasMany(MembreGroupe, { foreignKey: 'groupeId', as: 'membres' });
MembreGroupe.belongsTo(GroupeSoutien, { foreignKey: 'groupeId', as: 'groupe' });
MembreGroupe.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

GroupeSoutien.hasMany(MessageGroupe, { foreignKey: 'groupeId', as: 'messages' });
MessageGroupe.belongsTo(GroupeSoutien, { foreignKey: 'groupeId', as: 'groupe' });
MessageGroupe.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

// AuditLog
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Communique (auteur soignant, cible optionnelle un patient précis)
Soignant.hasMany(Communique, { foreignKey: 'soignantId', as: 'communiques' });
Communique.belongsTo(Soignant, { foreignKey: 'soignantId', as: 'auteur' });
Communique.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

export {
  User, Patient, Soignant, Affectation,
  Traitement, RendezVous, Observation, Signalement, AuditLog, PriseMedicament,
  Structure, GroupeSoutien, MembreGroupe, MessageGroupe, Communique,
};
