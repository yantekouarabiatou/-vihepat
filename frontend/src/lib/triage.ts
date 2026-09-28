/**
 * Moteur de triage embarqué (système expert à règles), exécuté entièrement
 * sur l'appareil du patient : aucune connexion n'est nécessaire.
 *
 * Il classe les symptômes déclarés en trois niveaux (banal / à surveiller / alerte)
 * pour orienter le patient et prévenir son équipe soignante. Il ne pose aucun
 * diagnostic et ne remplace jamais un avis médical. Les règles sont volontairement
 * prudentes : en cas de doute, le niveau le plus élevé l'emporte.
 */

export type NiveauTriage = "banal" | "a_surveiller" | "alerte";
export type Duree = "aujourdhui" | "quelques_jours" | "plus_semaine";
export type Intensite = "leger" | "gene" | "fort";

export type SymptomeId =
  | "fievre" | "toux" | "diarrhee" | "nausees" | "eruption" | "jaunisse"
  | "douleur_ventre" | "fatigue" | "maux_tete" | "amaigrissement" | "urines_foncees" | "autre";

export type SigneGraveId =
  | "respiration" | "poitrine" | "confusion" | "vomit_traitement" | "saignement" | "malaise" | "idees_noires";

export interface Symptome {
  id: SymptomeId;
  libelle: string;
  emoji: string;
}

export const SYMPTOMES: Symptome[] = [
  { id: "fievre", libelle: "Fièvre", emoji: "🌡️" },
  { id: "toux", libelle: "Toux", emoji: "😷" },
  { id: "diarrhee", libelle: "Diarrhée", emoji: "🚽" },
  { id: "nausees", libelle: "Nausées, vomissements", emoji: "🤢" },
  { id: "eruption", libelle: "Boutons, éruption sur la peau", emoji: "🔴" },
  { id: "jaunisse", libelle: "Yeux ou peau jaunes", emoji: "🟡" },
  { id: "douleur_ventre", libelle: "Douleur au ventre", emoji: "🤕" },
  { id: "fatigue", libelle: "Grande fatigue", emoji: "😴" },
  { id: "maux_tete", libelle: "Maux de tête", emoji: "🧠" },
  { id: "amaigrissement", libelle: "Perte de poids", emoji: "⚖️" },
  { id: "urines_foncees", libelle: "Urines très foncées", emoji: "🟤" },
  { id: "autre", libelle: "Autre chose", emoji: "💬" },
];

export const SIGNES_GRAVES: { id: SigneGraveId; libelle: string }[] = [
  { id: "respiration", libelle: "J'ai du mal à respirer" },
  { id: "poitrine", libelle: "J'ai une douleur forte dans la poitrine" },
  { id: "confusion", libelle: "Je suis confus(e), très somnolent(e) ou j'ai la nuque raide" },
  { id: "malaise", libelle: "J'ai perdu connaissance ou fait un malaise" },
  { id: "saignement", libelle: "Je saigne beaucoup" },
  { id: "vomit_traitement", libelle: "Je vomis mon traitement depuis plus d'un jour" },
  { id: "idees_noires", libelle: "J'ai des idées de me faire du mal" },
];

export const DUREES: { id: Duree; libelle: string }[] = [
  { id: "aujourdhui", libelle: "Depuis aujourd'hui" },
  { id: "quelques_jours", libelle: "Depuis 2 à 7 jours" },
  { id: "plus_semaine", libelle: "Depuis plus d'une semaine" },
];

export const INTENSITES: { id: Intensite; libelle: string }[] = [
  { id: "leger", libelle: "Léger" },
  { id: "gene", libelle: "Ça me gêne" },
  { id: "fort", libelle: "Fort, je ne peux pas faire mes activités" },
];

export interface EntreeTriage {
  symptomes: SymptomeId[];
  duree: Duree;
  intensite: Intensite;
  signesGraves: SigneGraveId[];
  precision?: string | undefined;
  /** Un traitement a démarré il y a moins de 2 mois (risque de réaction au médicament) */
  traitementRecent?: boolean | undefined;
}

export interface ResultatTriage {
  niveau: NiveauTriage;
  raisons: string[];
  conseil: string;
  urgence: boolean;
}

const ORDRE: Record<NiveauTriage, number> = { banal: 0, a_surveiller: 1, alerte: 2 };

export const NIVEAU_LIBELLES: Record<NiveauTriage, string> = {
  banal: "Banal",
  a_surveiller: "À surveiller",
  alerte: "Alerte",
};

/** Correspondance avec la gravité stockée côté serveur. */
export const NIVEAU_VERS_GRAVITE: Record<NiveauTriage, "leger" | "modere" | "severe"> = {
  banal: "leger",
  a_surveiller: "modere",
  alerte: "severe",
};

