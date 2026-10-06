import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  // Derrière le proxy de l'hébergeur : l'IP réelle du visiteur est dans X-Forwarded-For.
  // Sans ce réglage, les limites anti-abus seraient communes à tous les utilisateurs.
  app.set('trust proxy', 1);

  // Sécurité
  app.use(helmet());
  app.use(cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  }));

  // Parsing (la note vocale arrive en base64 : limite plus large sur cette seule route)
  app.use(['/api/patients/me/triage-vocal', '/api/chat/transcrire'], express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logs
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  // Rate limiting global
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, réessayez dans quelques minutes' },
  }));

  // Rate limit plus strict sur l'auth
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Trop de tentatives de connexion' },
  }));

  // Rate limit sur le chat IA (coût par appel)
  app.use('/api/patients/me/chat', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: "Trop de messages envoyés à l'assistant, réessayez dans quelques minutes" },
  }));

  // Rate limit sur l'analyse de note vocale (coût par appel Gemini)
  app.use('/api/patients/me/triage-vocal', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Trop d'analyses vocales, réessayez dans quelques minutes" },
  }));

  // Transcription vocale du chatbot : ouverte aux visiteurs, donc plus limitée
  app.use('/api/chat/transcrire', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: 'Trop de notes vocales, réessayez dans quelques minutes' },
  }));

  // Health check
  // /api/health : l'API est servie sous /api en production (application Node.js de cPanel)
  app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Routes API
  app.use('/api', routes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

  // Erreurs (toujours en dernier)
  app.use(errorHandler);

  return app;
}