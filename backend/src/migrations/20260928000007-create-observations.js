'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('observations', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      soignant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'soignants', key: 'id' }, onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM(
          'charge_virale', 'cd4', 'transaminases', 'creatinine',
          'hemoglobine', 'ag_hbs', 'arn_vhc', 'autre'
        ),
        allowNull: false,
      },
      valeur: { type: Sequelize.FLOAT, allowNull: false },
      unite: { type: Sequelize.STRING(20), allowNull: false },
      date_prelevement: { type: Sequelize.DATE, allowNull: false },
      commentaire: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('observations', ['patient_id', 'type', 'date_prelevement']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('observations');
  },
};
