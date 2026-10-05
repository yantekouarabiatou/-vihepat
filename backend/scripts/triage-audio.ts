/**
 * Teste la chaîne note vocale -> priorité sur un fichier audio local, sans base de données.
 *   npm run ia:audio -- chemin/vers/note.wav [--traitement-recent]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { trierNoteVocale } from '../src/ia/voice-triage.service';

const MIME: Record<string, string> = {
  '.wav': 'audio/wav', '.mp3': 'audio/mp3', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.m4a': 'audio/aac', '.flac': 'audio/flac',
};

async function main() {
  const fichier = process.argv[2];
  if (!fichier) throw new Error('Usage : npm run ia:audio -- <fichier audio>');
  const mimeType = MIME[path.extname(fichier).toLowerCase()];
  if (!mimeType) throw new Error(`Format non pris en charge : ${path.extname(fichier)}`);
  const r = await trierNoteVocale({
    audioBase64: readFileSync(fichier).toString('base64'),
    mimeType,
    traitementRecent: process.argv.includes('--traitement-recent'),
  });
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error('Échec :', e.code ?? '', e.message);
  process.exit(1);
});
