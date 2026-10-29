import { env } from '../config/env';

/**
 * Client minimal de la transcription ElevenLabs (Scribe), en REST sans SDK.
 * Prioritaire sur Gemini pour passer de la voix au texte ; Gemini reste le secours.
 */

const URL_STT = 'https://api.elevenlabs.io/v1/speech-to-text';
const TIMEOUT_MS = 20_000;

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    public readonly code: 'non_configure' | 'delai_depasse' | 'http' | 'reponse_vide',
    public readonly httpStatus?: number,
  ) {
    super(message);
  }
}

export interface ResultatElevenLabs {
  texte: string;
  /** Code ISO 639-3 détecté par Scribe (« fra », « fon »…) */
  codeLangue: string;
  probabiliteLangue: number;
  modele: string;
  latencyMs: number;
}

export function elevenlabsConfigure() {
  return Boolean(env.ELEVENLABS_API_KEY);
}

/** Langue Scribe -> langue de nos schémas. Seul le français est jugé fiable en aval. */
export function versLangue(code: string): 'fr' | 'fon' | 'autre' {
  const c = code.toLowerCase();
  if (c === 'fra' || c === 'fr') return 'fr';
  if (c === 'fon') return 'fon';
  return 'autre';
}

export async function transcrireElevenLabs(audioBase64: string, mimeType: string): Promise<ResultatElevenLabs> {
  if (!env.ELEVENLABS_API_KEY) throw new ElevenLabsError('ELEVENLABS_API_KEY absente', 'non_configure');

  const form = new FormData();
  form.append('model_id', env.ELEVENLABS_STT_MODEL);
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([Buffer.from(audioBase64, 'base64')], { type: mimeType }), 'note-vocale');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const debut = performance.now();
  let status: number;
  let json: any;
  try {
    const res = await fetch(URL_STT, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      body: form,
      signal: ctrl.signal,
    });
    status = res.status;
    json = await res.json().catch(() => null);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new ElevenLabsError(`Pas de réponse d'ElevenLabs après ${TIMEOUT_MS / 1000} s`, 'delai_depasse');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Math.round(performance.now() - debut);

  if (status !== 200) {
    const detail = json?.detail?.message ?? json?.detail ?? `Erreur HTTP ${status}`;
    throw new ElevenLabsError(typeof detail === 'string' ? detail : JSON.stringify(detail), 'http', status);
  }
  if (typeof json?.text !== 'string') throw new ElevenLabsError('Réponse ElevenLabs sans texte', 'reponse_vide');

  return {
    texte: json.text.trim(),
    codeLangue: json.language_code ?? '',
    probabiliteLangue: json.language_probability ?? 0,
    modele: env.ELEVENLABS_STT_MODEL,
    latencyMs,
  };
}
