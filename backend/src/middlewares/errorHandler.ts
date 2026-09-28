import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation échouée', details: err.errors });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Une ligne avec cette valeur existe déjà (contrainte d\'unicité).' });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ error: 'Impossible : des données liées existent ou la référence est invalide.' });
  }
  console.error('❌', err);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Erreur serveur' });
}