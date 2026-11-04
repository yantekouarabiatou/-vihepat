import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

/**
 * Bilan d'inclusion d'un patient VIH : une seule fiche par patient, celle de l'entrée dans le
 * parcours de soins. Ce sont les entrées du modèle de risque de perte de suivi (ia/perte_de_suivi),
 * dans les unités de la cohorte d'entraînement. Un champ vide = examen non réalisé : le modèle
 * compte les examens manquants, c'est même son signal le plus fort.
 */
export const SITUATIONS_MATRIMONIALES = ['marie', 'celibataire', 'divorce', 'separe', 'veuf'] as const;
export const NIVEAUX_ETUDES = ['aucun', 'primaire', 'secondaire', 'superieur'] as const;
export type SituationMatrimoniale = (typeof SITUATIONS_MATRIMONIALES)[number];
export type NiveauEtudes = (typeof NIVEAUX_ETUDES)[number];

export interface BilanInclusionAttributes {
  id: number;
  patientId: number;
  /** Soignant qui a saisi ou modifié la fiche en dernier */
  soignantId?: number | null;
  dateBilan?: Date | null;
  situationMatrimoniale?: SituationMatrimoniale | null;
  niveauEtudes?: NiveauEtudes | null;
  stadeOms?: number | null;
  /** cellules/µL */
  cd4?: number | null;
  /** copies/mL */
  chargeVirale?: number | null;
  /** U/L */
  alat?: number | null;
  /** µmol/L */
  creatinine?: number | null;
  /** g/dL */
  hemoglobine?: number | null;
  /** 10⁹/L */
  plaquettes?: number | null;
  /** g/L */
  proteinesTotales?: number | null;
  /** mmol/L */
  uree?: number | null;
  /** 10⁹/L */
  leucocytes?: number | null;
}

type BilanInclusionCreation = Optional<BilanInclusionAttributes, Exclude<keyof BilanInclusionAttributes, 'patientId'>>;

export class BilanInclusion
  extends Model<BilanInclusionAttributes, BilanInclusionCreation>
  implements BilanInclusionAttributes {
  declare id: number;
  declare patientId: number;
  declare soignantId?: number | null;
  declare dateBilan?: Date | null;
  declare situationMatrimoniale?: SituationMatrimoniale | null;
  declare niveauEtudes?: NiveauEtudes | null;
  declare stadeOms?: number | null;
  declare cd4?: number | null;
  declare chargeVirale?: number | null;
  declare alat?: number | null;
  declare creatinine?: number | null;
  declare hemoglobine?: number | null;
  declare plaquettes?: number | null;
  declare proteinesTotales?: number | null;
  declare uree?: number | null;
  declare leucocytes?: number | null;
  declare updatedAt: Date;
}

// Un objet neuf par colonne : Sequelize modifie la définition qu'on lui passe
const mesure = () => ({ type: DataTypes.FLOAT, allowNull: true });

BilanInclusion.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    soignantId: { type: DataTypes.INTEGER, allowNull: true },
    dateBilan: { type: DataTypes.DATEONLY, allowNull: true },
    situationMatrimoniale: { type: DataTypes.ENUM(...SITUATIONS_MATRIMONIALES), allowNull: true },
    niveauEtudes: { type: DataTypes.ENUM(...NIVEAUX_ETUDES), allowNull: true },
    stadeOms: { type: DataTypes.TINYINT, allowNull: true },
    cd4: mesure(),
    chargeVirale: mesure(),
    alat: mesure(),
    creatinine: mesure(),
    hemoglobine: mesure(),
    plaquettes: mesure(),
    proteinesTotales: mesure(),
    uree: mesure(),
    leucocytes: mesure(),
  },
  { sequelize, tableName: 'bilans_inclusion' }
);
