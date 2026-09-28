'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('signalements', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      symptome: { type: Sequelize.STRING(150), allowNull: false },
      gravite: { type: Sequelize.ENUM('leger', 'modere', 'severe'), allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      statut: {
        type: Sequelize.ENUM('nouveau', 'vu', 'traite'), allowNull: false, defaultValue: 'nouveau',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('signalements', ['patient_id', 'statut']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('signalements');
  },
};
