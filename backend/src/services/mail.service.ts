import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Transporteur SMTP (Gmail, Brevo ou tout relais standard). L'adresse d'expédition doit être
 * celle du compte SMTP : sinon les messageries rejettent le message (DMARC).
 */
export const mailTransporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_PORT === 465, // 587 utilise STARTTLS (secure = false)
  auth:
    env.MAIL_USERNAME && env.MAIL_PASSWORD
      ? {
          user: env.MAIL_USERNAME,
          pass: env.MAIL_PASSWORD,
        }
      : undefined,
  connectionTimeout: 15_000,
  tls: {
    rejectUnauthorized: false,
  },
});

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Nom d'expéditeur affiché ; par défaut MAIL_FROM_NAME */
  fromName?: string;
}

/**
 * Envoie un email de manière sécurisée (ne bloque pas l'exécution en cas d'erreur réseau)
 */
export async function sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const from = `"${options.fromName ?? env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>`;
    const info = await mailTransporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text ?? options.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });

    console.log(`📧 [EMAIL ENVOYÉ] À: ${options.to} | Sujet: "${options.subject}" | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [EMAIL ERREUR] Échec d'envoi à ${options.to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Vérifie la connectivité au serveur SMTP
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await mailTransporter.verify();
    console.log(`✅ [SMTP] Connecté à ${env.MAIL_HOST}:${env.MAIL_PORT} (${env.MAIL_USERNAME})`);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [SMTP] Impossible de joindre ${env.MAIL_HOST}:${env.MAIL_PORT} : ${error}`);
    return { ok: false, error };
  }
}

/** Diagnostic depuis l'espace admin : connexion SMTP puis envoi réel à l'adresse donnée. */
export async function sendTestEmail(to: string) {
  const connexion = await verifySmtpConnection();
  if (!connexion.ok) {
    return { success: false, etape: 'connexion', serveur: `${env.MAIL_HOST}:${env.MAIL_PORT}`, error: connexion.error };
  }
  const envoi = await sendMail({
    to,
    subject: 'VIHEPAT — Test de la messagerie',
    html: emailLayout(`
      <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0;">La messagerie fonctionne ✅</p>
      <p>Ce message confirme que la plateforme peut envoyer des e-mails : identifiants des nouveaux patients,
      liens « mot de passe oublié », alertes de signalements sévères et avis de nouveautés.</p>
      <div class="credentials-box">
        <div class="credential-row"><span class="credential-label">Serveur</span><span class="credential-value">${env.MAIL_HOST}:${env.MAIL_PORT}</span></div>
        <div class="credential-row"><span class="credential-label">Expéditeur</span><span class="credential-value">${env.MAIL_FROM_ADDRESS}</span></div>
        <div class="credential-row"><span class="credential-label">Envoyé le</span><span class="credential-value">${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' })}</span></div>
      </div>
    `, 'Test de la messagerie VIHEPAT'),
  });
  return { ...envoi, etape: 'envoi', serveur: `${env.MAIL_HOST}:${env.MAIL_PORT}`, expediteur: env.MAIL_FROM_ADDRESS };
}

/**
 * Template de base HTML soigné et responsive pour VIHEPAT
 */
