import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

/**
 * Message échangé à propos d'un signalement : réponse de l'équipe soignante ou du patient,
 * écrite et/ou vocale. La note vocale est gardée en base (pas de fichier sur l'hébergement).
 */
export class ReponseSignalement extends Model {
  declare id: number;
  declare signalementId: number;
  declare auteurId: number;
  declare auteurRole: 'soignant' | 'patient';
  declare texte: string | null;
  declare audio: Buffer | null;
  declare audioType: string | null;
  declare audioDuree: number | null;
  /** Lu par le destinataire (patient pour une réponse de l'équipe, équipe pour une réponse du patient) */
  declare luLe: Date | null;
  declare createdAt: Date;
}

ReponseSignalement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    signalementId: { type: DataTypes.INTEGER, allowNull: false },
    auteurId: { type: DataTypes.INTEGER, allowNull: false },
    auteurRole: { type: DataTypes.ENUM('soignant', 'patient'), allowNull: false },
    texte: { type: DataTypes.TEXT, allowNull: true },
    audio: { type: DataTypes.BLOB('medium'), allowNull: true },
    audioType: { type: DataTypes.STRING(40), allowNull: true },
    audioDuree: { type: DataTypes.SMALLINT, allowNull: true },
    luLe: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'reponses_signalement', indexes: [{ fields: ['signalement_id'] }] }
);
