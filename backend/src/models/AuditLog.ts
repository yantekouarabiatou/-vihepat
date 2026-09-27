import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface AuditLogAttributes {
  id: number;
  userId: number;
  action: string;
  cible?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: object | null;
}

type AuditLogCreation = Optional<AuditLogAttributes, 'id' | 'cible' | 'ip' | 'userAgent' | 'meta'>;

export class AuditLog extends Model<AuditLogAttributes, AuditLogCreation> implements AuditLogAttributes {
  declare id: number;
  declare userId: number;
  declare action: string;
  declare cible?: string | null;
  declare ip?: string | null;
  declare userAgent?: string | null;
  declare meta?: object | null;
}

AuditLog.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(80), allowNull: false },
    cible: { type: DataTypes.STRING(150), allowNull: true },
    ip: { type: DataTypes.STRING(50), allowNull: true },
    userAgent: { type: DataTypes.STRING(255), allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    updatedAt: false,
  }
);