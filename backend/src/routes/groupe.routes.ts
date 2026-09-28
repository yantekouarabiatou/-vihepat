import { Router } from 'express';
import * as groupeController from '../controllers/groupe.controller';
import { authRequired, requireRole } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('patient'));

r.get('/', catchAsync(groupeController.getGroupes));
r.post('/:id/rejoindre', catchAsync(groupeController.rejoindreGroupe));
r.get('/:id/messages', catchAsync(groupeController.getMessages));
r.post('/:id/messages', catchAsync(groupeController.postMessage));

export default r;
