import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASS: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Note vocale : transcription + structuration (https://aistudio.google.com/apikey)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-3.8-flash'),

  // Configuration SMTP (Brevo)
  MAIL_MAILER: z.string().default('smtp'),
  MAIL_HOST: z.string().default('smtp-relay.brevo.com'),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_USERNAME: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_ENCRYPTION: z.string().default('tls'),
  MAIL_FROM_ADDRESS: z.string().email().default('rabiatouyantekoua@gmail.com'),
  MAIL_FROM_NAME: z.string().default('VIHEPAT Santé'),
});

export const env = schema.parse(process.env);