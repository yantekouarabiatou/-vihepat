import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface StructureAttributes {
  id: number;
  nom: string;
  codeInvitation: string;
  actif: boolean;
}

type StructureCreation = Optional<StructureAttributes, 'id' | 'actif'>;

export class Structure extends Model<StructureAttributes, StructureCreation> implements StructureAttributes {
  declare id: number;
  declare nom: string;
  declare codeInvitation: string;
  declare actif: boolean;
}

Structure.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nom: { type: DataTypes.STRING(150), unique: true, allowNull: false },
    codeInvitation: { type: DataTypes.STRING(50), allowNull: false },
    actif: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, tableName: 'structures' }
);
