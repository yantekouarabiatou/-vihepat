import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type TypeRappel = 'prise' | 'rdv';
export type StatutConfirmation = 'confirmee' | 'non_confirmee';

/**
 * Réponse du patient à un rappel. Discrétion : ni libellé ni réglage personnel du
 * rappel ne sont transmis au serveur, seulement le type, l'état et les horodatages.
 */
export interface ConfirmationRappelAttributes {
  id: number;
  patientId: number;
  /** Identifiant généré sur l'appareil (synchronisation hors ligne idempotente) */
  clientId: string;
  type: TypeRappel;
  statut: StatutConfirmation;
  prevuLe: Date;
  reponduLe?: Date | null;
  /** Nombre de « Plus tard » avant la réponse */
  reports: number;
}

type ConfirmationRappelCreation = Optional<ConfirmationRappelAttributes, 'id' | 'reponduLe' | 'reports'>;

export class ConfirmationRappel
  extends Model<ConfirmationRappelAttributes, ConfirmationRappelCreation>
  implements ConfirmationRappelAttributes {
  declare id: number;
  declare patientId: number;
  declare clientId: string;
  declare type: TypeRappel;
  declare statut: StatutConfirmation;
  declare prevuLe: Date;
  declare reponduLe?: Date | null;
  declare reports: number;
}

ConfirmationRappel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    clientId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('prise', 'rdv'), allowNull: false },
    statut: { type: DataTypes.ENUM('confirmee', 'non_confirmee'), allowNull: false },
    prevuLe: { type: DataTypes.DATE, allowNull: false },
    reponduLe: { type: DataTypes.DATE, allowNull: true },
    reports: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: 'confirmations_rappels',
    indexes: [{ fields: ['patient_id', 'prevu_le'] }],
  }
);
