/**
 * Détection déterministe des signes de gravité dans un texte de patient (lexique v2).
 *
 * En production, ces signes s'ajoutent à ceux de Gemini (union) : les deux méthodes ne ratent pas les
 * mêmes cas, et rater un signe grave coûte plus cher qu'une alerte en trop.
 *
 * v1 = portage du lexique de référence (ia/vihepat_ia/baseline_mots_cles.py). v2 (3/11/2026) :
 * - « je n'arrive plus à respirer » n'est plus lu comme une négation (c'est l'inverse : c'est grave) ;
 * - familles d'expressions élargies (thorax, syncope, cachets, selles noires, idées de mort…) ;
 * - contextes bénins écartés (don de sang, « mourir de rire », essoufflement bref après l'effort…).
 * Mesure sur jeux figés : backend/scripts/evaluer-signes-graves.ts (ia/data/signes_graves_*.jsonl).
 */

export const SIGNES = ['respiration', 'poitrine', 'confusion', 'vomit_traitement', 'saignement', 'malaise', 'idees_noires'] as const;
export type SigneGrave = (typeof SIGNES)[number];

function normaliser(t: string) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/\s+/g, ' ')
    // « je n'arrive plus à… », « je ne peux plus… » décrivent une incapacité, pas une négation du symptôme
    .replace(/\bn arrive (plus|pas) (bien |vraiment )?a\b/g, 'arrive a peine a')
    .replace(/\b(je |il |elle )?ne (peux|peut|parviens|parvient) (plus|pas)\b/g, 'peine a');
}

const TRAITEMENT = '(comprime|medicament|medoc|cachet|pilule|arv|antiretrovir|traitement|dose|prise|tld|dolutegravir|efavirenz|tenofovir)';
// \b pour « rend » : sinon « p-rend-re » suffirait
const REJET = String.raw`(vomi|vomis|rejet|\brends?\b|recrach|remont|ressort|degueul|tient pas|ne restent pas|(peine a|impossible de) garder)`;
// Aucune négation entre le médicament et le rejet (« mes comprimés, je ne les vomis jamais »)
const SANS_NEGATION = String.raw`(?:(?!\bne\b|\bpas\b|\bjamais\b|\bn )[^.]){0,40}`;

const LEXIQUE: Record<SigneGrave, RegExp[]> = {
  respiration: [
    /respir/, /essouffl/, /\betouff/, /suffoqu/, /\bhalet/, /manqu\w* d (air|oxygene)/,
    /air ne (passe|rentre|entre|veut pas entrer)/, /cherch\w* (mon |son )?air/, /reprendre (de l |mon |son )?(air|souffle)/,
    /(bout|court|coupe) de souffle|souffle (court|coupe)/, /levres? (bleu|violet)/, /\bsiffl/, /etrangl/,
  ],
  poitrine: [/poitrine/, /thorax|thoraci/, /\btorse\b/, /sternum/, /coeur (me )?fait mal|serre au niveau du coeur|niveau du coeur/],
  confusion: [
    /\bconfus/, /desorient/, /n importe (quoi|comment)/, /(sais|sait) plus (ou|quel|qui|ce que)/, /reconnai\w* plus|ne reconnai/,
    /embrouill/, /tout melange|mélange tout|melange tout|confonds/, /brouillard/, /oubli\w* (son|mon) nom/,
    /somnol/, /endor\w* partout/, /rester eveill/, /dort tout le temps/, /tres endormi/, /(arrive|arrivons|arrivent) (pas|plus) a (la |le )?reveiller/,
    /repond (a peine|plus)/, /\bagite/, /parle (bizarre|a des gens)/, /choses (bizarres|sans sens)|sans sens/, /tete n est pas claire/,
  ],
  vomit_traitement: [
    new RegExp(`${REJET}${SANS_NEGATION}${TRAITEMENT}`), new RegExp(`${TRAITEMENT}${SANS_NEGATION}${REJET}`),
    /(apres|des que|chaque) .{0,30}(prise|dose).{0,30}(ressort|vomi)/,
  ],
  saignement: [
    /saign/, /\bsang\b/, /hemorrag/, /selles? .{0,20}(noire|goudron)/, /(pipi|urines?).{0,25}rouge|rouge.{0,15}(pipi|urine)/,
    /crach\w* .{0,15}(sang|rouge)/, /vomi\w* .{0,25}(sang|rouge)/, /regles .{0,10}(coulent|abondant|tres|beaucoup)/,
    /pertes de sang/, /bleus .{0,15}(apparaissent|partout)/,
  ],
  malaise: [
    /malaise/, /evanoui/, /perdu (connaissance|conscience)/, /syncope/, /black.?out/, /dans les pommes/,
    /(suis|me suis|s est|se sont) (tombee?|effondree?|ecroulee?)/, /\beffondr/, /\becroul/, /tombe raide/,
    /retrouve\w* (par terre|au sol)/, /reveill\w* (par terre|allonge)/, /devenu noir/, /jambes ont lache/,
  ],
  idees_noires: [
    /suicid/, /\b(me |te |se )?tuer\b/, /en finir/, /me pendre/, /empoisonn/, /mettre fin a (mes jours|ma vie)/,
    /(plus|pas) envie de vivre|arreter de vivre|veux plus vivre|plus aucune raison de|plus de raison de (vivre|continuer)/,
    /plus de sens/, /mieux sans moi|plus tranquille si je n etais plus la|si je n etais plus la/,
    /(plus|jamais) me reveiller/, /disparaitre (pour toujours|pour de bon|a jamais)/, /la mort serait/,
    /me faire du mal/, /que tout s arrete/, /tout prendre d un coup/,
  ],
};

