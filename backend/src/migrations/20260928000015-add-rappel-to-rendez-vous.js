'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rendez_vous', 'rappel_envoye_le', {
      type: Sequelize.DATE, allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('rendez_vous', 'rappel_envoye_le');
  },
};
