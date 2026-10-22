import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { jetonEncoreValide } from '../utils/token-version';
import { roleAPermission } from '../services/permissions.service';
import type { Permission } from '../config/permissions';

declare global {
  namespace Express {
    interface Request { user?: JwtPayload; }
  }
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(h.slice(7));
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  try {
    // Session fermée par un changement de mot de passe (ou compte désactivé)
    if (!(await jetonEncoreValide(payload.userId, payload.tv))) {
      return res.status(401).json({ error: 'Session expirée', code: 'SESSION_REVOKED' });
    }
  } catch (err) {
    return next(err);
  }
  req.user = payload;
  next();
}

export function authOptional(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(h.slice(7));
    } catch {
      // Token ignoré en mode optionnel
    }
  }
  next();
}

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };

/** Vérifie la permission dans la matrice modifiable par l'administrateur (`role_permissions`). */
export const requirePermission = (permission: Permission) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roleAPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: `Permission refusée : action non autorisée pour le rôle ${req.user.role}`,
        code: 'PERMISSION_REFUSEE',
        permission,
      });
    }
    next();
  };