import modele from './perte-de-suivi.modele.json';
import type { BilanInclusion, NiveauEtudes, SituationMatrimoniale } from '../models/BilanInclusion';

/**
 * Modèle 1 de VIHEPAT : risque de perte de suivi d'un patient VIH (ia/perte_de_suivi).
 *
 * Régression logistique entraînée en Python (cohorte LUTH, Nigeria, 2010-2014). Ses paramètres
 * sont exportés dans perte-de-suivi.modele.json par ia/perte_de_suivi/scripts/exporter_modele_node.py,
 * et le calcul est refait ici à l'identique : imputation -> standardisation -> one-hot ->
 * combinaison linéaire -> sigmoïde. Le fichier embarque des cas calculés par scikit-learn,
 * revérifiés au démarrage de l'API (verifierModelePerteSuivi).
 *
 * Le score priorise les relances, le soignant décide : aucune action n'est déclenchée.
 */

export type NiveauRisque = 'faible' | 'modere' | 'eleve';

/** Variables d'origine du modèle (avant transformation), telles qu'expliquées au soignant */
export type VariableModele =
  | 'Age' | 'annees_exposition' | 'nb_examens_manquants'
  | 'log_ALT' | 'sqrt_CD4' | 'log_Creatin' | 'Hemoglob' | 'log_Platelet' | 'log10_CV' | 'TotProt' | 'log_Urea' | 'log_WBC'
  | 'vih_avance' | 'cv_inf_1000' | 'Sex' | 'MaritalStatus' | 'Education' | 'WHOStage';

/** Entrée du modèle : valeurs déjà transformées (log, racine…), null = manquant */
export type EntreeModele = Partial<Record<VariableModele, number | string | null>>;

export interface Facteur {
  variable: VariableModele;
  /** Contribution au logit par rapport au patient moyen de la cohorte : > 0 augmente le risque */
  contribution: number;
}

export interface ResultatRisque {
  probabilite: number;
  niveau: NiveauRisque;
  facteurs: Facteur[];
}

const CATEGORIE_INCONNUE = 'Inconnu';

/** Bornes de plausibilité de la cohorte : une valeur hors bornes est traitée comme manquante */
const BORNES: Record<string, [number, number]> = {
  age: [15, 100], alat: [1, 5000], cd4: [1, 3000], creatinine: [15, 2000], hemoglobine: [2, 20],
  plaquettes: [5, 1500], chargeVirale: [0, 1e7], proteinesTotales: [30, 150], uree: [0.5, 100], leucocytes: [0.5, 100],
};

const MARITAL: Record<SituationMatrimoniale, string> = {
  marie: 'Married', celibataire: 'Single', divorce: 'Divorced', separe: 'Separated', veuf: 'Widowed',
};
// « Aucune scolarité » n'existe pas dans la cohorte : comme scikit-learn pour une modalité
// inconnue (handle_unknown='ignore'), elle n'active aucune colonne.
const EDUCATION: Record<NiveauEtudes, string> = {
  aucun: 'Aucun', primaire: 'Primary', secondaire: 'Secondary', superieur: 'Tertiary',
};

const STANDARD_BIO = new Map(modele.bio.standardisation.map((s) => [s.nom, s]));

function variableDeColonne(colonne: string): VariableModele {
  if (colonne.startsWith('missingindicator_')) return colonne.slice('missingindicator_'.length) as VariableModele;
  const cat = modele.categorielles.find((c) => colonne.startsWith(`${c.nom}_`));
  return (cat ? cat.nom : colonne) as VariableModele;
}

