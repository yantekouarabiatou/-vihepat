import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { FONCTIONS_SOIGNANT } from '../models/Soignant';
import { BilanInclusion } from '../models';

/**
 * Colonnes ajoutées après l'installation initiale. La production est installée par import SQL,
 * sans migrations : l'API ajoute elle-même ce qui manque au démarrage (équivaut aux migrations
 * 20261023000001 et 20261023000002) et crée les tables récentes (migration 20261029000001).
 * Sans droit ALTER, l'erreur est signalée sans bloquer l'API.
 */
const COLONNES = [
  {
    table: 'soignants',
    colonne: 'fonction',
    definition: { type: DataTypes.ENUM(...FONCTIONS_SOIGNANT), allowNull: false, defaultValue: 'medecin' },
  },
  {
    table: 'traitements',
    colonne: 'prescripteur_id',
    definition: { type: DataTypes.INTEGER, allowNull: true },
  },
];

export async function mettreAJourSchema() {
  const qi = sequelize.getQueryInterface();
  for (const { table, colonne, definition } of COLONNES) {
    try {
      const description = await qi.describeTable(table);
      if (description[colonne]) continue;
      await qi.addColumn(table, colonne, definition);
      console.log(`🛠️  Colonne ${table}.${colonne} ajoutée`);
    } catch (err) {
      console.error(`❌ Impossible d'ajouter ${table}.${colonne} :`, err instanceof Error ? err.message : err);
    }
  }

  // Tables récentes : CREATE TABLE IF NOT EXISTS, sans toucher à une table existante
  for (const modele of [BilanInclusion]) {
    try {
      await modele.sync();
    } catch (err) {
      console.error(`❌ Impossible de créer la table ${modele.tableName} :`, err instanceof Error ? err.message : err);
    }
  }
}
