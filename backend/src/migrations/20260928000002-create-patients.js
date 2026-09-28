'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('patients', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER, allowNull: false, unique: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE',
      },
      code_patient: { type: Sequelize.STRING(20), unique: true, allowNull: false },
      date_naissance: { type: Sequelize.DATEONLY, allowNull: true },
      sexe: { type: Sequelize.ENUM('M', 'F'), allowNull: true },
      telephone: { type: Sequelize.STRING(30), allowNull: true },
      region: { type: Sequelize.STRING(100), allowNull: true },
      commune: { type: Sequelize.STRING(100), allowNull: true },
      pathologie: {
        type: Sequelize.ENUM('vih', 'vhb', 'vhc', 'vih_vhb', 'vih_vhc', 'vhb_vhc'),
        allowNull: false,
      },
      date_diagnostic: { type: Sequelize.DATEONLY, allowNull: true },
      langue_preferee: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'fr' },
      consentement_donne: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      date_consentement: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('patients');
  },
};
