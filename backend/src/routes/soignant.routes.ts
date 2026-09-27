import { Router } from 'express';
import * as soignantController from '../controllers/soignant.controller';
import { authRequired, requireRole } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('soignant'));

r.get('/patients', catchAsync(soignantController.getPatients));
r.get('/rendez-vous', catchAsync(soignantController.getRendezVous));
r.patch('/rendez-vous/:id', catchAsync(soignantController.updateRendezVous));
r.get('/signalements', catchAsync(soignantController.getSignalements));
r.patch('/signalements/:id', catchAsync(soignantController.updateSignalement));

export default r;
