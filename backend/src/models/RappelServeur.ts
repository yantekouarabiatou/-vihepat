import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

/**
 * Rappels envoyés par le serveur (application fermée), seulement avec l'accord du patient.
 * Minimum de données : heure, jours et type du rappel ; jamais le libellé ni le nom du médicament.
 */

/** Abonnement aux notifications d'un navigateur (un par appareil) */
export class AbonnementPush extends Model {
  declare id: number;
  declare userId: number;
  /** Empreinte SHA-256 de l'adresse d'envoi (unique ; l'adresse complète peut dépasser 255 caractères) */
  declare empreinte: string;
  declare endpoint: string;
  declare p256dh: string;
  declare auth: string;
  /** Textes de la notification, dans la langue du patient : { titre, corps, fait, plusTard } */
  declare textes: string;
  /** Adresse de l'API vue depuis l'appareil, pour les actions « C'est fait » / « Plus tard » */
  declare apiBase: string;
}

AbonnementPush.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    empreinte: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    endpoint: { type: DataTypes.TEXT, allowNull: false },
    p256dh: { type: DataTypes.STRING(200), allowNull: false },
    auth: { type: DataTypes.STRING(64), allowNull: false },
    textes: { type: DataTypes.STRING(500), allowNull: false },
    apiBase: { type: DataTypes.STRING(255), allowNull: false },
  },
  { sequelize, tableName: 'abonnements_push', indexes: [{ fields: ['user_id'] }] }
);

/** Copie minimale d'un rappel de l'appareil */
export class RappelServeur extends Model {
  declare id: number;
  declare userId: number;
  /** Identifiant du rappel sur l'appareil : la clé d'échéance est la même des deux côtés */
  declare clientId: string;
  declare type: 'prise' | 'rdv';
  /** « HH:MM », heure locale du patient */
  declare heure: string;
  /** Jours de la semaine (0 = dimanche), « 1,3,5 » ; vide = tous les jours */
  declare jours: string;
  /** Décalage horaire de l'appareil (Date.getTimezoneOffset, en minutes) */
  declare decalageMin: number;
  declare delaiRelanceMin: number;
  declare depuis: Date;
  /** Dernière échéance notifiée, relancée, à laquelle le patient a répondu (clés d'échéance) */
  declare envoiCle: string | null;
  declare envoiLe: Date | null;
  declare relanceCle: string | null;
  declare reponseCle: string | null;
  /** « Plus tard » choisi depuis la notification */
  declare reportCle: string | null;
  declare reportA: Date | null;
}

RappelServeur.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    clientId: { type: DataTypes.STRING(64), allowNull: false },
    type: { type: DataTypes.ENUM('prise', 'rdv'), allowNull: false },
    heure: { type: DataTypes.STRING(5), allowNull: false },
    jours: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '' },
    decalageMin: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: -60 },
    delaiRelanceMin: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 15 },
    depuis: { type: DataTypes.DATE, allowNull: false },
    envoiCle: { type: DataTypes.STRING(80), allowNull: true },
    envoiLe: { type: DataTypes.DATE, allowNull: true },
    relanceCle: { type: DataTypes.STRING(80), allowNull: true },
    reponseCle: { type: DataTypes.STRING(80), allowNull: true },
    reportCle: { type: DataTypes.STRING(80), allowNull: true },
    reportA: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'rappels_serveur', indexes: [{ unique: true, fields: ['user_id', 'client_id'] }] }
);

/** Réglages internes de l'API (ex. clés VAPID générées au premier démarrage) */
export class ParametreSysteme extends Model {
  declare cle: string;
  declare valeur: string;
}

ParametreSysteme.init(
  {
    cle: { type: DataTypes.STRING(64), primaryKey: true },
    valeur: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, tableName: 'parametres_systeme' }
);
