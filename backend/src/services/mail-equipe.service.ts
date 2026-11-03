import { env } from '../config/env';
import { emailLayout, sendMail, verifySmtpConnection } from './mail-transport';

/** E-mails destinés à l'équipe (test de la messagerie, bienvenue soignant, alerte médicale). */

/** Diagnostic depuis l'espace admin : connexion SMTP puis envoi réel à l'adresse donnée. */
export async function sendTestEmail(to: string) {
  const connexion = await verifySmtpConnection();
  if (!connexion.ok) {
    return { success: false, etape: 'connexion', serveur: `${env.MAIL_HOST}:${env.MAIL_PORT}`, error: connexion.error };
  }
  const envoi = await sendMail({
    to,
    subject: 'VIHEPAT Test de la messagerie',
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
    subject: 'Bienvenue sur VIHEPAT Votre compte soignant est actif',
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
    subject: `🚨 [Alerte VIHEPAT] Signalement sévère Patient ${params.patientCode}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// E-mails neutres (discrétion)
// Une boîte mail peut être lue par l'entourage : ces messages ne contiennent ni le nom
// de l'application, ni la pathologie, ni de vocabulaire médical.
// ---------------------------------------------------------------------------
