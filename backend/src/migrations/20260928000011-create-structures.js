'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('structures', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      nom: { type: Sequelize.STRING(150), unique: true, allowNull: false },
      code_invitation: { type: Sequelize.STRING(50), allowNull: false },
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('structures');
  },
};
