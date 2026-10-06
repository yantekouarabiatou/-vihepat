import { z } from 'zod';
import prompt from './transcription.json';
import { genererContenu, GeminiError, type GeminiUsage } from './gemini.client';

/** Note vocale du chatbot -> texte, que l'utilisateur relit avant de l'envoyer. */

const schema = z.object({
  transcription: z.string(),
  langue: z.enum(['fr', 'fon', 'mixte', 'autre']),
  compris: z.boolean(),
});

export interface ResultatTranscription extends z.infer<typeof schema> {
  /** Faux si la note est vide ou dans une langue que le modèle ne comprend pas de façon fiable (fon). */
  utilisable: boolean;
  mesures: { promptVersion: string; modele: string; latenceMs: number; tentatives: number; tokens: GeminiUsage };
}

export async function transcrire(audioBase64: string, mimeType: string): Promise<ResultatTranscription> {
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
    mesures: { promptVersion: prompt.version, modele: g.modelVersion, latenceMs: g.latencyMs, tentatives: g.attempts, tokens: g.usage },
  };
}