function emailLayout(contentHtml: string, previewText = 'VIHEPAT — Assistant de suivi de santé'): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIHEPAT</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9; color: #1e293b; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
    .body { padding: 32px 28px; font-size: 15px; line-height: 1.6; color: #334155; }
    .credentials-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 20px; margin: 24px 0; }
    .credential-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .credential-row:last-child { border-bottom: none; }
    .credential-label { color: #64748b; font-weight: 500; }
    .credential-value { font-weight: 700; color: #0f172a; font-family: monospace; font-size: 15px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #e0f2fe; color: #0369a1; }
    .button-container { text-align: center; margin: 30px 0 16px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 9999px; font-weight: 700; font-size: 15px; }
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #94a3b8; }
    .disclaimer { font-size: 12px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 10px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>VIHEPAT</h1>
        <p>Plateforme sécurisée de suivi VIH & Hépatites</p>
      </div>
      <div class="body">
        ${contentHtml}
      </div>
    </div>
    <div class="footer">
      <p>Ceci est un message automatique sécurisé envoyé par la plateforme VIHEPAT.</p>
      <p>Si vous n'êtes pas le destinataire de ce message, veuillez contacter votre centre médical.</p>
    </div>
  </div>
</body>
</html>`;
}

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
    subject: 'Bienvenue sur VIHEPAT — Vos identifiants de connexion',
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
    subject: 'VIHEPAT — Réinitialisation de votre mot de passe',
    html,
  });
}

/**
 * 3. Email de bienvenue lors de la création d'un compte soignant
 */
export async function sendWelcomeSoignantEmail(params: {
  to: string;
  prenom: string;
  nom: string;
  matricule?: string;
  structureNom: string;
}) {
  const loginUrl = env.CORS_ORIGIN.split(',')[0] || 'http://localhost:5173';

  const html = emailLayout(`
    <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0;">
      Bienvenue Dr / Soignant(e) ${params.prenom} ${params.nom},
    </p>
    <p>
      Votre compte professionnel sur <strong>VIHEPAT</strong> a été activé avec succès au sein de la structure
      <strong>${params.structureNom}</strong>.
    </p>

    <div class="credentials-box">
      <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">
        Informations professionnelles
      </p>
      <div class="credential-row">
        <span class="credential-label">Structure</span>
        <span class="credential-value" style="font-family: inherit;">${params.structureNom}</span>
      </div>
      ${params.matricule ? `
      <div class="credential-row">
        <span class="credential-label">Matricule professionnel</span>
        <span class="credential-value">${params.matricule}</span>
      </div>` : ''}
      <div class="credential-row">
        <span class="credential-label">Email professionnel</span>
        <span class="credential-value">${params.to}</span>
      </div>
    </div>

    <div class="button-container">
      <a href="${loginUrl}" class="btn" target="_blank">Accéder à l'espace soignant</a>
    </div>

    <div class="disclaimer">
      Chaque consultation et mise à jour de dossier patient est auditée et horodatée conformément aux exigences de confidentialité médicale.
    </div>
  `);

  return sendMail({
    to: params.to,
    subject: 'Bienvenue sur VIHEPAT — Votre compte soignant est actif',
    html,
  });
}

/**
 * 4. Alerte médicale d'urgence envoyée aux soignants lors d'un signalement critique
 */
export async function sendAlerteMedicaleEmail(params: {
  to: string;
  soignantNom: string;
  patientCode: string;
  gravite: string;
  symptome: string;
  notes?: string;
}) {
  const html = emailLayout(`
    <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
      <strong style="color: #991b1b; font-size: 15px;">⚠️ Alerte médicale critique</strong>
      <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 13px;">Un patient suivi dans votre file active vient d'enregistrer un symptôme nécessitant votre attention.</p>
    </div>

    <p style="font-size: 15px;">Bonjour <strong>${params.soignantNom}</strong>,</p>

    <div class="credentials-box">
      <div class="credential-row">
        <span class="credential-label">Patient concerné</span>
        <span class="credential-value">${params.patientCode}</span>
      </div>
      <div class="credential-row">
        <span class="credential-label">Niveau d'alerte</span>
        <span class="credential-value" style="color: #dc2626; text-transform: uppercase;">${params.gravite}</span>
      </div>
      <div class="credential-row">
        <span class="credential-label">Symptôme déclaré</span>
        <span class="credential-value" style="font-family: inherit;">${params.symptome}</span>
      </div>
    </div>

    ${params.notes ? `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 14px;">
      <span style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Détails & Notes de triage :</span>
      <pre style="margin: 6px 0 0 0; font-family: inherit; font-size: 13px; color: #1e293b; white-space: pre-wrap;">${params.notes}</pre>
    </div>` : ''}

    <div class="button-container">
      <a href="${env.CORS_ORIGIN.split(',')[0]}/soignant/dashboard" class="btn" style="background-color: #dc2626;" target="_blank">Consulter le dossier patient</a>
    </div>
  `);

  return sendMail({
    to: params.to,
    subject: `🚨 [Alerte VIHEPAT] Signalement sévère — Patient ${params.patientCode}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// E-mails neutres (discrétion)
// Une boîte mail peut être lue par l'entourage : ces messages ne contiennent ni le nom
// de l'application, ni la pathologie, ni de vocabulaire médical.
// ---------------------------------------------------------------------------

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
