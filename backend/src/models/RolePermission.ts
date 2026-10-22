import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { Role } from './User';

/**
 * Une ligne = une permission accordée à un rôle. La matrice est modifiable par
 * l'administrateur ; les valeurs par défaut restent dans `config/permissions.ts`.
 */
export interface RolePermissionAttributes {
  id: number;
  role: Role;
  permission: string;
}

type RolePermissionCreation = Optional<RolePermissionAttributes, 'id'>;

export class RolePermission
  extends Model<RolePermissionAttributes, RolePermissionCreation>
  implements RolePermissionAttributes {
  declare id: number;
  declare role: Role;
  declare permission: string;
}

RolePermission.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    role: { type: DataTypes.ENUM('patient', 'soignant', 'admin'), allowNull: false },
    permission: { type: DataTypes.STRING(64), allowNull: false },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    indexes: [{ unique: true, fields: ['role', 'permission'] }],
  }
);
