import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type Pathologie = 'vih' | 'vhb' | 'vhc' | 'vih_vhb' | 'vih_vhc' | 'vhb_vhc';

export interface PatientAttributes {
  id: number;
  userId: number;
  codePatient: string;
  dateNaissance?: Date | null;
  sexe?: 'M' | 'F' | null;
  telephone?: string | null;
  region?: string | null;
  commune?: string | null;
  pathologie: Pathologie;
  dateDiagnostic?: Date | null;
  languePreferee: string;
  consentementDonne: boolean;
  dateConsentement?: Date | null;
}

type PatientCreation = Optional<PatientAttributes,
  'id' | 'dateNaissance' | 'sexe' | 'telephone' | 'region' | 'commune' | 'dateDiagnostic' | 'dateConsentement'>;

export class Patient extends Model<PatientAttributes, PatientCreation> implements PatientAttributes {
  declare id: number;
  declare userId: number;
  declare codePatient: string;
  declare dateNaissance?: Date | null;
  declare sexe?: 'M' | 'F' | null;
  declare telephone?: string | null;
  declare region?: string | null;
  declare commune?: string | null;
  declare pathologie: Pathologie;
  declare dateDiagnostic?: Date | null;
  declare languePreferee: string;
  declare consentementDonne: boolean;
  declare dateConsentement?: Date | null;
}

Patient.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    codePatient: { type: DataTypes.STRING(20), unique: true, allowNull: false },
    dateNaissance: { type: DataTypes.DATEONLY, allowNull: true },
    sexe: { type: DataTypes.ENUM('M', 'F'), allowNull: true },
    telephone: { type: DataTypes.STRING(30), allowNull: true },
    region: { type: DataTypes.STRING(100), allowNull: true },
    commune: { type: DataTypes.STRING(100), allowNull: true },
    pathologie: {
      type: DataTypes.ENUM('vih', 'vhb', 'vhc', 'vih_vhb', 'vih_vhc', 'vhb_vhc'),
      allowNull: false,
    },
    dateDiagnostic: { type: DataTypes.DATEONLY, allowNull: true },
    languePreferee: { type: DataTypes.STRING(10), defaultValue: 'fr' },
    consentementDonne: { type: DataTypes.BOOLEAN, defaultValue: false },
    dateConsentement: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'patients' }
);