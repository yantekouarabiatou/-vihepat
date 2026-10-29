'use strict';

/**
 * Bilan d'inclusion des patients VIH : entrées du modèle de risque de perte de suivi
 * (ia/perte_de_suivi). Une fiche par patient ; un champ vide = examen non réalisé.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const mesure = () => ({ type: Sequelize.FLOAT, allowNull: true });
    await queryInterface.createTable('bilans_inclusion', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      patient_id: {
        type: Sequelize.INTEGER, allowNull: false, unique: true,
        references: { model: 'patients', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      soignant_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'soignants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      date_bilan: { type: Sequelize.DATEONLY, allowNull: true },
      situation_matrimoniale: { type: Sequelize.ENUM('marie', 'celibataire', 'divorce', 'separe', 'veuf'), allowNull: true },
      niveau_etudes: { type: Sequelize.ENUM('aucun', 'primaire', 'secondaire', 'superieur'), allowNull: true },
      stade_oms: { type: Sequelize.TINYINT, allowNull: true },
      cd4: mesure(),
      charge_virale: mesure(),
      alat: mesure(),
      creatinine: mesure(),
      hemoglobine: mesure(),
      plaquettes: mesure(),
      proteines_totales: mesure(),
      uree: mesure(),
      leucocytes: mesure(),
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('bilans_inclusion');
  },
};
