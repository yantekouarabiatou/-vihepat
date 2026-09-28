'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('prises_medicaments', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      traitement_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'traitements', key: 'id' }, onUpdate: 'CASCADE',
      },
      date_prevue: { type: Sequelize.DATEONLY, allowNull: false },
      rang: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
      statut: { type: Sequelize.ENUM('prise', 'manquee'), allowNull: false },
      declaree_a: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('prises_medicaments', ['traitement_id', 'date_prevue', 'rang'], { unique: true });
    await queryInterface.addIndex('prises_medicaments', ['patient_id', 'date_prevue']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('prises_medicaments');
  },
};
