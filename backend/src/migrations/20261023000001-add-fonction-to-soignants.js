'use strict';

/** Fonction du soignant : seul le médecin rattache les autres soignants à ses patients. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('soignants', 'fonction', {
      type: Sequelize.ENUM('medecin', 'infirmier', 'sage_femme', 'pharmacien', 'mediateur', 'autre'),
      allowNull: false,
      defaultValue: 'medecin',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('soignants', 'fonction');
  },
};
