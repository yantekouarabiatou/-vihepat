import { z } from 'zod';
import prompt from './extraction.json';
import { genererContenu, GeminiError, type GeminiPart, type GeminiUsage } from './gemini.client';
import { elevenlabsConfigure, transcrireElevenLabs, versLangue, type ResultatElevenLabs } from './elevenlabs.client';
import { evaluerTriage, type EntreeTriage, type ResultatTriage } from './triage';

/**
 * Chaîne « note vocale -> transcription -> structuration -> priorité ».
 *
 * La transcription passe d'abord par ElevenLabs (Scribe) ; Gemini n'extrait alors que des champs
 * fermés à partir du texte (schéma JSON imposé). Sans ElevenLabs, ou s'il échoue, Gemini écoute l'audio.
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
    fournisseurTranscription: 'elevenlabs' | 'gemini';
    latenceTranscriptionMs?: number;
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

  let transcrit: ResultatElevenLabs | null = null;
  if (elevenlabsConfigure()) {
    try {
      transcrit = await transcrireElevenLabs(params.audioBase64, params.mimeType);
    } catch (err) {
      console.warn('Échec de la transcription ElevenLabs, Gemini écoute la note :', (err as Error).message);
    }
  }

  // Note non française : on n'appelle pas Gemini, qui inventerait des symptômes (formulaire non pré-rempli)
  if (transcrit && versLangue(transcrit.codeLangue) !== 'fr') {
    const extraction: Extraction = {
      transcription: transcrit.texte, langue: versLangue(transcrit.codeLangue),
      symptomes: [], duree: 'inconnue', intensite: 'inconnue', signes_graves: [],
    };
    const entree = versEntree(extraction, params.traitementRecent);
    return {
      extraction,
      utilisable: false,
      entree,
      triage: evaluerTriage(entree),
      mesures: {
        fournisseurTranscription: 'elevenlabs',
        latenceTranscriptionMs: transcrit.latencyMs,
        promptVersion: prompt.version,
        modele: transcrit.modele,
        latenceGeminiMs: 0,
        latenceTotaleMs: Math.round(performance.now() - debut),
        tentatives: 0,
        tokens: { promptTokens: 0, outputTokens: 0, thoughtsTokens: 0, audioPromptTokens: 0 },
      },
    };
  }

  const parts: GeminiPart[] = transcrit
    ? [{ text: prompt.user_text + transcrit.texte }]
    : [{ inlineData: { mimeType: params.mimeType, data: params.audioBase64 } }, { text: prompt.user_audio }];
  const g = await genererContenu({
    system: prompt.system,
    parts,
    schema: prompt.schema,
    temperature: prompt.generation.temperature,
    responseMimeType: prompt.generation.responseMimeType,
  });
  const extraction = analyser(g.text);
  // La transcription et la langue d'ElevenLabs font foi : Gemini n'a fait que recopier le texte
  if (transcrit) {
    extraction.transcription = transcrit.texte;
    extraction.langue = 'fr';
  }
  const entree = versEntree(extraction, params.traitementRecent);
  const triage = evaluerTriage(entree);

  return {
    extraction,
    // Seul le français est fiable : une note en fon est parfois classée « mixte » (voir transcription.service.ts)
    utilisable: extraction.langue === 'fr',
    entree,
    triage,
    mesures: {
      fournisseurTranscription: transcrit ? 'elevenlabs' : 'gemini',
      ...(transcrit ? { latenceTranscriptionMs: transcrit.latencyMs } : {}),
      promptVersion: prompt.version,
      modele: transcrit ? `${transcrit.modele} + ${g.modelVersion}` : g.modelVersion,
      latenceGeminiMs: g.latencyMs,
      latenceTotaleMs: Math.round(performance.now() - debut),
      tentatives: g.attempts,
      tokens: g.usage,
    },
  };
}
