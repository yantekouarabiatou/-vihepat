import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TraitementAttributes {
  id: number;
  patientId: number;
  molecule: string;
  dosage?: string | null;
  frequence: string;
  heurePrise?: string | null;
  dateDebut: Date;
  dateFin?: Date | null;
  actif: boolean;
  notes?: string | null;
}

type TraitementCreation = Optional<TraitementAttributes,
  'id' | 'dosage' | 'heurePrise' | 'dateFin' | 'actif' | 'notes'>;

export class Traitement extends Model<TraitementAttributes, TraitementCreation> implements TraitementAttributes {
  declare id: number;
  declare patientId: number;
  declare molecule: string;
  declare dosage?: string | null;
  declare frequence: string;
  declare heurePrise?: string | null;
  declare dateDebut: Date;
  declare dateFin?: Date | null;
  declare actif: boolean;
  declare notes?: string | null;
}

Traitement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    molecule: { type: DataTypes.STRING(150), allowNull: false },
    dosage: { type: DataTypes.STRING(50), allowNull: true },
    frequence: { type: DataTypes.STRING(50), allowNull: false },
    heurePrise: { type: DataTypes.STRING(10), allowNull: true },
    dateDebut: { type: DataTypes.DATE, allowNull: false },
    dateFin: { type: DataTypes.DATE, allowNull: true },
    actif: { type: DataTypes.BOOLEAN, defaultValue: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'traitements' }
);