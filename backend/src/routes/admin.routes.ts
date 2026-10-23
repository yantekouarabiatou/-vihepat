import { Router, Request, Response, NextFunction } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authRequired, requireRole, requirePermission as perm } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';
import type { Permission } from '../config/permissions';

const r = Router();

r.use(authRequired, requireRole('admin'));

/** Tables brutes protégées par une permission dédiée ; les autres relèvent du seul rôle admin. */
const PERMISSION_PAR_TABLE: Record<string, Permission> = {
  users: 'user:manage',
  audit_logs: 'audit:read',
  structures: 'structure:manage',
};
const permTable = (req: Request, res: Response, next: NextFunction) => {
  const permission = PERMISSION_PAR_TABLE[String(req.params.table)];
  return permission ? perm(permission)(req, res, next) : next();
};

r.get('/tables', catchAsync(adminController.getTables));
r.post('/mail/test', perm('user:manage'), catchAsync(adminController.testerMail));
r.get('/roles-permissions', perm('role:assign'), catchAsync(adminController.getRolesAndPermissions));
r.put('/roles/:role/permissions', perm('role:assign'), catchAsync(adminController.updateRolePermissions));
r.post('/roles/:role/permissions/reinitialiser', perm('role:assign'), catchAsync(adminController.resetRolePermissions));
r.get('/users-overview', perm('user:manage'), catchAsync(adminController.getUsersOverview));
r.patch('/users/:id/role', perm('role:assign'), catchAsync(adminController.updateUserRole));
r.patch('/users/:id/toggle-actif', perm('user:toggle_status'), catchAsync(adminController.toggleUserStatus));
r.post('/patients', perm('patient:create'), catchAsync(adminController.creerPatientAdmin));
r.get('/lookup/:table', catchAsync(adminController.getLookup));
r.get('/:table', permTable, catchAsync(adminController.listRows));
r.post('/:table', permTable, catchAsync(adminController.createRow));
r.patch('/:table/:id', permTable, catchAsync(adminController.updateRow));
r.delete('/:table/:id', permTable, catchAsync(adminController.deleteRow));

export default r;
