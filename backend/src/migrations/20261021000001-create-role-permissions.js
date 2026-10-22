'use strict';

/**
 * Matrice rôles × permissions modifiable par l'administrateur.
 * Table vide = valeurs par défaut de `src/config/permissions.ts` (insérées au démarrage de l'API).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('role_permissions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      role: { type: Sequelize.ENUM('patient', 'soignant', 'admin'), allowNull: false },
      permission: { type: Sequelize.STRING(64), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('role_permissions', ['role', 'permission'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('role_permissions');
  },
};
