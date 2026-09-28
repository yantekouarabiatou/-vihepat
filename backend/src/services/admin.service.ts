import bcrypt from 'bcrypt';
import { User, Patient, Soignant, Traitement, GroupeSoutien } from '../models';
import { ADMIN_TABLES, getTableDefOrThrow, type TableDef } from '../admin/registry';
import { ROLES_CONFIG, PERMISSIONS_CATALOG, type Role } from '../config/permissions';
import { genererCodePatient } from './auth.service';

const SALT_ROUNDS = 12;

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export function listTables() {
  return Object.values(ADMIN_TABLES).map((def) => ({
    key: def.key, label: def.label, fields: def.fields,
    allowCreate: def.allowCreate, allowUpdate: def.allowUpdate, allowDelete: def.allowDelete,
  }));
}

export async function getLookupOptions(fkTable: string): Promise<{ value: string; label: string }[]> {
  switch (fkTable) {
    case 'users': {
      const rows = await User.findAll({ attributes: ['id', 'nom', 'prenom', 'email'], order: [['nom', 'ASC']] });
      return rows.map((r) => ({ value: String(r.id), label: `${r.prenom} ${r.nom} (${r.email})` }));
    }
    case 'patients': {
      const rows = await Patient.findAll({
        include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
        order: [['codePatient', 'ASC']],
      });
      return rows.map((r: any) => ({ value: String(r.id), label: `${r.user.prenom} ${r.user.nom} — ${r.codePatient}` }));
    }
    case 'soignants': {
      const rows = await Soignant.findAll({
        include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }],
        order: [['matricule', 'ASC']],
      });
      return rows.map((r: any) => ({ value: String(r.id), label: `${r.user.prenom} ${r.user.nom} — ${r.structure}` }));
    }
    case 'traitements': {
      const rows = await Traitement.findAll({
        include: [{ model: Patient, as: 'patient', include: [{ model: User, as: 'user', attributes: ['nom', 'prenom'] }] }],
        order: [['molecule', 'ASC']],
      });
      return rows.map((r: any) => ({ value: String(r.id), label: `${r.molecule} — ${r.patient.user.prenom} ${r.patient.user.nom}` }));
    }
    case 'groupes_soutien': {
      const rows = await GroupeSoutien.findAll({ order: [['nom', 'ASC']] });
      return rows.map((r) => ({ value: String(r.id), label: r.nom }));
    }
    default:
      return [];
  }
}

async function getLookupMap(fkTable: string): Promise<Map<number, string>> {
  const options = await getLookupOptions(fkTable);
  return new Map(options.map((o) => [Number(o.value), o.label]));
}

export async function listRows(tableKey: string) {
  const def = getTableDefOrThrow(tableKey);
  const rows = await def.model.findAll({ order: [['id', 'DESC']], limit: 500 });

  const fkFields = def.fields.filter((f) => f.type === 'fk');
  const lookupMaps = new Map<string, Map<number, string>>();
  for (const f of fkFields) {
    if (!lookupMaps.has(f.fkTable!)) lookupMaps.set(f.fkTable!, await getLookupMap(f.fkTable!));
  }

  return rows.map((row: any) => {
    const json = row.toJSON();
    delete json.passwordHash;
    const labels: Record<string, string> = {};
    for (const f of fkFields) {
      const val = json[f.key];
      if (val != null) labels[f.key] = lookupMaps.get(f.fkTable!)?.get(Number(val)) ?? `#${val}`;
    }
    return { ...json, _labels: labels };
  });
}

/** Ne garde que les clés déclarées dans le registre pour ce tableau (pas d'injection de colonnes arbitraires). */
function pickAllowedFields(def: TableDef, body: Record<string, unknown>, { forCreate }: { forCreate: boolean }) {
  const data: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.readOnly) continue;
    if (f.type === 'password') continue; // géré à part
    if (!(f.key in body)) continue;
    const raw = body[f.key];
    if (raw === '' || raw === undefined) {
      if (forCreate && f.required) throw httpError(400, `Le champ "${f.label}" est requis`);
      data[f.key] = null;
      continue;
    }
    if (f.type === 'number' || f.type === 'fk') data[f.key] = Number(raw);
    else if (f.type === 'boolean') data[f.key] = raw === true || raw === 'true' || raw === 1;
    else if (f.type === 'date' || f.type === 'datetime') data[f.key] = raw ? new Date(raw as string) : null;
    else data[f.key] = raw;
  }
  if (forCreate) {
    for (const f of def.fields) {
      if (f.required && !f.readOnly && f.type !== 'password' && (data[f.key] === undefined)) {
        throw httpError(400, `Le champ "${f.label}" est requis`);
      }
    }
  }
  return data;
}

