import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

/**
 * Interactions des membres sur les messages des groupes de soutien :
 * - une réaction de soutien (une par membre et par type) ;
 * - un signalement par un membre (propos blessants, mauvais conseil…), vu par l'équipe soignante.
 */

export const TYPES_REACTION = ['soutien', 'merci'] as const;
export type TypeReaction = (typeof TYPES_REACTION)[number];

export const MOTIFS_SIGNALEMENT = ['propos_blessants', 'mauvais_conseil', 'coordonnees', 'autre'] as const;
export type MotifSignalement = (typeof MOTIFS_SIGNALEMENT)[number];

interface ReactionAttributes { id: number; messageId: number; patientId: number; type: TypeReaction }

export class ReactionMessage
  extends Model<ReactionAttributes, Optional<ReactionAttributes, 'id'>>
  implements ReactionAttributes {
  declare id: number;
  declare messageId: number;
  declare patientId: number;
  declare type: TypeReaction;
}

ReactionMessage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM(...TYPES_REACTION), allowNull: false },
  },
  {
    sequelize,
    tableName: 'reactions_message_groupe',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['message_id', 'patient_id', 'type'] }],
  }
);

interface SignalementMessageAttributes {
  id: number;
  messageId: number;
  /** Membre qui signale : jamais montré aux autres membres */
  patientId: number;
  motif: MotifSignalement;
  commentaire?: string | null;
}

export class SignalementMessage
  extends Model<SignalementMessageAttributes, Optional<SignalementMessageAttributes, 'id' | 'commentaire'>>
  implements SignalementMessageAttributes {
  declare id: number;
  declare messageId: number;
  declare patientId: number;
  declare motif: MotifSignalement;
  declare commentaire?: string | null;
  declare readonly createdAt: Date;
}

SignalementMessage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    messageId: { type: DataTypes.INTEGER, allowNull: false },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    motif: { type: DataTypes.ENUM(...MOTIFS_SIGNALEMENT), allowNull: false },
    commentaire: { type: DataTypes.STRING(300), allowNull: true },
  },
  {
    sequelize,
    tableName: 'signalements_message_groupe',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['message_id', 'patient_id'] }],
  }
);
