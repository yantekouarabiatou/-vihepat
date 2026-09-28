'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE',
      },
      action: { type: Sequelize.STRING(80), allowNull: false },
      cible: { type: Sequelize.STRING(150), allowNull: true },
      ip: { type: Sequelize.STRING(50), allowNull: true },
      user_agent: { type: Sequelize.STRING(255), allowNull: true },
      meta: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
