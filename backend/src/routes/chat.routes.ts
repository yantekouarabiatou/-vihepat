import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import * as triageController from '../controllers/triage.controller';
import { authOptional } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

// Endpoint accessible par tout le monde (visiteurs, patients, soignants, admins)
r.post('/', authOptional, catchAsync(chatController.handleChat));
// Note vocale -> texte (Gemini), relu par l'utilisateur avant envoi
r.post('/transcrire', authOptional, catchAsync(triageController.transcrireAudio));

export default r;
