'use strict';

/** Soignant qui a prescrit le traitement (traçabilité, affiché au patient). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('traitements', 'prescripteur_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'soignants', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('traitements', 'prescripteur_id');
  },
};
