'use strict';

/**
 * Réponses du patient à ses rappels (« C'est fait » / sans réponse).
 * Volontairement minimal : ni libellé, ni heure personnelle du rappel, seulement
 * le type (prise / rendez-vous), l'état et les horodatages.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('confirmations_rappels', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      // Identifiant généré sur l'appareil : rend la synchronisation hors ligne idempotente
      client_id: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      type: { type: Sequelize.ENUM('prise', 'rdv'), allowNull: false },
      statut: { type: Sequelize.ENUM('confirmee', 'non_confirmee'), allowNull: false },
      prevu_le: { type: Sequelize.DATE, allowNull: false },
      repondu_le: { type: Sequelize.DATE, allowNull: true },
      reports: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('confirmations_rappels', ['patient_id', 'prevu_le']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('confirmations_rappels');
  },
};
