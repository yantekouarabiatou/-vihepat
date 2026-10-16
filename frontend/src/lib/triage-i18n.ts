import type { TFunction } from "i18next";
import { SIGNES_GRAVES } from "@/lib/triage";

/**
 * Traduction à l'affichage du résultat du triage.
 * `triage.ts` doit rester identique entre le backend et le frontend (script ia:sync-triage)
 * et produit ses motifs/conseils en français (ils sont aussi enregistrés dans le dossier) :
 * on les fait correspondre ici à des clés de traduction, sans toucher au moteur.
 */
const RAISONS: Record<string, string> = {
  "Yeux ou peau jaunes": "jaunisse",
  "Éruption après le début d'un nouveau traitement": "eruption_traitement",
  "Éruption sur la peau": "eruption",
  "Fièvre depuis plus d'une semaine": "fievre_longue",
  "Fièvre avec maux de tête forts": "fievre_maux_tete",
  "Fièvre": "fievre",
  "Toux prolongée avec fièvre ou perte de poids": "toux_longue_fievre",
  "Toux depuis plus d'une semaine": "toux_longue",
  "Diarrhée importante ou prolongée (risque de déshydratation)": "diarrhee_forte",
  "Diarrhée depuis plusieurs jours": "diarrhee_jours",
  "Nausées ou vomissements persistants": "nausees",
  "Douleur au ventre": "douleur_ventre",
  "Maux de tête forts": "maux_tete",
  "Grande fatigue qui dure": "fatigue",
  "Perte de poids": "amaigrissement",
  "Urines très foncées": "urines_foncees",
  "Symptôme fort": "symptome_fort",
  "Symptôme fort depuis plusieurs jours": "symptome_fort_jours",
};

const CONSEILS: [debut: string, cle: string][] = [
  ["Vous n'êtes pas seul(e)", "idees_noires"],
  ["Rendez-vous sans attendre", "urgence"],
  ["Consultez un centre de santé aujourd'hui", "alerte"],
  ["Votre équipe soignante est prévenue. Si ça ne s'améliore pas", "a_surveiller"],
  ["C'est un symptôme courant", "banal"],
];

export function traduireRaison(raison: string, t: TFunction): string {
  const signe = SIGNES_GRAVES.find((s) => s.libelle === raison);
  if (signe) return t(`triage.signes_graves.${signe.id}`);
  const cle = RAISONS[raison];
  return cle ? t(`triage.raisons.${cle}`) : raison;
}

export function traduireConseil(conseil: string, t: TFunction): string {
  const cle = CONSEILS.find(([debut]) => conseil.startsWith(debut))?.[1];
  return cle ? t(`triage.conseils.${cle}`) : conseil;
}
