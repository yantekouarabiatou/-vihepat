'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('communiques', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      soignant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'soignants', key: 'id' }, onUpdate: 'CASCADE',
      },
      titre: { type: Sequelize.STRING(150), allowNull: false },
      contenu: { type: Sequelize.TEXT, allowNull: false },
      cible: { type: Sequelize.ENUM('tous', 'patient'), allowNull: false, defaultValue: 'tous' },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('communiques');
  },
};
