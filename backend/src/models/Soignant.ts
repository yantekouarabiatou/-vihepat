import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface SoignantAttributes {
  id: number;
  userId: number;
  matricule: string;
  structure: string;
  specialite?: string | null;
  telephone?: string | null;
}

type SoignantCreation = Optional<SoignantAttributes, 'id' | 'specialite' | 'telephone'>;

export class Soignant extends Model<SoignantAttributes, SoignantCreation> implements SoignantAttributes {
  declare id: number;
  declare userId: number;
  declare matricule: string;
  declare structure: string;
  declare specialite?: string | null;
  declare telephone?: string | null;
}

Soignant.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    matricule: { type: DataTypes.STRING(50), unique: true, allowNull: false },
    structure: { type: DataTypes.STRING(150), allowNull: false },
    specialite: { type: DataTypes.STRING(100), allowNull: true },
    telephone: { type: DataTypes.STRING(30), allowNull: true },
  },
  { sequelize, tableName: 'soignants' }
);