export async function createRow(tableKey: string, body: Record<string, unknown>) {
  const def = getTableDefOrThrow(tableKey);
  if (!def.allowCreate) throw httpError(403, 'Création non autorisée pour ce tableau');
  const data = pickAllowedFields(def, body, { forCreate: true });

  if (tableKey === 'users') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || password.length < 8) throw httpError(400, 'Mot de passe requis (8 caractères minimum)');
    data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const row = await def.model.create(data);
  const json = row.toJSON();
  delete json.passwordHash;
  return json;
}

export async function updateRow(tableKey: string, id: number, body: Record<string, unknown>) {
  const def = getTableDefOrThrow(tableKey);
  if (!def.allowUpdate) throw httpError(403, 'Modification non autorisée pour ce tableau');
  const row = await def.model.findByPk(id);
  if (!row) throw httpError(404, 'Ligne introuvable');

  const data = pickAllowedFields(def, body, { forCreate: false });

  if (tableKey === 'users' && typeof body.password === 'string' && body.password.trim().length > 0) {
    if (body.password.length < 8) throw httpError(400, 'Mot de passe trop court (8 caractères minimum)');
    (data as any).passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
  }

  await row.update(data);
  const json = row.toJSON();
  delete json.passwordHash;
  return json;
}

export async function deleteRow(tableKey: string, id: number) {
  const def = getTableDefOrThrow(tableKey);
  if (!def.allowDelete) throw httpError(403, 'Suppression non autorisée pour ce tableau');
  const row = await def.model.findByPk(id);
  if (!row) throw httpError(404, 'Ligne introuvable');
  await row.destroy();
}

export function getRolesAndPermissions() {
  return {
    roles: Object.values(ROLES_CONFIG),
    permissions: PERMISSIONS_CATALOG,
  };
}

export async function getUsersOverview() {
  const users = await User.findAll({
    attributes: ['id', 'email', 'nom', 'prenom', 'role', 'actif', 'derniereConnexion', 'createdAt'],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'codePatient', 'pathologie', 'telephone', 'commune'],
      },
      {
        model: Soignant,
        as: 'soignant',
        attributes: ['id', 'matricule', 'structure', 'specialite', 'telephone'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  return users.map((u: any) => {
    const json = u.toJSON();
    const roleCfg = (ROLES_CONFIG as Record<string, any>)[u.role];
    return {
      ...json,
      roleName: roleCfg?.name ?? u.role,
      roleBadge: roleCfg?.badge ?? u.role,
      permissions: roleCfg?.permissions ?? [],
    };
  });
}

export async function updateUserRole(userId: number, newRole: Role) {
  if (!['patient', 'soignant', 'admin'].includes(newRole)) {
    throw httpError(400, 'Rôle invalide');
  }

  const user = await User.findByPk(userId, {
    include: [
      { model: Patient, as: 'patient' },
      { model: Soignant, as: 'soignant' },
    ],
  });

  if (!user) throw httpError(404, 'Utilisateur introuvable');
  const oldRole = user.role;
  user.role = newRole;
  await user.save();

  // Si passage en soignant et pas encore de profil Soignant
  if (newRole === 'soignant' && !(user as any).soignant) {
    await Soignant.create({
      userId: user.id,
      matricule: `MAT-${user.id}-${Date.now().toString().slice(-4)}`,
      structure: 'CHU Cotonou',
      specialite: 'Médecine générale',
    });
  }

  // Si passage en patient et pas encore de profil Patient
  if (newRole === 'patient' && !(user as any).patient) {
    await Patient.create({
      userId: user.id,
      codePatient: genererCodePatient(),
      pathologie: 'vih',
      languePreferee: 'fr',
      consentementDonne: true,
      dateConsentement: new Date(),
    });
  }

  return { user, oldRole, newRole };
}

export async function toggleUserStatus(userId: number) {
  const user = await User.findByPk(userId);
  if (!user) throw httpError(404, 'Utilisateur introuvable');
  user.actif = !user.actif;
  await user.save();
  return { id: user.id, actif: user.actif };
}

