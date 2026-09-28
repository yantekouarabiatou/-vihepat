import { Router } from 'express';
import * as soignantController from '../controllers/soignant.controller';
import { authRequired, requireRole } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('soignant'));

r.get('/patients', catchAsync(soignantController.getPatients));
r.post('/patients/rattacher', catchAsync(soignantController.rattacherPatient));
r.get('/patients/:id', catchAsync(soignantController.getPatientDetail));
r.post('/patients/:id/observations', catchAsync(soignantController.createObservation));
r.post('/patients/:id/traitements', catchAsync(soignantController.createTraitement));
r.patch('/traitements/:id', catchAsync(soignantController.updateTraitement));

r.get('/rendez-vous', catchAsync(soignantController.getRendezVous));
r.patch('/rendez-vous/:id', catchAsync(soignantController.updateRendezVous));
r.get('/signalements', catchAsync(soignantController.getSignalements));
r.patch('/signalements/:id', catchAsync(soignantController.updateSignalement));

export default r;
