import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type StatutPrise = 'prise' | 'manquee';

export interface PriseMedicamentAttributes {
  id: number;
  patientId: number;
  traitementId: number;
  /** Jour concerné (YYYY-MM-DD) */
  datePrevue: string;
  /** Rang de la prise dans la journée (1 pour « 1x/jour », 1 ou 2 pour « 2x/jour »…) */
  rang: number;
  statut: StatutPrise;
  /** Horodatage de la déclaration par le patient */
  declareeA: Date;
}

type PriseMedicamentCreation = Optional<PriseMedicamentAttributes, 'id' | 'rang' | 'declareeA'>;

export class PriseMedicament
  extends Model<PriseMedicamentAttributes, PriseMedicamentCreation>
  implements PriseMedicamentAttributes {
  declare id: number;
  declare patientId: number;
  declare traitementId: number;
  declare datePrevue: string;
  declare rang: number;
  declare statut: StatutPrise;
  declare declareeA: Date;
}

PriseMedicament.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    traitementId: { type: DataTypes.INTEGER, allowNull: false },
    datePrevue: { type: DataTypes.DATEONLY, allowNull: false },
    rang: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    statut: { type: DataTypes.ENUM('prise', 'manquee'), allowNull: false },
    declareeA: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'prises_medicaments',
    indexes: [
      { unique: true, fields: ['traitement_id', 'date_prevue', 'rang'] },
      { fields: ['patient_id', 'date_prevue'] },
    ],
  }
);
