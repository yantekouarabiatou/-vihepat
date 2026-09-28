/**
 * Générateur officiel de Fiche d'Accès Patient & Identifiants VIHEPAT.
 * - Génération PDF 1.4 vectoriel autonome sans dépendance lourde externe (0ms latence).
 * - Téléchargement direct du fichier .pdf conforme standard ISO 32000.
 * - Fonction d'impression médicale A4 immédiate avec mise en page soignée.
 */

export interface PatientCredentialsDoc {
  patient: {
    prenom: string;
    nom: string;
    codePatient: string;
    email: string;
    pathologie?: string;
    telephone?: string | null;
    sexe?: string | null;
  };
  motDePasseTemporaire: string;
  structure?: string;
  emetteurNom?: string;
  dateCreation?: string;
  urlPortail?: string;
}

const LIBELLES_PATHOLOGIES: Record<string, string> = {
  vih: 'Infection par le VIH',
  vhb: 'Hépatite Virale B',
  vhc: 'Hépatite Virale C',
  vih_vhb: 'Co-infection VIH + Hépatite B',
  vih_vhc: 'Co-infection VIH + Hépatite C',
  vhb_vhc: 'Co-infection Hépatites B + C',
};

function formatPathologie(patho?: string): string {
  if (!patho) return 'Suivi infectiologie / hépatique';
  return LIBELLES_PATHOLOGIES[patho] || patho;
}

function sanitizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\u00e0-\u00e5]/g, 'a')
    .replace(/[\u00e8-\u00eb]/g, 'e')
    .replace(/[\u00ec-\u00ef]/g, 'i')
    .replace(/[\u00f2-\u00f6]/g, 'o')
    .replace(/[\u00f9-\u00fc]/g, 'u')
    .replace(/[\u00c0-\u00c5]/g, 'A')
    .replace(/[\u00c8-\u00cb]/g, 'E')
    .replace(/[\u00cc-\u00cf]/g, 'I')
    .replace(/[\u00d2-\u00d6]/g, 'O')
    .replace(/[\u00d9-\u00dc]/g, 'U')
    .replace(/[\u00e7]/g, 'c')
    .replace(/[\u00c7]/g, 'C')
    .replace(/[^\x20-\x7E]/g, ' ');
}

/**
 * Génère le fichier PDF 1.4 binaire sous forme de Blob.
 */
