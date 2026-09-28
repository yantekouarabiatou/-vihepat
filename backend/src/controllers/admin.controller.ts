import { Request, Response } from 'express';
import { z } from 'zod';
import * as adminService from '../services/admin.service';
import { logAudit } from '../middlewares/audit';

const idParam = z.coerce.number().int().positive();
const tableParam = (req: Request) => String(req.params.table);

export function getTables(_req: Request, res: Response) {
  res.json(adminService.listTables());
}

export async function getLookup(req: Request, res: Response) {
  const result = await adminService.getLookupOptions(tableParam(req));
  res.json(result);
}

export async function listRows(req: Request, res: Response) {
  const result = await adminService.listRows(tableParam(req));
  res.json(result);
}

export async function createRow(req: Request, res: Response) {
  const table = tableParam(req);
  const result = await adminService.createRow(table, req.body);
  await logAudit(req, 'ADMIN_CREATE', `${table}:${result.id}`);
  res.status(201).json(result);
}

export async function updateRow(req: Request, res: Response) {
  const table = tableParam(req);
  const id = idParam.parse(req.params.id);
  const result = await adminService.updateRow(table, id, req.body);
  await logAudit(req, 'ADMIN_UPDATE', `${table}:${id}`);
  res.json(result);
}

export async function deleteRow(req: Request, res: Response) {
  const table = tableParam(req);
  const id = idParam.parse(req.params.id);
  await adminService.deleteRow(table, id);
  await logAudit(req, 'ADMIN_DELETE', `${table}:${id}`);
  res.status(204).send();
}

export function getRolesAndPermissions(_req: Request, res: Response) {
  res.json(adminService.getRolesAndPermissions());
}

export async function getUsersOverview(_req: Request, res: Response) {
  const result = await adminService.getUsersOverview();
  res.json(result);
}

const updateRoleSchema = z.object({
  role: z.enum(['patient', 'soignant', 'admin']),
});

export async function updateUserRole(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  const { role } = updateRoleSchema.parse(req.body);
  const result = await adminService.updateUserRole(id, role);
  await logAudit(req, 'ADMIN_UPDATE_ROLE', `user:${id}`, { oldRole: result.oldRole, newRole: result.newRole });
  res.json(result);
}

export async function toggleUserStatus(req: Request, res: Response) {
  const id = idParam.parse(req.params.id);
  const result = await adminService.toggleUserStatus(id);
  await logAudit(req, 'ADMIN_TOGGLE_STATUS', `user:${id}`, { actif: result.actif });
  res.json(result);
}

export async function creerPatientAdmin(req: Request, res: Response) {
  const soignantService = await import('../services/soignant.service');
  const result = await soignantService.creerPatient(req.user!.userId, req.body);
  await logAudit(req, 'ADMIN_CREATE_PATIENT', `patient:${result.patient.id}`, { codePatient: result.patient.codePatient });
  res.status(201).json(result);
}

