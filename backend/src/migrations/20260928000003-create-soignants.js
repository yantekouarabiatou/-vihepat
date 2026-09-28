'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('soignants', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER, allowNull: false, unique: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE',
      },
      matricule: { type: Sequelize.STRING(50), unique: true, allowNull: false },
      structure: { type: Sequelize.STRING(150), allowNull: false },
      specialite: { type: Sequelize.STRING(100), allowNull: true },
      telephone: { type: Sequelize.STRING(30), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('soignants');
  },
};
