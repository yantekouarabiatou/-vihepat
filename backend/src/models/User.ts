import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type Role = 'patient' | 'soignant' | 'admin';

export interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  role: Role;
  nom: string;
  prenom: string;
  actif: boolean;
  derniereConnexion?: Date | null;
}

type UserCreation = Optional<UserAttributes, 'id' | 'actif'>;

export class User extends Model<UserAttributes, UserCreation> implements UserAttributes {
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare role: Role;
  declare nom: string;
  declare prenom: string;
  declare actif: boolean;
  declare derniereConnexion?: Date | null;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(180), unique: true, allowNull: false },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('patient', 'soignant', 'admin'), allowNull: false },
    nom: { type: DataTypes.STRING(100), allowNull: false },
    prenom: { type: DataTypes.STRING(100), allowNull: false },
    actif: { type: DataTypes.BOOLEAN, defaultValue: true },
    derniereConnexion: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'users' }
);