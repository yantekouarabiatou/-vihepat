import { env } from '../config/env';
import { emailLayout, sendMail } from './mail-transport';

/** E-mails destinés aux patients : objet et expéditeur neutres, aucun détail médical. */

/**
 * 1. Email de bienvenue lors de la création d'un patient par un soignant
 */
export async function sendWelcomePatientEmail(params: {
  to: string;
  prenom: string;
  nom: string;
  codePatient: string;
  passwordTemporaire: string;
  structureNom?: string;
}) {
  const loginUrl = env.CORS_ORIGIN.split(',')[0] || 'http://localhost:5173';

  const html = emailLayout(`
    <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0;">
      Bonjour ${params.prenom} ${params.nom},
    </p>
    <p>
      Votre dossier médical a été enregistré avec succès sur la plateforme <strong>VIHEPAT</strong>
      ${params.structureNom ? `par l'équipe médicale de <strong>${params.structureNom}</strong>` : ''}.
    </p>
    <p>
      Vous pouvez dès à présent accéder à votre espace personnel sécurisé pour suivre votre traitement,
      noter vos prises de médicaments et communiquer vos symptômes à vos soignants.
    </p>

    <div class="credentials-box">
      <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">
        Vos identifiants de connexion
      </p>
      <div class="credential-row">
        <span class="credential-label">Code Patient</span>
        <span class="credential-value">${params.codePatient}</span>
      </div>
      <div class="credential-row">
        <span class="credential-label">Identifiant Email</span>
        <span class="credential-value">${params.to}</span>
      </div>
      <div class="credential-row">
        <span class="credential-label">Mot de passe temporaire</span>
        <span class="credential-value" style="color: #2563eb;">${params.passwordTemporaire}</span>
      </div>
    </div>

    <div class="button-container">
      <a href="${loginUrl}" class="btn" target="_blank">Accéder à mon espace santé</a>
    </div>

    <div class="disclaimer">
      🔒 <strong>Conseil de sécurité :</strong> Pour des raisons de confidentialité, nous vous recommandons de
      modifier votre mot de passe dès votre première connexion et de ne jamais communiquer ces identifiants à des tiers.
    </div>
  `);

  return sendMail({
    to: params.to,
    // Objet et expéditeur neutres : l'aperçu d'un e-mail ne doit pas révéler le suivi VIH/hépatites
    subject: 'Vos identifiants de connexion',
    fromName: env.MAIL_FROM_NAME_NEUTRE,
    html,
  });
}

/**
 * 2. Email de réinitialisation des accès patient
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  prenom: string;
  nom: string;
  codePatient: string;
  newPassword: string;
  structureNom?: string;
}) {
  const loginUrl = env.CORS_ORIGIN.split(',')[0] || 'http://localhost:5173';

  const html = emailLayout(`
    <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0;">
      Bonjour ${params.prenom} ${params.nom},
    </p>
    <p>
      Vos accès à votre espace <strong>VIHEPAT</strong> viennent d'être réinitialisés à votre demande
      ${params.structureNom ? `auprès de <strong>${params.structureNom}</strong>` : ''}.
    </p>

    <div class="credentials-box">
      <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">
        Vos nouveaux accès
      </p>
      <div class="credential-row">
        <span class="credential-label">Code Patient</span>
        <span class="credential-value">${params.codePatient}</span>
      </div>
      <div class="credential-row">
        <span class="credential-label">Email</span>
        <span class="credential-value">${params.to}</span>
      </div>
      <div class="credential-row">
        <span class="credential-label">Nouveau mot de passe</span>
        <span class="credential-value" style="color: #dc2626;">${params.newPassword}</span>
      </div>
    </div>

    <div class="button-container">
      <a href="${loginUrl}" class="btn" target="_blank">Se connecter à VIHEPAT</a>
    </div>

    <div class="disclaimer">
      Si vous n'êtes pas à l'origine de cette réinitialisation, veuillez contacter immédiatement votre soignant référent.
    </div>
  `);

  return sendMail({
    to: params.to,
    subject: 'Vos nouveaux identifiants de connexion',
    fromName: env.MAIL_FROM_NAME_NEUTRE,
    html,
  });
}


const TEXTES_NEUTRES = {
  fr: {
    changeSujet: 'Votre mot de passe a été mis à jour',
    changeCorps: 'Votre mot de passe a été mis à jour.',
    changeAlerte: "Si vous n'êtes pas à l'origine de cette modification, utilisez le lien « Mot de passe oublié » ou contactez la personne qui vous a remis vos identifiants.",
    infoSujet: 'Du nouveau dans votre espace',
    infoCorps: 'Une nouvelle information vous attend dans votre espace personnel.',
    infoBouton: 'Me connecter',
    lienSujet: 'Réinitialisation de votre mot de passe',
    lienCorps: 'Une demande de réinitialisation de mot de passe a été faite pour votre compte.',
    lienBouton: 'Choisir un nouveau mot de passe',
    lienDuree: 'Ce lien est valable 30 minutes et ne peut servir qu\'une fois.',
    lienIgnorer: "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.",
  },
  en: {
    changeSujet: 'Your password has been updated',
    changeCorps: 'Your password has been updated.',
    changeAlerte: 'If you did not make this change, use the "Forgot password" link or contact the person who gave you your login details.',
    infoSujet: 'Something new in your space',
    infoCorps: 'New information is waiting for you in your personal space.',
    infoBouton: 'Sign in',
    lienSujet: 'Reset your password',
    lienCorps: 'A password reset was requested for your account.',
    lienBouton: 'Choose a new password',
    lienDuree: 'This link is valid for 30 minutes and can only be used once.',
    lienIgnorer: 'If you did not request this, ignore this message: your password stays the same.',
  },
};

function textesNeutres(langue: string) {
  return langue === 'en' ? TEXTES_NEUTRES.en : TEXTES_NEUTRES.fr;
}

/** Mise en page sobre : aucune marque, aucun logo, aucune couleur distinctive. */
function layoutNeutre(contenu: string, langue: string): string {
  return `<!DOCTYPE html>
<html lang="${langue === 'en' ? 'en' : 'fr'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px 16px;background:#ffffff;color:#1f2937;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
  <div style="max-width:520px;margin:0 auto;">${contenu}</div>
</body>
</html>`;
}

export async function sendPasswordChangedEmail(params: { to: string; langue: string }) {
  const t = textesNeutres(params.langue);
  return sendMail({
    to: params.to,
    subject: t.changeSujet,
    fromName: env.MAIL_FROM_NAME_NEUTRE,
    html: layoutNeutre(`<p>${t.changeCorps}</p><p style="color:#6b7280;font-size:13px;">${t.changeAlerte}</p>`, params.langue),
  });
}

export async function sendPasswordResetLinkEmail(params: { to: string; lien: string; langue: string }) {
  const t = textesNeutres(params.langue);
  return sendMail({
    to: params.to,
    subject: t.lienSujet,
    fromName: env.MAIL_FROM_NAME_NEUTRE,
    html: layoutNeutre(
      `<p>${t.lienCorps}</p>
  <p style="margin:24px 0;"><a href="${params.lien}" style="display:inline-block;padding:12px 20px;background:#374151;color:#ffffff;text-decoration:none;border-radius:8px;">${t.lienBouton}</a></p>
  <p style="color:#6b7280;font-size:13px;">${t.lienDuree}<br>${t.lienIgnorer}</p>`,
      params.langue,
    ),
  });
}

/** Nouvelle prescription ou message ciblé : simple invitation à se connecter, sans aucun contenu. */
export async function sendNouvelleInfoEmail(params: { to: string; langue: string }) {
  const t = textesNeutres(params.langue);
  const lien = `${env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173'}/login`;
  return sendMail({
    to: params.to,
    subject: t.infoSujet,
    fromName: env.MAIL_FROM_NAME_NEUTRE,
    html: layoutNeutre(
      `<p>${t.infoCorps}</p>
  <p style="margin:24px 0;"><a href="${lien}" style="display:inline-block;padding:12px 20px;background:#374151;color:#ffffff;text-decoration:none;border-radius:8px;">${t.infoBouton}</a></p>`,
      params.langue,
    ),
  });
}
