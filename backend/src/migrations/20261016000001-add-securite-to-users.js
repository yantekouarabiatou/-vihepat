'use strict';

/**
 * Sécurité des comptes :
 * - token_version : incrémentée à chaque changement de mot de passe, elle invalide
 *   les jetons (sessions) émis auparavant sur les autres appareils ;
 * - reset_token_hash / reset_token_expire : lien « mot de passe oublié » à usage unique
 *   (seule l'empreinte SHA-256 du jeton est conservée).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'token_version', {
      type: Sequelize.INTEGER, allowNull: false, defaultValue: 0,
    });
    await queryInterface.addColumn('users', 'reset_token_hash', {
      type: Sequelize.STRING(64), allowNull: true,
    });
    await queryInterface.addColumn('users', 'reset_token_expire', {
      type: Sequelize.DATE, allowNull: true,
    });
    await queryInterface.addIndex('users', ['reset_token_hash']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('users', ['reset_token_hash']);
    await queryInterface.removeColumn('users', 'reset_token_expire');
    await queryInterface.removeColumn('users', 'reset_token_hash');
    await queryInterface.removeColumn('users', 'token_version');
  },
};
