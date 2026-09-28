import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface MembreGroupeAttributes {
  id: number;
  groupeId: number;
  patientId: number;
  dateAdhesion: Date;
}

type MembreGroupeCreation = Optional<MembreGroupeAttributes, 'id' | 'dateAdhesion'>;

export class MembreGroupe
  extends Model<MembreGroupeAttributes, MembreGroupeCreation>
  implements MembreGroupeAttributes {
  declare id: number;
  declare groupeId: number;
  declare patientId: number;
  declare dateAdhesion: Date;
}

MembreGroupe.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    groupeId: { type: DataTypes.INTEGER, allowNull: false },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    dateAdhesion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'membres_groupe',
    indexes: [{ unique: true, fields: ['groupe_id', 'patient_id'] }],
  }
);
