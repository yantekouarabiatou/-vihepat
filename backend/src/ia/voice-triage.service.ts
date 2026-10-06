import { z } from 'zod';
import prompt from './extraction.json';
import { genererContenu, GeminiError, type GeminiUsage } from './gemini.client';
import { evaluerTriage, type EntreeTriage, type ResultatTriage } from './triage';

/**
 * Chaîne « note vocale -> transcription -> structuration -> priorité ».
 *
 * Gemini ne fait que transcrire et extraire des champs fermés (schéma JSON imposé).
 * La priorité d'alerte est calculée ensuite par le moteur de règles déterministe
 * (triage.ts), le même que celui qui tourne hors ligne sur le téléphone du patient.
 */

const extractionSchema = z.object({
  transcription: z.string(),
  langue: z.enum(['fr', 'fon', 'mixte', 'autre']),
  symptomes: z.array(z.enum([
    'fievre', 'toux', 'diarrhee', 'nausees', 'eruption', 'jaunisse',
    'douleur_ventre', 'fatigue', 'maux_tete', 'amaigrissement', 'urines_foncees', 'autre',
  ])),
  duree: z.enum(['aujourdhui', 'quelques_jours', 'plus_semaine', 'inconnue']),
  intensite: z.enum(['leger', 'gene', 'fort', 'inconnue']),
  signes_graves: z.array(z.enum([
    'respiration', 'poitrine', 'confusion', 'vomit_traitement', 'saignement', 'malaise', 'idees_noires',
  ])),
  precision: z.string().optional(),
});

export type Extraction = z.infer<typeof extractionSchema>;

export interface ResultatTriageVocal {
  extraction: Extraction;
  /**
   * Faux quand la note n'est pas détectée en français, seule langue comprise de façon fiable. Mesuré sur nos
   * enregistrements (ia/RESULTATS.md, section vraies voix) : en fon, les symptômes extraits sont
   * inventés et aucune alerte n'est détectée. Le formulaire ne doit alors pas être pré-rempli.
   */
  utilisable: boolean;
  entree: EntreeTriage;
  triage: ResultatTriage;
  mesures: {
    promptVersion: string;
    modele: string;
    latenceGeminiMs: number;
    latenceTotaleMs: number;
    tentatives: number;
    tokens: GeminiUsage;
  };
}

/** Valeurs par défaut quand le patient n'a pas précisé : celles du formulaire manuel. */
export function versEntree(x: Extraction, traitementRecent: boolean): EntreeTriage {
  return {
    symptomes: Array.from(new Set(x.symptomes)),
    duree: x.duree === 'inconnue' ? 'aujourdhui' : x.duree,
    intensite: x.intensite === 'inconnue' ? 'leger' : x.intensite,
    signesGraves: Array.from(new Set(x.signes_graves)),
    precision: x.precision?.trim() || undefined,
    noteVocale: x.transcription.trim() || undefined,
    traitementRecent,
  };
}

function analyser(texte: string): Extraction {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new GeminiError('Réponse de Gemini non conforme (JSON illisible)', 'reponse_vide');
  }
  const r = extractionSchema.safeParse(brut);
  if (!r.success) throw new GeminiError('Réponse de Gemini non conforme au schéma', 'reponse_vide');
  return r.data;
}

export async function trierNoteVocale(params: {
  audioBase64: string;
  mimeType: string;
  traitementRecent: boolean;
}): Promise<ResultatTriageVocal> {
  const debut = performance.now();
  const g = await genererContenu({
    system: prompt.system,
    parts: [
      { inlineData: { mimeType: params.mimeType, data: params.audioBase64 } },
      { text: prompt.user_audio },
    ],
    schema: prompt.schema,
    temperature: prompt.generation.temperature,
    responseMimeType: prompt.generation.responseMimeType,
  });
  const extraction = analyser(g.text);
  const entree = versEntree(extraction, params.traitementRecent);
  const triage = evaluerTriage(entree);

  return {
    extraction,
    // Seul le français est fiable : une note en fon est parfois classée « mixte » (voir transcription.service.ts)
    utilisable: extraction.langue === 'fr',
    entree,
    triage,
    mesures: {
      promptVersion: prompt.version,
      modele: g.modelVersion,
      latenceGeminiMs: g.latencyMs,
      latenceTotaleMs: Math.round(performance.now() - debut),
      tentatives: g.attempts,
      tokens: g.usage,
    },
  };
}
