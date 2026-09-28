import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { Pathologie } from './Patient';

export interface GroupeSoutienAttributes {
  id: number;
  nom: string;
  description: string;
  pathologie?: Pathologie | null;
  actif: boolean;
}

type GroupeSoutienCreation = Optional<GroupeSoutienAttributes, 'id' | 'pathologie' | 'actif'>;

export class GroupeSoutien
  extends Model<GroupeSoutienAttributes, GroupeSoutienCreation>
  implements GroupeSoutienAttributes {
  declare id: number;
  declare nom: string;
  declare description: string;
  declare pathologie?: Pathologie | null;
  declare actif: boolean;
}

GroupeSoutien.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nom: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    pathologie: {
      type: DataTypes.ENUM('vih', 'vhb', 'vhc', 'vih_vhb', 'vih_vhc', 'vhb_vhc'),
      allowNull: true,
    },
    actif: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, tableName: 'groupes_soutien' }
);
