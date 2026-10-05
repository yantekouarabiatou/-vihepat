import { env } from '../config/env';

/**
 * Client minimal de l'API Gemini (REST, sans SDK) : on garde la main sur
 * le délai d'attente, les nouvelles tentatives et la mesure de latence.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 20_000;
/** Statuts pour lesquels on bascule sur le modèle de secours (0 = délai dépassé). */
const RETRYABLE = new Set([0, 429, 500, 502, 503, 504]);

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface GeminiRequest {
  system: string;
  parts: GeminiPart[];
  schema?: unknown;
  temperature?: number;
  responseMimeType?: string;
}

export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  audioPromptTokens: number;
}

export interface GeminiResult {
  text: string;
  modelVersion: string;
  latencyMs: number;
  attempts: number;
  usage: GeminiUsage;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: 'non_configure' | 'delai_depasse' | 'http' | 'reponse_vide' | 'bloque',
    public readonly httpStatus?: number,
  ) {
    super(message);
  }
}

export function geminiConfigure() {
  return Boolean(env.GEMINI_API_KEY);
}

async function appelUnique(modele: string, body: unknown): Promise<{ status: number; json: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/${modele}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { status: 0, json: { error: { message: `Pas de réponse de ${modele} après ${TIMEOUT_MS / 1000} s` } } };
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function genererContenu(req: GeminiRequest): Promise<GeminiResult> {
  if (!env.GEMINI_API_KEY) throw new GeminiError('GEMINI_API_KEY absente', 'non_configure');

  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: req.parts }],
    generationConfig: {
      temperature: req.temperature ?? 0,
      responseMimeType: req.responseMimeType ?? 'text/plain',
      ...(req.schema ? { responseSchema: req.schema } : {}),
    },
  };

  // Modèle principal puis modèle de secours si le premier est surchargé ou trop lent
  const modeles = [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL].filter((m, i, l): m is string => !!m && l.indexOf(m) === i);
  const debut = performance.now();
  let tentative = 0;
  let dernier: { status: number; json: any } | null = null;
  for (const modele of modeles) {
    tentative++;
    dernier = await appelUnique(modele, body);
    if (dernier.status === 200 || !RETRYABLE.has(dernier.status)) break;
  }
  const latencyMs = Math.round(performance.now() - debut);

  const { status, json } = dernier!;
  if (status === 0) throw new GeminiError(json.error.message, 'delai_depasse');
  if (status !== 200) {
    throw new GeminiError(json?.error?.message ?? `Erreur HTTP ${status}`, 'http', status);
  }
  const candidat = json?.candidates?.[0];
  if (!candidat && json?.promptFeedback?.blockReason) {
    throw new GeminiError(`Requête bloquée : ${json.promptFeedback.blockReason}`, 'bloque');
  }
  const text: string = (candidat?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
  if (!text) throw new GeminiError(`Réponse vide (finishReason=${candidat?.finishReason ?? '?'})`, 'reponse_vide');

  const u = json.usageMetadata ?? {};
  const audio = (u.promptTokensDetails ?? []).find((d: any) => d.modality === 'AUDIO');
  return {
    text,
    modelVersion: json.modelVersion ?? env.GEMINI_MODEL,
    latencyMs,
    attempts: tentative,
    usage: {
      promptTokens: u.promptTokenCount ?? 0,
      outputTokens: u.candidatesTokenCount ?? 0,
      thoughtsTokens: u.thoughtsTokenCount ?? 0,
      audioPromptTokens: audio?.tokenCount ?? 0,
    },
  };
}
