import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface MessageGroupeAttributes {
  id: number;
  groupeId: number;
  patientId: number;
  contenu: string;
}

type MessageGroupeCreation = Optional<MessageGroupeAttributes, 'id'>;

export class MessageGroupe
  extends Model<MessageGroupeAttributes, MessageGroupeCreation>
  implements MessageGroupeAttributes {
  declare id: number;
  declare groupeId: number;
  declare patientId: number;
  declare contenu: string;
  declare readonly createdAt: Date;
}

MessageGroupe.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    groupeId: { type: DataTypes.INTEGER, allowNull: false },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    tableName: 'messages_groupe',
    updatedAt: false,
    indexes: [{ fields: ['groupe_id', 'created_at'] }],
  }
);