export function evaluerTriage(e: EntreeTriage): ResultatTriage {
  // Le niveau est relevé dans la fonction « monter » : on évite le rétrécissement de type
  let niveau = "banal" as NiveauTriage;

  const raisons: string[] = [];
  const a = (s: SymptomeId) => e.symptomes.includes(s);
  const monter = (n: NiveauTriage, raison: string) => {
    if (ORDRE[n] > ORDRE[niveau]) niveau = n;
    if (ORDRE[n] > 0) raisons.push(raison);
  };

  // 1. Signes de gravité : alerte immédiate
  for (const s of e.signesGraves) {
    const libelle = SIGNES_GRAVES.find((x) => x.id === s)?.libelle ?? s;
    monter("alerte", libelle);
  }

  const long = e.duree === "plus_semaine";
  const plusieursJours = e.duree !== "aujourdhui";
  const fort = e.intensite === "fort";

  // 2. Règles par symptôme
  if (a("jaunisse")) monter("alerte", "Yeux ou peau jaunes");
  if (a("eruption") && e.traitementRecent) monter("alerte", "Éruption après le début d'un nouveau traitement");
  else if (a("eruption")) monter(fort ? "alerte" : "a_surveiller", "Éruption sur la peau");

  if (a("fievre")) {
    if (long) monter("alerte", "Fièvre depuis plus d'une semaine");
    else if (a("maux_tete") && fort) monter("alerte", "Fièvre avec maux de tête forts");
    else monter("a_surveiller", "Fièvre");
  }
  if (a("toux")) {
    if (long && (a("fievre") || a("amaigrissement"))) monter("alerte", "Toux prolongée avec fièvre ou perte de poids");
    else if (long) monter("a_surveiller", "Toux depuis plus d'une semaine");
  }
  if (a("diarrhee")) {
    if (long || fort) monter("alerte", "Diarrhée importante ou prolongée (risque de déshydratation)");
    else if (plusieursJours) monter("a_surveiller", "Diarrhée depuis plusieurs jours");
  }
  if (a("nausees") && (fort || long)) monter("a_surveiller", "Nausées ou vomissements persistants");
  if (a("douleur_ventre")) monter(fort ? "alerte" : "a_surveiller", "Douleur au ventre");
  if (a("maux_tete") && fort) monter("a_surveiller", "Maux de tête forts");
  if (a("fatigue") && long && fort) monter("a_surveiller", "Grande fatigue qui dure");
  if (a("amaigrissement")) monter("a_surveiller", "Perte de poids");
  if (a("urines_foncees")) monter("a_surveiller", "Urines très foncées");
  if (a("autre") && fort) monter("a_surveiller", "Symptôme fort");

  // 3. Intensité forte sur plusieurs jours : jamais « banal »
  if (fort && plusieursJours) monter("a_surveiller", "Symptôme fort depuis plusieurs jours");

  const urgence = e.signesGraves.length > 0;
  const conseil =
    e.signesGraves.includes("idees_noires")
      ? "Vous n'êtes pas seul(e). Parlez-en tout de suite à une personne de confiance et contactez les secours ou rendez-vous au centre de santé le plus proche. Votre équipe soignante est prévenue."
      : urgence
        ? "Rendez-vous sans attendre au centre de santé le plus proche ou appelez les secours. Votre équipe soignante est prévenue."
        : niveau === "alerte"
          ? "Consultez un centre de santé aujourd'hui. Votre équipe soignante est prévenue et pourra vous recontacter."
          : niveau === "a_surveiller"
            ? "Votre équipe soignante est prévenue. Si ça ne s'améliore pas dans les prochains jours, ou si ça s'aggrave, consultez."
            : "C'est un symptôme courant. Surveillez-le et refaites le point s'il persiste ou s'aggrave.";

  return { niveau, raisons: Array.from(new Set(raisons)), conseil, urgence };
}

/** Texte structuré transmis à l'équipe soignante. */
export function resumeSignalement(e: EntreeTriage, r: ResultatTriage) {
  const libelles = e.symptomes.map((s) => (s === "autre" && e.precision ? e.precision : SYMPTOMES.find((x) => x.id === s)?.libelle ?? s));
  const symptome = libelles.join(", ").slice(0, 150);
  const lignes = [
    `Triage embarqué : ${NIVEAU_LIBELLES[r.niveau]}`,
    `Durée : ${DUREES.find((d) => d.id === e.duree)?.libelle ?? e.duree}`,
    `Intensité : ${INTENSITES.find((i) => i.id === e.intensite)?.libelle ?? e.intensite}`,
  ];
  if (e.signesGraves.length) {
    lignes.push(`Signes de gravité : ${e.signesGraves.map((s) => SIGNES_GRAVES.find((x) => x.id === s)?.libelle ?? s).join(" ; ")}`);
  }
  if (r.raisons.length) lignes.push(`Motifs : ${r.raisons.join(" ; ")}`);
  if (e.precision) lignes.push(`Précision du patient : ${e.precision}`);
  return { symptome, gravite: NIVEAU_VERS_GRAVITE[r.niveau], notes: lignes.join("\n") };
}
