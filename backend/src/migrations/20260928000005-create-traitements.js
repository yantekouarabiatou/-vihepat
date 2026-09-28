'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('traitements', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      molecule: { type: Sequelize.STRING(150), allowNull: false },
      dosage: { type: Sequelize.STRING(50), allowNull: true },
      frequence: { type: Sequelize.STRING(50), allowNull: false },
      heure_prise: { type: Sequelize.STRING(10), allowNull: true },
      date_debut: { type: Sequelize.DATE, allowNull: false },
      date_fin: { type: Sequelize.DATE, allowNull: true },
      actif: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('traitements');
  },
};
