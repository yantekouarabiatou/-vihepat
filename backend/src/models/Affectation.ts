import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface AffectationAttributes {
  id: number;
  patientId: number;
  soignantId: number;
  principal: boolean;
  dateDebut: Date;
  dateFin?: Date | null;
}

type AffectationCreation = Optional<AffectationAttributes, 'id' | 'principal' | 'dateDebut' | 'dateFin'>;

export class Affectation extends Model<AffectationAttributes, AffectationCreation> implements AffectationAttributes {
  declare id: number;
  declare patientId: number;
  declare soignantId: number;
  declare principal: boolean;
  declare dateDebut: Date;
  declare dateFin?: Date | null;
}

Affectation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    soignantId: { type: DataTypes.INTEGER, allowNull: false },
    principal: { type: DataTypes.BOOLEAN, defaultValue: false },
    dateDebut: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    dateFin: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'affectations',
    indexes: [{ unique: true, fields: ['patient_id', 'soignant_id'] }],
  }
);