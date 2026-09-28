import { api } from './client';

export type AdminFieldType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'fk' | 'password';

export interface AdminFieldOption {
  value: string;
  label: string;
}

export interface AdminField {
  key: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  readOnly?: boolean;
  options?: AdminFieldOption[];
  fkTable?: string;
}

export interface AdminTableDef {
  key: string;
  label: string;
  fields: AdminField[];
  allowCreate: boolean;
  allowUpdate: boolean;
  allowDelete: boolean;
}

export interface AdminRow {
  id: number;
  createdAt?: string;
  updatedAt?: string;
  _labels?: Record<string, string>;
  [key: string]: unknown;
}

export interface UserOverview {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: 'patient' | 'soignant' | 'admin';
  roleName: string;
  roleBadge: string;
  actif: boolean;
  derniereConnexion?: string | null;
  createdAt: string;
  permissions: string[];
  patient?: {
    id: number;
    codePatient: string;
    pathologie: string;
    telephone?: string;
    commune?: string;
  } | null;
  soignant?: {
    id: number;
    matricule: string;
    structure: string;
    specialite?: string;
    telephone?: string;
  } | null;
}

export interface RolesAndPermissionsData {
  roles: any[];
  permissions: any[];
}

export const adminApi = {
  getTables: () => api.get<AdminTableDef[]>('/admin/tables').then((r) => r.data),

  getRolesAndPermissions: () =>
    api.get<RolesAndPermissionsData>('/admin/roles-permissions').then((r) => r.data),

  getUsersOverview: () => api.get<UserOverview[]>('/admin/users-overview').then((r) => r.data),

  updateUserRole: (id: number, role: 'patient' | 'soignant' | 'admin') =>
    api.patch<{ user: any; oldRole: string; newRole: string }>(`/admin/users/${id}/role`, { role }).then((r) => r.data),

  toggleUserStatus: (id: number) =>
    api.patch<{ id: number; actif: boolean }>(`/admin/users/${id}/toggle-actif`).then((r) => r.data),

  creerPatientAdmin: (data: any) =>
    api.post<{ patient: any; motDePasseTemporaire: string }>('/admin/patients', data).then((r) => r.data),

  getLookup: (fkTable: string) =>
    api.get<AdminFieldOption[]>(`/admin/lookup/${fkTable}`).then((r) => r.data),

  listRows: (table: string) => api.get<AdminRow[]>(`/admin/${table}`).then((r) => r.data),

  createRow: (table: string, data: Record<string, unknown>) =>
    api.post<AdminRow>(`/admin/${table}`, data).then((r) => r.data),

  updateRow: (table: string, id: number, data: Record<string, unknown>) =>
    api.patch<AdminRow>(`/admin/${table}/${id}`, data).then((r) => r.data),

  deleteRow: (table: string, id: number) => api.delete(`/admin/${table}/${id}`),
};

