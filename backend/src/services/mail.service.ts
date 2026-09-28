import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Transporteur SMTP configuré pour Brevo (ou tout relais SMTP standard)
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
  tls: {
    rejectUnauthorized: false,
  },
});

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envoie un email de manière sécurisée (ne bloque pas l'exécution en cas d'erreur réseau)
 */
export async function sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const from = `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>`;
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
 * Vérifie la connectivité au serveur SMTP Brevo
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await mailTransporter.verify();
    console.log(`✅ [SMTP BREVO] Connecté avec succès à ${env.MAIL_HOST}:${env.MAIL_PORT} (${env.MAIL_USERNAME})`);
    return true;
  } catch (err) {
    console.warn(`⚠️ [SMTP BREVO] Attention, impossible de joindre le serveur SMTP (${env.MAIL_HOST}) :`, err);
    return false;
  }
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
