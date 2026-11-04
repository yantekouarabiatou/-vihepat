/**
 * Exports de tableaux sans librairie : CSV (Excel français : séparateur « ; », UTF-8 avec BOM),
 * classeur Excel (format XML 2003, ouvert par Excel, LibreOffice et Google Sheets) et PDF via
 * l'impression du navigateur (« Enregistrer au format PDF »).
 * Données médicales : le fichier est créé sur l'appareil, rien n'est envoyé à un service tiers.
 */

export type Cellule = string | number | null | undefined;
export interface Tableau {
  titre: string;
  /** Sous-titre : période, filtres appliqués, date d'export */
  sousTitre?: string;
  colonnes: string[];
  lignes: Cellule[][];
}

const nomFichier = (titre: string, extension: string) =>
  `${titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${extension}`;

function telecharger(contenu: BlobPart, type: string, nom: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const texte = (c: Cellule) => (c === null || c === undefined ? "" : String(c));

export function exporterCsv(t: Tableau) {
  const cellule = (c: Cellule) => {
    const s = texte(c);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lignes = [t.colonnes, ...t.lignes].map((l) => l.map(cellule).join(";"));
  telecharger("﻿" + lignes.join("\r\n"), "text/csv;charset=utf-8", nomFichier(t.titre, "csv"));
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function exporterExcel(t: Tableau) {
  const cellule = (c: Cellule, style = "") =>
    typeof c === "number"
      ? `<Cell${style}><Data ss:Type="Number">${c}</Data></Cell>`
      : `<Cell${style}><Data ss:Type="String">${xml(texte(c))}</Data></Cell>`;
  const feuille = t.titre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  const contenu = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="titre"><Font ss:Bold="1" ss:Size="14"/></Style>
<Style ss:ID="entete"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F766E" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="${xml(feuille)}"><Table>
${t.colonnes.map(() => '<Column ss:AutoFitWidth="1" ss:Width="120"/>').join("")}
<Row>${cellule(t.titre, ' ss:StyleID="titre"')}</Row>
${t.sousTitre ? `<Row>${cellule(t.sousTitre)}</Row>` : ""}
<Row></Row>
<Row>${t.colonnes.map((c) => cellule(c, ' ss:StyleID="entete"')).join("")}</Row>
${t.lignes.map((l) => `<Row>${l.map((c) => cellule(c)).join("")}</Row>`).join("\n")}
</Table></Worksheet></Workbook>`;
  telecharger(contenu, "application/vnd.ms-excel", nomFichier(t.titre, "xls"));
}

/** Ouvre une page imprimable ; le navigateur propose « Enregistrer au format PDF » */
export function imprimerPdf(t: Tableau) {
  const fenetre = window.open("", "_blank");
  if (!fenetre) return false;
  const html = (s: string) => xml(s);
  fenetre.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${html(t.titre)}</title>
<style>
@page { size: A4 landscape; margin: 12mm }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px }
h1 { font-size: 18px; margin: 0 0 4px } p { margin: 0 0 12px; color: #4b5563 }
table { width: 100%; border-collapse: collapse } th { background: #0f766e; color: #fff; text-align: left }
th, td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top } tr:nth-child(even) td { background: #f9fafb }
.pied { margin-top: 12px; font-size: 10px; color: #6b7280 }
</style></head><body>
<h1>${html(t.titre)}</h1>${t.sousTitre ? `<p>${html(t.sousTitre)}</p>` : ""}
<table><thead><tr>${t.colonnes.map((c) => `<th>${html(c)}</th>`).join("")}</tr></thead>
<tbody>${t.lignes.map((l) => `<tr>${l.map((c) => `<td>${html(texte(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>
<p class="pied">VIHEPAT · document confidentiel · ${t.lignes.length} ligne(s)</p>
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
  fenetre.document.close();
  return true;
}
