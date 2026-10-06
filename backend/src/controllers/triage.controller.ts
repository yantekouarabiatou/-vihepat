import { Request, Response } from 'express';
import { z } from 'zod';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { GeminiError, geminiConfigure } from '../ia/gemini.client';
import { trierNoteVocale } from '../ia/voice-triage.service';
import { transcrire } from '../ia/transcription.service';

const MAX_AUDIO_OCTETS = 5 * 1024 * 1024;
const MESURES_FICHIER = path.resolve(process.cwd(), 'logs', 'ia-mesures.jsonl');

const audioSchema = z.object({
  audioBase64: z.string().min(100),
  mimeType: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i),
});
const triageVocalSchema = audioSchema.extend({ traitementRecent: z.boolean().default(false) });

/** Le type MIME du navigateur peut porter des paramètres (« audio/webm;codecs=opus »). */
const mimeSimple = (m: string) => m.split(';')[0]!.trim().toLowerCase();
const tropLong = (b64: string) => Buffer.byteLength(b64, 'base64') > MAX_AUDIO_OCTETS;

/** Journal des mesures (latence, tokens, niveau) : aucune donnée de santé ni identifiant. */
async function journaliserMesure(ligne: Record<string, unknown>) {
  try {
    await mkdir(path.dirname(MESURES_FICHIER), { recursive: true });
    await appendFile(MESURES_FICHIER, JSON.stringify({ ts: new Date().toISOString(), ...ligne }) + '\n');
  } catch {
    // La mesure ne doit jamais faire échouer le triage
  }
}

export async function triageVocal(req: Request, res: Response) {
  if (!geminiConfigure()) {
    return res.status(503).json({ error: "Analyse vocale indisponible : remplissez le formulaire.", code: 'non_configure' });
  }
  const body = triageVocalSchema.parse(req.body);
  const mimeType = mimeSimple(body.mimeType);
  if (tropLong(body.audioBase64)) {
    return res.status(413).json({ error: 'Note vocale trop longue (5 Mo maximum).', code: 'trop_long' });
  }

  try {
    const r = await trierNoteVocale({ audioBase64: body.audioBase64, mimeType, traitementRecent: body.traitementRecent });
    void journaliserMesure({
      ok: true,
      modele: r.mesures.modele,
      prompt: r.mesures.promptVersion,
      latenceGeminiMs: r.mesures.latenceGeminiMs,
      latenceTotaleMs: r.mesures.latenceTotaleMs,
      tentatives: r.mesures.tentatives,
      tokens: r.mesures.tokens,
      niveau: r.triage.niveau,
      langue: r.extraction.langue,
      utilisable: r.utilisable,
    });
    res.json(r);
  } catch (e) {
    if (e instanceof GeminiError) {
      void journaliserMesure({ ok: false, code: e.code, httpStatus: e.httpStatus });
      // Le patient n'est jamais bloqué : le front repasse sur le formulaire et le moteur hors ligne
      return res.status(e.code === 'delai_depasse' ? 504 : 502).json({
        error: "L'analyse de la note vocale a échoué. Vous pouvez remplir le formulaire.",
        code: e.code,
      });
    }
    throw e;
  }
}

/** Chatbot : note vocale -> texte, relu par l'utilisateur avant envoi. Ouvert aux visiteurs (rate limit dans app.ts). */
export async function transcrireAudio(req: Request, res: Response) {
  if (!geminiConfigure()) {
    return res.status(503).json({ error: 'Transcription indisponible : écrivez votre message.', code: 'non_configure' });
  }
  const body = audioSchema.parse(req.body);
  if (tropLong(body.audioBase64)) {
    return res.status(413).json({ error: 'Note vocale trop longue (5 Mo maximum).', code: 'trop_long' });
  }
  try {
    const r = await transcrire(body.audioBase64, mimeSimple(body.mimeType));
    void journaliserMesure({
      ok: true, usage: 'chat', modele: r.mesures.modele, prompt: r.mesures.promptVersion,
      latenceGeminiMs: r.mesures.latenceMs, tentatives: r.mesures.tentatives, tokens: r.mesures.tokens,
      langue: r.langue, utilisable: r.utilisable,
    });
    res.json({ transcription: r.utilisable ? r.transcription : '', langue: r.langue, utilisable: r.utilisable });
  } catch (e) {
    if (e instanceof GeminiError) {
      void journaliserMesure({ ok: false, usage: 'chat', code: e.code, httpStatus: e.httpStatus });
      return res.status(e.code === 'delai_depasse' ? 504 : 502).json({
        error: "La transcription a échoué. Vous pouvez écrire votre message.",
        code: e.code,
      });
    }
    throw e;
  }
}