/**
 * Formes qui contiennent elles-mêmes une négation (« je n'ai plus envie de vivre », « je ne sais plus où je
 * suis ») : elles décrivent le danger, le filtre de négation ne s'y applique pas.
 */
const FORMES_NEGATIVES: Partial<Record<SigneGrave, RegExp[]>> = {
  confusion: [/(sais|sait) plus (ou|quel|qui|ce que)/, /reconnai\w* plus|ne reconnai/, /repond (a peine|plus)/],
  idees_noires: [
    /(plus|pas) envie de vivre|veux plus vivre|plus aucune raison de|plus de raison de (vivre|continuer)/,
    /plus de sens/, /(plus|jamais) me reveiller/, /si je n etais plus la/,
  ],
};

/** Contextes bénins qui annulent un signe pour toute la phrase concernée */
const BENIN: Partial<Record<SigneGrave, RegExp>> = {
  respiration: /respire (bien|normalement)|respiration (est )?normale|(harmattan|du vent)|(apres|courir|couru|foot|sport|course).{0,40}(normal|puis ca (va|allait)|une minute)|(normal|puis ca (va|allait)).{0,40}(couru|foot|sport)/,
  saignement: /donne (mon |du )?sang|prise de sang|bilan sanguin|transfusion|goutte de sang|moustique/,
  confusion: /confus (sur|par rapport)|cou .{0,30}(oreiller|mal dormi)/,
  idees_noires: /tue(r)? le temps|tue de rire|mourir de rire/,
};

// Une négation juste avant le mot-clé (dans la même proposition) annule la détection
const NEGATION = /(\bpas\b|\bplus\b|\bjamais\b|\baucun\w*|\brien\b|\bne\b|\bn |\bsans\b|\bni\b)[^.,;!?]{0,25}$/;

function phrases(t: string) {
  return t.split(/[.!?;]+/).map((p) => p.trim()).filter(Boolean);
}

function cherche(phrase: string, motifs: RegExp[]) {
  for (const m of motifs) {
    const re = new RegExp(m.source, 'g');
    for (const hit of phrase.matchAll(re)) {
      const avant = phrase.slice(Math.max(0, hit.index! - 30), hit.index!);
      if (!NEGATION.test(avant)) return true;
    }
  }
  return false;
}

/** Raideur de nuque : un signe d'alerte seulement avec fièvre, maux de tête ou vomissements (méningite) */
function nuqueRaide(t: string) {
  const raideur = /nuque (raide|bloquee|dure)|cou .{0,15}(raide|bloque|dur comme)|baisser la tete|menton .{0,25}poitrine/.test(t);
  const contexte = /fievre|mal a la tete|tete va exploser|lumiere|vomi/.test(t) && !/sans fievre/.test(t);
  return raideur && contexte;
}

export function detecterSignesGraves(texte: string): SigneGrave[] {
  const t = normaliser(texte);
  const trouves = new Set<SigneGrave>();
  for (const phrase of phrases(t)) {
    for (const s of SIGNES) {
      if (BENIN[s]?.test(phrase)) continue;
      if (cherche(phrase, LEXIQUE[s]) || (FORMES_NEGATIVES[s] ?? []).some((m) => m.test(phrase))) trouves.add(s);
    }
  }
  if (nuqueRaide(t)) trouves.add('confusion');
  // Une « poitrine » sans douleur, gêne ni serrement ne suffit pas
  if (trouves.has('poitrine') && !/douleur|douloureu|mal|serre|poids|brul|pique|souffr|appui/.test(t)) trouves.delete('poitrine');
  return SIGNES.filter((s) => trouves.has(s));
}
