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


/**
 * Template de base HTML soigné et responsive pour VIHEPAT
 */
export function emailLayout(contentHtml: string, previewText = 'VIHEPAT Assistant de suivi de santé'): string {
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
