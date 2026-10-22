import { RolePermission } from '../models';
import {
  ROLES, ROLES_CONFIG, PERMISSIONS_CATALOG, PERMISSIONS_VERROUILLEES,
  rolesApplicables, estPermission, type Permission, type Role,
} from '../config/permissions';
import { sequelize } from '../config/database';

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

function valeursParDefaut(): Map<Role, Set<Permission>> {
  return new Map(ROLES.map((r) => [r, new Set(ROLES_CONFIG[r].permissions)]));
}

/**
 * Matrice en mémoire, lue à chaque requête par `requirePermission`. Une seule instance de l'API
 * (cPanel) : elle est rechargée après chaque modification. Tant que la base n'a pas répondu, ce
 * sont les valeurs par défaut qui s'appliquent : l'application ne se bloque jamais.
 */
let matrice: Map<Role, Set<Permission>> = valeursParDefaut();

export function roleAPermission(role: string, permission: Permission): boolean {
  return matrice.get(role as Role)?.has(permission) ?? false;
}

export function permissionsDuRole(role: Role): Permission[] {
  return PERMISSIONS_CATALOG.map((p) => p.key).filter((k) => matrice.get(role)?.has(k));
}

/**
 * Charge la matrice depuis `role_permissions`. Crée la table si elle manque (la production est
 * installée par import SQL, sans migrations) et y écrit les valeurs par défaut si elle est vide.
 */
export async function chargerPermissions() {
  try {
    await RolePermission.sync();
    if ((await RolePermission.count()) === 0) {
      await RolePermission.bulkCreate(
        ROLES.flatMap((role) => ROLES_CONFIG[role].permissions.map((permission) => ({ role, permission }))),
      );
    }
    const lignes = await RolePermission.findAll();
    const nouvelle = new Map<Role, Set<Permission>>(ROLES.map((r) => [r, new Set<Permission>()]));
    for (const l of lignes) {
      if (estPermission(l.permission)) nouvelle.get(l.role)?.add(l.permission);
    }
    // Les permissions verrouillées sont toujours accordées, même si la table a été modifiée à la main
    for (const role of ROLES) for (const p of PERMISSIONS_VERROUILLEES[role]) nouvelle.get(role)!.add(p);
    matrice = nouvelle;
  } catch (err) {
    console.error('⚠️  Permissions : lecture de role_permissions impossible, valeurs par défaut appliquées', err);
  }
}

export function getMatrice() {
  return {
    roles: ROLES.map((role) => ({
      ...ROLES_CONFIG[role],
      permissions: permissionsDuRole(role),
      permissionsParDefaut: ROLES_CONFIG[role].permissions,
      verrouillees: PERMISSIONS_VERROUILLEES[role],
    })),
    permissions: PERMISSIONS_CATALOG.map((p) => ({ ...p, rolesApplicables: rolesApplicables(p.key) })),
  };
}

/** Remplace les permissions d'un rôle. Renvoie ce qui a été ajouté et retiré, pour le journal d'audit. */
export async function definirPermissionsRole(role: Role, demandees: string[]) {
  if (!ROLES.includes(role)) throw httpError(400, 'Rôle invalide');
  const inconnues = demandees.filter((p) => !estPermission(p));
  if (inconnues.length) throw httpError(400, `Permission inconnue : ${inconnues.join(', ')}`);
  const nonApplicables = (demandees as Permission[]).filter((p) => !rolesApplicables(p).includes(role));
  if (nonApplicables.length) {
    throw httpError(400, `Permission non applicable au rôle ${role} : ${nonApplicables.join(', ')}`);
  }

  const voulues = new Set<Permission>([...(demandees as Permission[]), ...PERMISSIONS_VERROUILLEES[role]]);
  const actuelles = new Set(permissionsDuRole(role));
  const ajoutees = [...voulues].filter((p) => !actuelles.has(p));
  const retirees = [...actuelles].filter((p) => !voulues.has(p));

  await sequelize.transaction(async (transaction) => {
    await RolePermission.destroy({ where: { role }, transaction });
    await RolePermission.bulkCreate([...voulues].map((permission) => ({ role, permission })), { transaction });
  });
  await chargerPermissions();
  return { role, permissions: permissionsDuRole(role), ajoutees, retirees };
}

export function reinitialiserRole(role: Role) {
  if (!ROLES.includes(role)) throw httpError(400, 'Rôle invalide');
  return definirPermissionsRole(role, ROLES_CONFIG[role].permissions);
}
