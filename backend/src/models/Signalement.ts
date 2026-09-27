import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type Gravite = 'leger' | 'modere' | 'severe';
export type StatutSignalement = 'nouveau' | 'vu' | 'traite';

export interface SignalementAttributes {
  id: number;
  patientId: number;
  symptome: string;
  gravite: Gravite;
  notes?: string | null;
  statut: StatutSignalement;
}

type SignalementCreation = Optional<SignalementAttributes, 'id' | 'notes' | 'statut'>;

export class Signalement extends Model<SignalementAttributes, SignalementCreation> implements SignalementAttributes {
  declare id: number;
  declare patientId: number;
  declare symptome: string;
  declare gravite: Gravite;
  declare notes?: string | null;
  declare statut: StatutSignalement;
}

Signalement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    symptome: { type: DataTypes.STRING(150), allowNull: false },
    gravite: {
      type: DataTypes.ENUM('leger', 'modere', 'severe'),
      allowNull: false,
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    statut: {
      type: DataTypes.ENUM('nouveau', 'vu', 'traite'),
      defaultValue: 'nouveau',
    },
  },
  {
    sequelize,
    tableName: 'signalements',
    indexes: [{ fields: ['patient_id', 'statut'] }],
  }
);
