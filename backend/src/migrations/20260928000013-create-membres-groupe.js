'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membres_groupe', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      groupe_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'groupes_soutien', key: 'id' }, onUpdate: 'CASCADE',
      },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      date_adhesion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('membres_groupe', ['groupe_id', 'patient_id'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('membres_groupe');
  },
};
