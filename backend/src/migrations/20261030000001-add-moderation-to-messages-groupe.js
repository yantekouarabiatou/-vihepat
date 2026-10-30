'use strict';

/**
 * Veille des groupes de soutien : l'équipe soignante lit les discussions, les messages contenant
 * des mots sensibles sont signalés, et un message peut être masqué aux autres membres.
 */
const COLONNES = (Sequelize) => ({
  masque: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  alerte_categorie: {
    type: Sequelize.ENUM('detresse', 'traitement', 'injure', 'stigmatisation', 'coordonnees'), allowNull: true,
  },
  alerte_mots: { type: Sequelize.STRING(255), allowNull: true },
  alerte_statut: { type: Sequelize.ENUM('a_traiter', 'traitee'), allowNull: true },
  alerte_traitee_par: {
    type: Sequelize.INTEGER, allowNull: true,
    references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
  },
  alerte_traitee_le: { type: Sequelize.DATE, allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [colonne, definition] of Object.entries(COLONNES(Sequelize))) {
      await queryInterface.addColumn('messages_groupe', colonne, definition);
    }
    await queryInterface.addIndex('messages_groupe', ['alerte_statut']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('messages_groupe', ['alerte_statut']);
    for (const colonne of Object.keys(COLONNES({ BOOLEAN: 0, ENUM: () => 0, STRING: () => 0, INTEGER: 0, DATE: 0 }))) {
      await queryInterface.removeColumn('messages_groupe', colonne);
    }
  },
};
