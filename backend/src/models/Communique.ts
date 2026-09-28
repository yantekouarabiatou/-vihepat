import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type CibleCommunique = 'tous' | 'patient';

export interface CommuniqueAttributes {
  id: number;
  soignantId: number;
  titre: string;
  contenu: string;
  cible: CibleCommunique;
  patientId?: number | null;
}

type CommuniqueCreation = Optional<CommuniqueAttributes, 'id' | 'cible' | 'patientId'>;

export class Communique extends Model<CommuniqueAttributes, CommuniqueCreation> implements CommuniqueAttributes {
  declare id: number;
  declare soignantId: number;
  declare titre: string;
  declare contenu: string;
  declare cible: CibleCommunique;
  declare patientId?: number | null;
}

Communique.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    soignantId: { type: DataTypes.INTEGER, allowNull: false },
    titre: { type: DataTypes.STRING(150), allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    cible: { type: DataTypes.ENUM('tous', 'patient'), allowNull: false, defaultValue: 'tous' },
    patientId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'communiques' }
);
