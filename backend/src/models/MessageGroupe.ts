import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { CATEGORIES_ALERTE, type CategorieAlerte } from '../services/moderation.service';

export type StatutAlerte = 'a_traiter' | 'traitee';

export interface MessageGroupeAttributes {
  id: number;
  groupeId: number;
  patientId: number;
  contenu: string;
  /** Masqué par l'équipe soignante : invisible pour les autres membres du groupe */
  masque: boolean;
  /** Veille des mots sensibles (services/moderation.service.ts) : null = rien à signaler */
  alerteCategorie?: CategorieAlerte | null;
  alerteMots?: string | null;
  alerteStatut?: StatutAlerte | null;
  /** Utilisateur (soignant ou admin) qui a traité le signalement */
  alerteTraiteePar?: number | null;
  alerteTraiteeLe?: Date | null;
}

type MessageGroupeCreation = Optional<MessageGroupeAttributes,
  'id' | 'masque' | 'alerteCategorie' | 'alerteMots' | 'alerteStatut' | 'alerteTraiteePar' | 'alerteTraiteeLe'>;

export class MessageGroupe
  extends Model<MessageGroupeAttributes, MessageGroupeCreation>
  implements MessageGroupeAttributes {
  declare id: number;
  declare groupeId: number;
  declare patientId: number;
  declare contenu: string;
  declare masque: boolean;
  declare alerteCategorie?: CategorieAlerte | null;
  declare alerteMots?: string | null;
  declare alerteStatut?: StatutAlerte | null;
  declare alerteTraiteePar?: number | null;
  declare alerteTraiteeLe?: Date | null;
  declare readonly createdAt: Date;
}

MessageGroupe.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    groupeId: { type: DataTypes.INTEGER, allowNull: false },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    masque: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    alerteCategorie: { type: DataTypes.ENUM(...CATEGORIES_ALERTE), allowNull: true },
    alerteMots: { type: DataTypes.STRING(255), allowNull: true },
    alerteStatut: { type: DataTypes.ENUM('a_traiter', 'traitee'), allowNull: true },
    alerteTraiteePar: { type: DataTypes.INTEGER, allowNull: true },
    alerteTraiteeLe: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'messages_groupe',
    updatedAt: false,
    indexes: [{ fields: ['groupe_id', 'created_at'] }],
  }
);