/** Entrée -> vecteur des colonnes du modèle, dans l'ordre de `modele.colonnes` */
function transformer(x: EntreeModele): number[] {
  const valeurs = new Map<string, number>();
  const num = (v: number | string | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // Âge, durée d'exposition, examens manquants : imputation par la moyenne (contribution nulle)
  for (const g of modele.gen) {
    const v = num(x[g.nom as VariableModele]) ?? g.moyenne;
    valeurs.set(g.nom, (v - g.moyenne) / g.ecart);
  }
  // Biologie : médiane + indicateur « non mesuré », les deux standardisés
  for (const b of modele.bio.variables) {
    const brut = num(x[b.nom as VariableModele]);
    const s = STANDARD_BIO.get(b.nom)!;
    valeurs.set(b.nom, ((brut ?? b.mediane) - s.moyenne) / s.ecart);
    const si = STANDARD_BIO.get(`missingindicator_${b.nom}`);
    if (si) valeurs.set(si.nom, ((brut === null ? 1 : 0) - si.moyenne) / si.ecart);
  }
  // Binaires : imputation par le mode, sans standardisation
  for (const b of modele.binaire) valeurs.set(b.nom, num(x[b.nom as VariableModele]) ?? b.mode);
  // Catégorielles : modalité « Inconnu » puis one-hot (une modalité absente n'active rien)
  for (const c of modele.categorielles) {
    const brut = x[c.nom as VariableModele];
    const v = typeof brut === 'string' && brut ? brut : CATEGORIE_INCONNUE;
    for (const cat of c.categories) {
      if (cat !== c.supprimee) valeurs.set(`${c.nom}_${cat}`, v === cat ? 1 : 0);
    }
  }
  return modele.colonnes.map((col) => {
    const v = valeurs.get(col);
    if (v === undefined) throw new Error(`Colonne du modèle non calculée : ${col}`);
    return v;
  });
}

export function niveauRisque(p: number): NiveauRisque {
  if (p >= modele.seuils.eleve) return 'eleve';
  return p >= modele.seuils.modere ? 'modere' : 'faible';
}

export function calculerRisque(x: EntreeModele): ResultatRisque {
  const a = transformer(x);
  let z = modele.intercept;
  const parVariable = new Map<VariableModele, number>();
  a.forEach((v, j) => {
    const coef = modele.coefficients[j]!;
    z += coef * v;
    const variable = variableDeColonne(modele.colonnes[j]!);
    parVariable.set(variable, (parVariable.get(variable) ?? 0) + coef * (v - modele.reference[j]!));
  });
  const probabilite = 1 / (1 + Math.exp(-z));
  const facteurs = Array.from(parVariable, ([variable, contribution]) => ({ variable, contribution }))
    .sort((f1, f2) => Math.abs(f2.contribution) - Math.abs(f1.contribution));
  return { probabilite, niveau: niveauRisque(probabilite), facteurs };
}

/* ------------------------------------------------------------------ */
/* Dossier VIHEPAT -> entrée du modèle                                 */
/* ------------------------------------------------------------------ */

const ANNEE_MS = 365.25 * 24 * 3600 * 1000;

function plausible(champ: keyof typeof BORNES, v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const [lo, hi] = BORNES[champ]!;
  return v < lo || v > hi ? null : v;
}

const EXAMENS = ['cd4', 'chargeVirale', 'alat', 'creatinine', 'hemoglobine', 'plaquettes', 'proteinesTotales', 'uree', 'leucocytes'] as const;

/**
 * Construit l'entrée du modèle à partir du dossier, avec les transformations du notebook
 * (sections 5.1 et 5.2 : nettoyer() puis creer_variables()).
 *
 * Durée d'exposition : dans la cohorte, années entre l'inclusion et la fin de l'étude (2,5 à 6,5).
 * Ici, années depuis l'inclusion dans le parcours (date du bilan, sinon diagnostic, sinon dossier),
 * ramenées dans cet intervalle : le modèle n'a jamais vu de patient suivi depuis moins de 2,5 ans.
 */
export function construireEntree(params: {
  bilan: BilanInclusion;
  dateNaissance?: Date | string | null;
  sexe?: 'M' | 'F' | null;
  dateDiagnostic?: Date | string | null;
  dateDossier: Date | string;
  maintenant?: Date;
}): EntreeModele {
  const { bilan } = params;
  const maintenant = params.maintenant ?? new Date();
  const dateInclusion = new Date(bilan.dateBilan ?? params.dateDiagnostic ?? params.dateDossier);

  // Complétude du bilan, comptée AVANT le filtre de plausibilité (une valeur saisie reste saisie)
  const manquants = [bilan.stadeOms, ...EXAMENS.map((e) => bilan[e])].filter((v) => v === null || v === undefined).length;

  const age = params.dateNaissance
    ? plausible('age', (dateInclusion.getTime() - new Date(params.dateNaissance).getTime()) / ANNEE_MS)
    : null;
  const gen = modele.gen.find((g) => g.nom === 'annees_exposition')!;
  const exposition = Math.min(gen.max, Math.max(gen.min, (maintenant.getTime() - dateInclusion.getTime()) / ANNEE_MS));

  const v = Object.fromEntries(EXAMENS.map((e) => [e, plausible(e, bilan[e])])) as Record<(typeof EXAMENS)[number], number | null>;
  const stade = bilan.stadeOms && bilan.stadeOms >= 1 && bilan.stadeOms <= 4 ? bilan.stadeOms : null;
  const log = (n: number | null) => (n === null ? null : Math.log(n));

  return {
    Age: age === null ? null : Math.floor(age),
    annees_exposition: exposition,
    nb_examens_manquants: manquants,
    log_ALT: log(v.alat),
    sqrt_CD4: v.cd4 === null ? null : Math.sqrt(v.cd4),
    log_Creatin: log(v.creatinine),
    Hemoglob: v.hemoglobine,
    log_Platelet: log(v.plaquettes),
    log10_CV: v.chargeVirale === null ? null : Math.log10(v.chargeVirale + 1),
    TotProt: v.proteinesTotales,
    log_Urea: log(v.uree),
    log_WBC: log(v.leucocytes),
    cv_inf_1000: v.chargeVirale === null ? null : v.chargeVirale < 1000 ? 1 : 0,
    // VIH avancé (définition OMS) : stade 3-4 ou CD4 < 200, inconnu si ni l'un ni l'autre n'est connu
    vih_avance: stade === null && v.cd4 === null ? null : (stade !== null && stade >= 3) || (v.cd4 !== null && v.cd4 < 200) ? 1 : 0,
    Sex: params.sexe === 'M' ? 'Male' : params.sexe === 'F' ? 'Female' : null,
    MaritalStatus: bilan.situationMatrimoniale ? MARITAL[bilan.situationMatrimoniale] : null,
    Education: bilan.niveauEtudes ? EDUCATION[bilan.niveauEtudes] : null,
    WHOStage: stade === null ? null : String(stade),
  };
}

/** Le modèle a été appris sur des patients VIH uniquement */
export function pathologieConcernee(pathologie: string) {
  return pathologie.startsWith('vih');
}

export const INFOS_MODELE = {
  version: modele.version,
  date: modele.date,
  source: modele.source,
  performances: modele.performances_test,
  seuils: modele.seuils,
};

let modeleVerifie: boolean | null = null;

/** Faux si le portage ne redonne pas les probabilités de scikit-learn : le score n'est alors pas affiché. */
export function modeleDisponible() {
  if (modeleVerifie === null) verifierModelePerteSuivi();
  return modeleVerifie === true;
}

/** Recalcule les cas de scikit-learn embarqués dans le JSON : le portage doit être exact. */
export function verifierModelePerteSuivi() {
  let ecartMax = 0;
  for (const cas of modele.cas_de_test) {
    ecartMax = Math.max(ecartMax, Math.abs(calculerRisque(cas.entree as EntreeModele).probabilite - cas.probabilite));
  }
  if (ecartMax > 1e-9) {
    console.error(`❌ Modèle perte de suivi : écart de ${ecartMax.toExponential(2)} avec scikit-learn, score désactivé`);
    modeleVerifie = false;
    return false;
  }
  modeleVerifie = true;
  console.log(`✅ Modèle perte de suivi v${modele.version} vérifié (${modele.cas_de_test.length} cas scikit-learn)`);
  return true;
}
