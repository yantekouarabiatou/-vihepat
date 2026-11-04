/**
 * Veille des groupes de soutien : repère les messages qui doivent être vus par l'équipe soignante.
 *
 * Volontairement déterministe et lisible (listes de mots, comme le triage) : chaque signalement
 * dit quels mots l'ont déclenché, et la liste se relit et se corrige sans réentraîner quoi que ce
 * soit. Rien n'est bloqué automatiquement : le message est publié, signalé, et un soignant décide
 * (le masquer, contacter le patient, ou classer le signalement).
 *
 * Limites : français uniquement, pas de compréhension du contexte (« j'ai eu peur de mourir »
 * déclenche aussi « détresse »). On accepte ces faux positifs : rater une détresse coûte plus cher.
 */

export const CATEGORIES_ALERTE = ['detresse', 'traitement', 'injure', 'stigmatisation', 'coordonnees'] as const;
export type CategorieAlerte = (typeof CATEGORIES_ALERTE)[number];

/** Minuscules, sans accents, apostrophes et espaces unifiés : « J’ai ARRÊTÉ » -> « j'ai arrete » */
function normaliser(texte: string) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ');
}

/** Expressions écrites sans accents ; un espace accepte n'importe quel blanc */
const LEXIQUE: Record<Exclude<CategorieAlerte, 'coordonnees'>, string[]> = {
  // Idées suicidaires ou désespoir : alerte médicale immédiate
  detresse: [
    'suicide', 'suicider', 'me tuer', 'en finir', 'mettre fin a mes jours', 'mettre fin a ma vie',
    'envie de mourir', 'veux mourir', 'vais mourir', 'mourir', 'plus envie de vivre', 'marre de vivre',
    'me pendre', 'disparaitre pour toujours', 'personne ne me regrettera', 'je ne sers a rien',
  ],
  // Arrêt du traitement ou promesse de guérison : risque pour la santé du groupe
  traitement: [
    'arrete mes medicaments', 'arreter mes medicaments', 'arrete mon traitement', 'arreter mon traitement',
    'arrete le traitement', 'arreter le traitement', 'arrete mes arv', 'arreter les arv', 'arreter mes arv',
    'ne prends plus mes', 'jete mes medicaments', 'plus besoin de medicaments',
    'guerir du vih', 'guerir du sida', 'guerir l\'hepatite', 'remede miracle', 'tisane qui guerit',
    'gueri par la priere', 'les arv tuent', 'les medicaments tuent',
  ],
  injure: [
    'connard', 'connasse', 'salope', 'salaud', 'pute', 'putain', 'encule', 'batard', 'nique', 'ta gueule',
    'ferme ta gueule', 'imbecile', 'abruti', 'cretin', 'idiot', 'debile', 'va te faire', 'pd',
  ],
  // Mots qui blessent les personnes vivant avec le VIH ou une hépatite
  stigmatisation: [
    'sideen', 'sideenne', 'sidaique', 'pestifere', 'sale malade', 'punition de dieu', 'puni par dieu',
    'tu l\'as merite', 'vous l\'avez merite', 'tu l\'as cherche', 'maladie de la honte', 'mal du siecle',
  ],
};

const ORDRE: CategorieAlerte[] = ['detresse', 'traitement', 'injure', 'stigmatisation', 'coordonnees'];

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Bornes de mot adaptées au français (lettres accentuées déjà retirées par normaliser) */
const motifs = Object.fromEntries(
  Object.entries(LEXIQUE).map(([cat, mots]) => [
    cat,
    mots.map((m) => {
      // Un mot isolé accepte le féminin et le pluriel (« sidéennes », « idiots ») ; une expression reste exacte
      const fin = m.includes(' ') ? '' : '(e|s|es|x)?';
      return { mot: m, re: new RegExp(`(^|[^a-z0-9])${echapper(m).replace(/ /g, '\\s+')}${fin}(?=$|[^a-z0-9])`) };
    }),
  ]),
) as Record<Exclude<CategorieAlerte, 'coordonnees'>, { mot: string; re: RegExp }[]>;

// Numéro de téléphone (8 chiffres ou plus, séparateurs permis) ou adresse e-mail : l'anonymat du groupe
const TELEPHONE = /(\+?\d[\d .-]{6,}\d)/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/;

export interface Detection {
  categorie: CategorieAlerte;
  /** Toutes les catégories trouvées, de la plus grave à la moins grave */
  categories: CategorieAlerte[];
  mots: string[];
}

/** Null si rien n'est à signaler ; sinon la catégorie la plus grave et les mots en cause. */
export function detecterMotsSensibles(contenu: string): Detection | null {
  const texte = normaliser(contenu);
  const trouves = new Map<CategorieAlerte, string[]>();
  for (const [cat, liste] of Object.entries(motifs) as [CategorieAlerte, { mot: string; re: RegExp }[]][]) {
    const mots = liste.filter((m) => m.re.test(texte)).map((m) => m.mot);
    if (mots.length) trouves.set(cat, mots);
  }
  const chiffres = texte.match(TELEPHONE)?.[0]?.replace(/\D/g, '') ?? '';
  if (chiffres.length >= 8 || EMAIL.test(texte)) trouves.set('coordonnees', ['coordonnées personnelles']);

  const categories = ORDRE.filter((c) => trouves.has(c));
  if (categories.length === 0) return null;
  return { categorie: categories[0]!, categories, mots: categories.flatMap((c) => trouves.get(c)!) };
}
