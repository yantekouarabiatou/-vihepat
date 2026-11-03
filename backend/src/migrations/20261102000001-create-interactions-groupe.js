'use strict';

/** Groupes de soutien : réponses, réactions de soutien et signalements des messages par les membres. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages_groupe', 'reponse_a', {
      type: Sequelize.INTEGER, allowNull: true,
      references: { model: 'messages_groupe', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });
    const message = { type: Sequelize.INTEGER, allowNull: false, references: { model: 'messages_groupe', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' };
    const patient = { type: Sequelize.INTEGER, allowNull: false, references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' };
    await queryInterface.createTable('reactions_message_groupe', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      message_id: message,
      patient_id: patient,
      type: { type: Sequelize.ENUM('soutien', 'merci'), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('reactions_message_groupe', ['message_id', 'patient_id', 'type'], { unique: true });
    await queryInterface.createTable('signalements_message_groupe', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      message_id: { ...message },
      patient_id: { ...patient },
      motif: { type: Sequelize.ENUM('propos_blessants', 'mauvais_conseil', 'coordonnees', 'autre'), allowNull: false },
      commentaire: { type: Sequelize.STRING(300), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('signalements_message_groupe', ['message_id', 'patient_id'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('signalements_message_groupe');
    await queryInterface.dropTable('reactions_message_groupe');
    await queryInterface.removeColumn('messages_groupe', 'reponse_a');
  },
};