export function genererFichePatientPdfBlob(data: PatientCredentialsDoc): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];

  function addChunk(str: string) {
    const bytes = enc.encode(str);
    chunks.push(bytes);
    offset += bytes.length;
  }

  // En-tête PDF 1.4
  addChunk("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const objects: string[] = [];

  // 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // 2: Pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

  // 3: Page (A4 standard: 595.28 x 841.89 pt)
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj\n`
  );

  let stream = '';

  function setFill(r: number, g: number, b: number) {
    stream += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`;
  }
  function setStroke(r: number, g: number, b: number) {
    stream += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n`;
  }
  function setLineWidth(w: number) {
    stream += `${w} w\n`;
  }
  function rect(x: number, y: number, w: number, h: number, fill = true, stroke = false) {
    stream += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${
      fill && stroke ? 'B' : fill ? 'f' : 'S'
    }\n`;
  }
  function line(x1: number, y1: number, x2: number, y2: number) {
    stream += `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
  }
  function text(font: string, size: number, x: number, y: number, str: string, r = 0.1, g = 0.15, b = 0.2) {
    setFill(r, g, b);
    stream += `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${sanitizeText(str)}) Tj ET\n`;
  }

  const portailUrl =
    data.urlPortail ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://vihepat.sante.bj');
  const dateFormatee = data.dateCreation || new Date().toLocaleDateString('fr-FR');
  const structureLibelle = data.structure || 'Centre de Reference Hospitalier';
  const pathologieLibelle = formatPathologie(data.patient.pathologie);

  // Bannière supérieure bleue médicale
  setFill(0.04, 0.25, 0.45);
  rect(0, 770, 595.28, 72, true, false);

  setFill(0.08, 0.55, 0.65);
  rect(0, 765, 595.28, 5, true, false);

  text('F2', 20, 40, 805, 'VIHEPAT', 1, 1, 1);
  text('F1', 10, 140, 808, 'REPUBLIQUE DU BENIN  -  MINISTERE DE LA SANTE', 0.85, 0.95, 1);
  text('F1', 9, 40, 782, 'Plateforme Nationale Integree de Prise en Charge VIH & Hepatites', 0.8, 0.9, 0.95);

  // Titre du Document & Badge de confidentialité
  setFill(0.95, 0.97, 0.99);
  setStroke(0.85, 0.9, 0.95);
  setLineWidth(1);
  rect(40, 705, 515.28, 45, true, true);

  text('F2', 13, 55, 730, "FICHE D'ACCES PATIENT & IDENTIFIANTS DE CONNEXION", 0.05, 0.3, 0.5);
  text('F1', 8.5, 55, 715, 'DOCUMENT STRICTEMENT CONFIDENTIEL  -  A REMETTRE EN MAIN PROPRE AU PATIENT', 0.8, 0.2, 0.2);

  // 1. CARTE DOSSIER PATIENT
  setFill(0.98, 0.98, 0.99);
  setStroke(0.82, 0.86, 0.92);
  rect(40, 575, 515.28, 115, true, true);

  setFill(0.05, 0.35, 0.55);
  rect(40, 665, 515.28, 25, true, false);
  text('F2', 10, 55, 673, '1. INFORMATIONS DU DOSSIER MEDICAL', 1, 1, 1);

  text('F2', 9, 55, 642, 'Nom & Prenom :', 0.35, 0.4, 0.45);
  text('F2', 11, 150, 642, `${data.patient.prenom} ${data.patient.nom}`, 0.1, 0.15, 0.2);

  text('F2', 9, 320, 642, 'Code Patient Unique :', 0.35, 0.4, 0.45);
  text('F2', 11, 440, 642, data.patient.codePatient, 0.05, 0.35, 0.55);

  text('F2', 9, 55, 617, 'Pathologie suivie :', 0.35, 0.4, 0.45);
  text('F1', 10, 150, 617, pathologieLibelle, 0.15, 0.2, 0.25);

  text('F2', 9, 320, 617, "Date d'emission :", 0.35, 0.4, 0.45);
  text('F1', 10, 440, 617, dateFormatee, 0.15, 0.2, 0.25);

  text('F2', 9, 55, 592, 'Telephone :', 0.35, 0.4, 0.45);
  text('F1', 10, 150, 592, data.patient.telephone || 'Non renseigne', 0.15, 0.2, 0.25);

  text('F2', 9, 320, 592, 'Etablissement :', 0.35, 0.4, 0.45);
  text('F1', 10, 440, 592, structureLibelle, 0.15, 0.2, 0.25);

  // 2. IDENTIFIANTS OFFICIELS (CADRE MIS EN VALEUR)
  setFill(0.93, 0.97, 1.0);
  setStroke(0.1, 0.5, 0.7);
  setLineWidth(1.5);
  rect(40, 425, 515.28, 135, true, true);

  setFill(0.05, 0.4, 0.6);
  rect(40, 535, 515.28, 25, true, false);
  text('F2', 10, 55, 543, '2. IDENTIFIANTS OFFICIELS DE PREMIERE CONNEXION', 1, 1, 1);

  text('F1', 9.5, 55, 512, 'Adresse du portail web :', 0.3, 0.35, 0.4);
  text('F2', 10.5, 200, 512, portailUrl, 0.05, 0.35, 0.65);

  text('F1', 9.5, 55, 485, 'Identifiant (Email) :', 0.3, 0.35, 0.4);
  text('F2', 11, 200, 485, data.patient.email, 0.1, 0.1, 0.1);

  text('F1', 9.5, 55, 452, 'Mot de passe temporaire :', 0.3, 0.35, 0.4);

  // Cartouche mot de passe temporaire
  setFill(1, 1, 1);
  setStroke(0.05, 0.6, 0.4);
  setLineWidth(1.5);
  rect(200, 442, 190, 26, true, true);
  text('F3', 13, 215, 451, data.motDePasseTemporaire, 0.05, 0.5, 0.35);

  text('F1', 8, 400, 451, '(A conserver secretement)', 0.5, 0.5, 0.5);

  // 3. GUIDE D'UTILISATION POUR LE PATIENT
  setFill(0.99, 0.99, 0.99);
  setStroke(0.85, 0.88, 0.92);
  setLineWidth(1);
  rect(40, 245, 515.28, 165, true, true);

  setFill(0.2, 0.25, 0.3);
  rect(40, 385, 515.28, 25, true, false);
  text('F2', 10, 55, 393, '3. COMMENT UTILISER VOTRE ESPACE PATIENT ?', 1, 1, 1);

  text('F2', 9, 55, 365, 'Etape 1 :', 0.05, 0.4, 0.6);
  text('F1', 9, 105, 365, 'Ouvrez le navigateur de votre telephone ou ordinateur et allez sur le site VIHEPAT.', 0.15, 0.2, 0.25);

  text('F2', 9, 55, 342, 'Etape 2 :', 0.05, 0.4, 0.6);
  text('F1', 9, 105, 342, 'Cliquez sur "Se connecter", puis entrez votre email et votre mot de passe temporaire.', 0.15, 0.2, 0.25);

  text('F2', 9, 55, 319, 'Etape 3 :', 0.05, 0.4, 0.6);
  text('F1', 9, 105, 319, 'Definissez votre mot de passe personnel definitif des la premiere connexion.', 0.15, 0.2, 0.25);

  text('F2', 9, 55, 296, 'Etape 4 :', 0.05, 0.4, 0.6);
  text('F1', 9, 105, 296, 'Accedez a vos rappels de prises, vos rendez-vous medicaux et vos bilans de sante.', 0.15, 0.2, 0.25);

  // Avertissement de sécurité
  setFill(0.99, 0.95, 0.93);
  setStroke(0.9, 0.5, 0.3);
  rect(55, 255, 485.28, 28, true, true);
  text('F2', 8, 65, 271, 'AVERTISSEMENT SECURITE :', 0.7, 0.2, 0.1);
  text('F1', 8, 205, 271, 'Ne donnez jamais votre mot de passe a quiconque.', 0.2, 0.2, 0.2);
  text('F1', 8, 65, 260, 'L administration et les soignants ne vous demanderont jamais votre code secret.', 0.4, 0.4, 0.4);

  // 4. SIGNATURES ET REMISE EN MAIN PROPRE
  setFill(0.98, 0.98, 0.98);
  setStroke(0.85, 0.88, 0.92);
  rect(40, 95, 515.28, 135, true, true);

  line(297, 95, 297, 230);

  text('F2', 9, 55, 212, 'Signature & Cachet du Soignant / Centre :', 0.25, 0.3, 0.35);
  text('F1', 8, 55, 115, 'Nom du praticien : ' + (data.emetteurNom || 'Equipe Soignante VIHEPAT'), 0.4, 0.45, 0.5);

  text('F2', 9, 315, 212, 'Emargement du Patient (Remise en main propre) :', 0.25, 0.3, 0.35);
  text('F1', 8, 315, 115, 'Date de remise : ____ / ____ / ________', 0.4, 0.45, 0.5);

  // Pied de page sécurisé
  setFill(0.04, 0.25, 0.45);
  rect(0, 0, 595.28, 45, true, false);

  text('F1', 8, 40, 25, 'VIHEPAT  -  Systeme Securise de Suivi des Maladies Chroniques Virales', 0.9, 0.95, 1);
  text(
    'F1',
    7.5,
    40,
    14,
    'Conforme aux reglementations sanitaires et de protection des donnees de sante  |  Support : contact@vihepat.org',
    0.7,
    0.8,
    0.9
  );

  // 4: Contents Stream
  const streamBytes = enc.encode(stream);
  objects.push(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream\nendobj\n`);

  // Fonts
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects.push(
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );
  objects.push(
    `7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Construction des objets et du catalogue xref
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = offset;
    addChunk(objects[i]);
  }

  const startxref = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  addChunk(xref);

  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLen);
  let cur = 0;
  for (const c of chunks) {
    result.set(c, cur);
    cur += c.length;
  }

  return new Blob([result], { type: 'application/pdf' });
}

/**
 * Déclenche le téléchargement immédiat du fichier PDF dans le navigateur du client.
 */
export function telechargerFichePatientPdf(data: PatientCredentialsDoc, filename?: string): void {
  const blob = genererFichePatientPdfBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `fiche-acces-patient-${data.patient.codePatient.toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Ouvre une fenêtre d'impression avec la fiche d'accès mise en page au format A4.
 */
export function imprimerFichePatient(data: PatientCredentialsDoc): void {
  const portailUrl =
    data.urlPortail ||
    (typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://vihepat.sante.bj');
  const dateFormatee = data.dateCreation || new Date().toLocaleDateString('fr-FR');
  const structureLibelle = data.structure || 'Centre de Référence Hospitalier';
  const pathologieLibelle = formatPathologie(data.patient.pathologie);

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche d'Accès Patient - ${data.patient.codePatient}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #fff;
      font-size: 13px;
      line-height: 1.45;
    }
    .header-bar {
      background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .header-title p {
      font-size: 11px;
      color: #e0f2fe;
      margin-top: 2px;
    }
    .badge-confidential {
      background: #fee2e2;
      border: 1px solid #ef4444;
      color: #991b1b;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 14px;
      overflow: hidden;
      background: #f8fafc;
    }
    .section-head {
      background: #0f766e;
      color: white;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .section-head.highlight {
      background: #0284c7;
    }
    .section-head.neutral {
      background: #334155;
    }
    .section-body {
      padding: 12px 16px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
    }
    .info-row {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 10.5px;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 2px;
    }
    .info-value {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .info-value.code {
      font-family: monospace;
      color: #0369a1;
      font-size: 15px;
      letter-spacing: 0.5px;
    }
    .cred-box {
      background: #f0fdf4;
      border: 2px dashed #16a34a;
      border-radius: 8px;
      padding: 14px;
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .password-badge {
      font-family: monospace;
      font-size: 18px;
      font-weight: 800;
      color: #15803d;
      background: #ffffff;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #86efac;
      letter-spacing: 2px;
    }
    .steps-list {
      padding-left: 20px;
      margin-top: 4px;
    }
    .steps-list li {
      margin-bottom: 6px;
      font-size: 12px;
      color: #334155;
    }
    .steps-list strong {
      color: #0f172a;
    }
    .security-notice {
      background: #fff7ed;
      border-left: 4px solid #f97316;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 11px;
      color: #9a3412;
      margin-top: 10px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      margin-top: 12px;
      background: #fafafa;
    }
    .signature-box {
      display: flex;
      flex-direction: column;
      height: 90px;
      justify-content: space-between;
    }
    .signature-title {
      font-weight: 700;
      font-size: 11px;
      color: #334155;
      text-transform: uppercase;
    }
    .signature-footer {
      font-size: 10px;
      color: #64748b;
      border-top: 1px dotted #94a3b8;
      padding-top: 4px;
    }
    .footer-doc {
      margin-top: 16px;
      text-align: center;
      font-size: 10px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="header-title">
      <h1>VIHEPAT · PORTAIL SANTÉ</h1>
      <p>RÉPUBLIQUE DU BÉNIN — MINISTÈRE DE LA SANTÉ</p>
    </div>
    <div class="badge-confidential">Remise en main propre</div>
  </div>

  <div class="section-card">
    <div class="section-head">1. Informations du Dossier Patient</div>
    <div class="section-body">
      <div class="grid-2">
        <div class="info-row">
          <span class="info-label">Nom & Prénom du Patient</span>
          <span class="info-value">${data.patient.prenom} ${data.patient.nom}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Code Patient Unique</span>
          <span class="info-value code">${data.patient.codePatient}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pathologie Suivie</span>
          <span class="info-value">${pathologieLibelle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date de Création</span>
          <span class="info-value">${dateFormatee}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Téléphone</span>
          <span class="info-value">${data.patient.telephone || 'Non renseigné'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Centre Hospitalier Référent</span>
          <span class="info-value">${structureLibelle}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="section-card">
    <div class="section-head highlight">2. Identifiants Officiels de Connexion</div>
    <div class="section-body">
      <div class="grid-2" style="margin-bottom: 12px;">
        <div class="info-row">
          <span class="info-label">Portail d'accès en ligne</span>
          <span class="info-value" style="color: #0284c7;">${portailUrl}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Identifiant (Email)</span>
          <span class="info-value">${data.patient.email}</span>
        </div>
      </div>

      <div class="cred-box">
        <div>
          <span class="info-label" style="color: #166534;">Mot de passe temporaire initial :</span>
          <p style="font-size: 11px; color: #15803d; margin-top: 2px;">Vous devez le modifier dès votre première connexion.</p>
        </div>
        <div class="password-badge">${data.motDePasseTemporaire}</div>
      </div>
    </div>
  </div>

  <div class="section-card">
    <div class="section-head neutral">3. Guide de Première Connexion</div>
    <div class="section-body">
      <ol class="steps-list">
        <li><strong>Étape 1 :</strong> Accédez à l'adresse <u>${portailUrl}</u> sur votre smartphone, tablette ou ordinateur.</li>
        <li><strong>Étape 2 :</strong> Cliquez sur <strong>« Se connecter »</strong> et renseignez votre email (<em>${data.patient.email}</em>) ainsi que le mot de passe temporaire ci-dessus.</li>
        <li><strong>Étape 3 :</strong> Choisissez immédiatement votre mot de passe personnel définitif et sécurisé.</li>
        <li><strong>Étape 4 :</strong> Retrouvez vos rappels de prises de médicaments, vos prochains rendez-vous et vos bilans de santé.</li>
      </ol>
      <div class="security-notice">
        <strong>⚠️ Avertissement de sécurité :</strong> Ne communiquez jamais ce document ni vos identifiants à des tiers. Les professionnels de santé ne vous demanderont jamais votre mot de passe personnel.
      </div>
    </div>
  </div>

  <div class="signatures-grid">
    <div class="signature-box">
      <div class="signature-title">Signature & Cachet du Soignant / Centre</div>
      <div class="signature-footer">Nom du praticien : ${data.emetteurNom || 'Équipe Soignante VIHEPAT'}</div>
    </div>
    <div class="signature-box">
      <div class="signature-title">Émargement du Patient (Remise en main propre)</div>
      <div class="signature-footer">Date de remise : _____ / _____ / _________</div>
    </div>
  </div>

  <div class="footer-doc">
    VIHEPAT · Système National Sécurisé de Suivi Thérapeutique des Maladies Infectieuses Virales<br/>
    Document officiel généré pour le patient ${data.patient.codePatient} · Support : contact@vihepat.org
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
`;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
