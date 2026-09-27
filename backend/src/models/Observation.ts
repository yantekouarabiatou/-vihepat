import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type TypeObservation =
  | 'charge_virale'
  | 'cd4'
  | 'transaminases'
  | 'creatinine'
  | 'hemoglobine'
  | 'ag_hbs'
  | 'arn_vhc'
  | 'autre';

export interface ObservationAttributes {
  id: number;
  patientId: number;
  soignantId: number;
  type: TypeObservation;
  valeur: number;
  unite: string;
  datePrelevement: Date;
  commentaire?: string | null;
}

type ObservationCreation = Optional<ObservationAttributes, 'id' | 'commentaire'>;

export class Observation extends Model<ObservationAttributes, ObservationCreation> implements ObservationAttributes {
  declare id: number;
  declare patientId: number;
  declare soignantId: number;
  declare type: TypeObservation;
  declare valeur: number;
  declare unite: string;
  declare datePrelevement: Date;
  declare commentaire?: string | null;
}

Observation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    soignantId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM(
        'charge_virale', 'cd4', 'transaminases', 'creatinine',
        'hemoglobine', 'ag_hbs', 'arn_vhc', 'autre'
      ),
      allowNull: false,
    },
    valeur: { type: DataTypes.FLOAT, allowNull: false },
    unite: { type: DataTypes.STRING(20), allowNull: false },
    datePrelevement: { type: DataTypes.DATE, allowNull: false },
    commentaire: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    tableName: 'observations',
    indexes: [{ fields: ['patient_id', 'type', 'date_prelevement'] }],
  }
);