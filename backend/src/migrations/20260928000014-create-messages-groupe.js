'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages_groupe', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      groupe_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'groupes_soutien', key: 'id' }, onUpdate: 'CASCADE',
      },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      contenu: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('messages_groupe', ['groupe_id', 'created_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('messages_groupe');
  },
};
