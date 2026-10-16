import { User } from '../models/User';

/**
 * Version courante des jetons de chaque compte, gardée en mémoire quelques secondes
 * pour ne pas interroger la base à chaque requête. Un changement de mot de passe
 * met le cache à jour immédiatement (voir `memoriserVersion`).
 */
const DUREE_CACHE_MS = 30_000;
const cache = new Map<number, { version: number; actif: boolean; lu: number }>();

export function memoriserVersion(userId: number, version: number, actif = true) {
  cache.set(userId, { version, actif, lu: Date.now() });
}

/** Vrai si un jeton portant la version `tv` est toujours valable pour ce compte. */
export async function jetonEncoreValide(userId: number, tv: number | undefined): Promise<boolean> {
  let entree = cache.get(userId);
  if (!entree || Date.now() - entree.lu > DUREE_CACHE_MS) {
    const user = await User.findByPk(userId, { attributes: ['id', 'tokenVersion', 'actif'] });
    if (!user) return false;
    entree = { version: user.tokenVersion ?? 0, actif: user.actif !== false, lu: Date.now() };
    cache.set(userId, entree);
  }
  return entree.actif && (tv ?? 0) === entree.version;
}
