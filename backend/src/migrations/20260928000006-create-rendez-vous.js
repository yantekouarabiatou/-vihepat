'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rendez_vous', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      soignant_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'soignants', key: 'id' }, onUpdate: 'CASCADE',
      },
      date_heure: { type: Sequelize.DATE, allowNull: false },
      motif: { type: Sequelize.STRING(200), allowNull: true },
      statut: {
        type: Sequelize.ENUM('prevu', 'confirme', 'effectue', 'manque', 'annule'),
        allowNull: false, defaultValue: 'prevu',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('rendez_vous');
  },
};
