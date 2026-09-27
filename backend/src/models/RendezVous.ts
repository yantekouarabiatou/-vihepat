import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type StatutRDV = 'prevu' | 'confirme' | 'effectue' | 'manque' | 'annule';

export interface RendezVousAttributes {
  id: number;
  patientId: number;
  soignantId?: number | null;
  dateHeure: Date;
  motif?: string | null;
  statut: StatutRDV;
  notes?: string | null;
}

type RendezVousCreation = Optional<RendezVousAttributes,
  'id' | 'soignantId' | 'motif' | 'statut' | 'notes'>;

export class RendezVous extends Model<RendezVousAttributes, RendezVousCreation> implements RendezVousAttributes {
  declare id: number;
  declare patientId: number;
  declare soignantId?: number | null;
  declare dateHeure: Date;
  declare motif?: string | null;
  declare statut: StatutRDV;
  declare notes?: string | null;
}

RendezVous.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    soignantId: { type: DataTypes.INTEGER, allowNull: true },
    dateHeure: { type: DataTypes.DATE, allowNull: false },
    motif: { type: DataTypes.STRING(200), allowNull: true },
    statut: {
      type: DataTypes.ENUM('prevu', 'confirme', 'effectue', 'manque', 'annule'),
      defaultValue: 'prevu',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'rendez_vous' }
);