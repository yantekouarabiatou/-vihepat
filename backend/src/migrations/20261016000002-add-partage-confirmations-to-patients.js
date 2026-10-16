'use strict';

/** Consentement du patient au partage de ses confirmations de rappel avec l'équipe soignante. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('patients', 'partage_confirmations', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('patients', 'partage_confirmations');
  },
};
