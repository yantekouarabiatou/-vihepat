import { Op } from 'sequelize';
import { env } from '../config/env';
import { Patient, RendezVous, User } from '../models';
import { sendMail } from './mail-transport';
import { envoyerAUtilisateur } from './rappels-serveur.service';

/**
 * Rappels de rendez-vous au patient : automatiquement la veille (si le soignant l'a laissé
 * activé) ou à la demande du soignant. Discrétion : ni motif, ni nom du centre, ni mot médical ;
 * seulement « un rendez-vous » et l'heure. Par e-mail neutre et, si le patient a activé les
 * rappels application fermée, par notification sur son téléphone.
 */

const FUSEAU = 'Africa/Porto-Novo';
/** Fenêtre du rappel automatique : rendez-vous entre 20 h et 28 h à l'avance */
const AVANCE_MIN_MS = 20 * 3600_000;
const AVANCE_MAX_MS = 28 * 3600_000;
const PERIODE_MS = 15 * 60_000;

const TEXTES = {
  fr: {
    sujet: 'Rappel de rendez-vous',
    corps: (quand: string) => `Rappel : vous avez un rendez-vous ${quand}.`,
    empeche: 'En cas d’empêchement, prévenez votre interlocuteur habituel pour fixer une autre date.',
    bouton: 'Ouvrir mon espace',
    pied: 'Message automatique, merci de ne pas y répondre.',
  },
  en: {
    sujet: 'Appointment reminder',
    corps: (quand: string) => `Reminder: you have an appointment ${quand}.`,
    empeche: 'If you cannot come, let your usual contact know to set another date.',
    bouton: 'Open my space',
    pied: 'Automatic message, please do not reply.',
  },
};

function quand(date: Date, langue: 'fr' | 'en') {
  const jour = date.toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: FUSEAU });
  const heure = date.toLocaleTimeString(langue === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });
  return langue === 'en' ? `on ${jour} at ${heure}` : `le ${jour} à ${heure}`;
}

/** Envoie le rappel d'un rendez-vous ; renvoie les canaux utilisés */
export async function notifierPatientRdv(rdv: RendezVous) {
  const patient = await Patient.findByPk(rdv.patientId, { include: [{ model: User, as: 'user', attributes: ['id', 'email', 'actif'] }] });
  const user = (patient as any)?.user as { id: number; email: string; actif: boolean } | undefined;
  if (!patient || !user?.actif) return { email: false, notification: 0 };
  const langue = patient.languePreferee === 'en' ? 'en' : 'fr';
  const t = TEXTES[langue];
  const texte = t.corps(quand(rdv.dateHeure, langue));

  const notification = await envoyerAUtilisateur(user.id, (textes) => ({ titre: textes.titre, corps: texte, cle: `rdv-${rdv.id}` })).catch(() => 0);

  let email = false;
  if (user.email) {
    const lien = `${env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173'}/login`;
    email = await sendMail({
      to: user.email,
      subject: t.sujet,
      fromName: env.MAIL_FROM_NAME_NEUTRE,
      html: `<!DOCTYPE html><html lang="${langue}"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px 16px;background:#ffffff;color:#1f2937;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
<div style="max-width:520px;margin:0 auto;"><p>${texte}</p><p>${t.empeche}</p>
<p style="margin:24px 0;"><a href="${lien}" style="display:inline-block;padding:12px 20px;background:#374151;color:#ffffff;text-decoration:none;border-radius:8px;">${t.bouton}</a></p>
<p style="color:#6b7280;font-size:13px;">${t.pied}</p></div></body></html>`,
    })
      .then((r) => r.success)
      .catch(() => false);
  }
  return { email, notification };
}

/** Rappels automatiques de la veille ; un seul envoi par rendez-vous, même avec plusieurs processus */
export async function ticRappelsRdv(t = Date.now()) {
  const aRappeler = await RendezVous.findAll({
    where: {
      statut: { [Op.in]: ['prevu', 'confirme'] },
      rappelAuto: true,
      rappelEnvoyeLe: null,
      dateHeure: { [Op.between]: [new Date(t + AVANCE_MIN_MS), new Date(t + AVANCE_MAX_MS)] },
    },
  });
  for (const rdv of aRappeler) {
    const [n] = await RendezVous.update({ rappelEnvoyeLe: new Date(t) }, { where: { id: rdv.id, rappelEnvoyeLe: null } });
    if (n === 1) await notifierPatientRdv(rdv);
  }
}

export function demarrerRappelsRdv() {
  let enCours = false;
  const tourner = async () => {
    if (enCours) return;
    enCours = true;
    try {
      await ticRappelsRdv();
    } catch (err) {
      console.error('❌ Rappels de rendez-vous :', (err as Error).message);
    } finally {
      enCours = false;
    }
  };
  setTimeout(() => void tourner(), 60_000).unref();
  setInterval(() => void tourner(), PERIODE_MS).unref();
}
