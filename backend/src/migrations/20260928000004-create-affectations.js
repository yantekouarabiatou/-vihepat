'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('affectations', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE',
      },
      soignant_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'soignants', key: 'id' }, onUpdate: 'CASCADE',
      },
      principal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      date_debut: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      date_fin: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('affectations', ['patient_id', 'soignant_id'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('affectations');
  },
};
