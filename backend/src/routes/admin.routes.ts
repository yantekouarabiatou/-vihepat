import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authRequired, requireRole } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('admin'));

r.get('/tables', catchAsync(adminController.getTables));
r.get('/roles-permissions', catchAsync(adminController.getRolesAndPermissions));
r.get('/users-overview', catchAsync(adminController.getUsersOverview));
r.patch('/users/:id/role', catchAsync(adminController.updateUserRole));
r.patch('/users/:id/toggle-actif', catchAsync(adminController.toggleUserStatus));
r.post('/patients', catchAsync(adminController.creerPatientAdmin));
r.get('/lookup/:table', catchAsync(adminController.getLookup));
r.get('/:table', catchAsync(adminController.listRows));
r.post('/:table', catchAsync(adminController.createRow));
r.patch('/:table/:id', catchAsync(adminController.updateRow));
r.delete('/:table/:id', catchAsync(adminController.deleteRow));

export default r;
