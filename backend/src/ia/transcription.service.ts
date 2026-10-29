import { z } from 'zod';
import prompt from './transcription.json';
import { genererContenu, geminiConfigure, GeminiError, type GeminiUsage } from './gemini.client';
import { elevenlabsConfigure, transcrireElevenLabs, versLangue } from './elevenlabs.client';

/** Note vocale du chatbot -> texte, que l'utilisateur relit avant de l'envoyer. */

const schema = z.object({
  transcription: z.string(),
  langue: z.enum(['fr', 'fon', 'mixte', 'autre']),
  compris: z.boolean(),
});

const TOKENS_VIDES: GeminiUsage = { promptTokens: 0, outputTokens: 0, thoughtsTokens: 0, audioPromptTokens: 0 };

export interface ResultatTranscription extends z.infer<typeof schema> {
  /** Faux si la note est vide ou dans une langue que le modèle ne comprend pas de façon fiable (fon). */
  utilisable: boolean;
  mesures: {
    fournisseur: 'elevenlabs' | 'gemini';
    promptVersion: string; modele: string; latenceMs: number; tentatives: number; tokens: GeminiUsage;
  };
}

export async function transcrire(audioBase64: string, mimeType: string): Promise<ResultatTranscription> {
  // ElevenLabs en priorité ; Gemini en secours s'il est configuré
  if (elevenlabsConfigure()) {
    try {
      const e = await transcrireElevenLabs(audioBase64, mimeType);
      const langue = versLangue(e.codeLangue);
      return {
        transcription: e.texte,
        langue,
        compris: e.texte.length > 0,
        utilisable: langue === 'fr' && e.texte.length > 0,
        mesures: {
          fournisseur: 'elevenlabs', promptVersion: '-', modele: e.modele,
          latenceMs: e.latencyMs, tentatives: 1, tokens: TOKENS_VIDES,
        },
      };
    } catch (err) {
      if (!geminiConfigure()) throw err;
      console.warn('Échec de la transcription ElevenLabs, bascule sur Gemini :', (err as Error).message);
    }
  }
  return transcrireGemini(audioBase64, mimeType);
}

async function transcrireGemini(audioBase64: string, mimeType: string): Promise<ResultatTranscription> {
  const g = await genererContenu({
    system: prompt.system,
    parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: prompt.user_audio }],
    schema: prompt.schema,
    temperature: prompt.generation.temperature,
    responseMimeType: prompt.generation.responseMimeType,
  });

  let brut: unknown;
  try {
    brut = JSON.parse(g.text);
  } catch {
    throw new GeminiError('Réponse de Gemini non conforme (JSON illisible)', 'reponse_vide');
  }
  const r = schema.safeParse(brut);
  if (!r.success) throw new GeminiError('Réponse de Gemini non conforme au schéma', 'reponse_vide');

  // Mesuré sur nos vraies notes (06/10/2026) : en fon, la « transcription » est inventée, Gemini se dit
  // pourtant toujours « compris » et classe parfois la note « mixte ». Le français, lui, a été détecté « fr » à chaque appel réussi (16/16).
  const utilisable = r.data.langue === 'fr' && r.data.transcription.trim().length > 0;
  return {
    ...r.data,
    utilisable,
    mesures: {
      fournisseur: 'gemini', promptVersion: prompt.version, modele: g.modelVersion,
      latenceMs: g.latencyMs, tentatives: g.attempts, tokens: g.usage,
    },
  };
}
