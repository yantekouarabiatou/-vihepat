import { Request } from 'express';
import { AuditLog } from '../models';

export async function logAudit(
  req: Request,
  action: string,
  cible?: string,
  meta?: Record<string, unknown>,
  userId?: number
) {
  const resolvedUserId = userId ?? req.user?.userId;
  if (resolvedUserId === undefined) {
    console.error('Erreur écriture audit log: aucun userId disponible pour', action);
    return;
  }
  try {
    await AuditLog.create({
      userId: resolvedUserId,
      action,
      cible: cible ?? null,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      meta: meta ?? null,
    });
  } catch (err) {
    console.error('Erreur écriture audit log:', err);
  }
}