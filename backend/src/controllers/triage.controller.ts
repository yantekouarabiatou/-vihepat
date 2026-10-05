import { Request, Response } from 'express';
import { z } from 'zod';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { GeminiError, geminiConfigure } from '../ia/gemini.client';
import { trierNoteVocale } from '../ia/voice-triage.service';

const MAX_AUDIO_OCTETS = 5 * 1024 * 1024;
const MESURES_FICHIER = path.resolve(process.cwd(), 'logs', 'ia-mesures.jsonl');

const triageVocalSchema = z.object({
  audioBase64: z.string().min(100),
  mimeType: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i),
  traitementRecent: z.boolean().default(false),
});

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
  // Le type MIME du navigateur peut porter des paramètres (« audio/webm;codecs=opus »)
  const mimeType = body.mimeType.split(';')[0]!.trim().toLowerCase();
  if (Buffer.byteLength(body.audioBase64, 'base64') > MAX_AUDIO_OCTETS) {
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
