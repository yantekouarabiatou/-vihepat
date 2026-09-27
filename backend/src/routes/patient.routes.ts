import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import { authRequired, requireRole } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('patient'));

r.get('/me/rendez-vous', catchAsync(patientController.getRendezVous));
r.post('/me/rendez-vous', catchAsync(patientController.createRendezVous));
r.get('/me/traitements', catchAsync(patientController.getTraitements));
r.get('/me/observations', catchAsync(patientController.getObservations));
r.get('/me/signalements', catchAsync(patientController.getSignalements));
r.post('/me/signalements', catchAsync(patientController.createSignalement));
r.post('/me/chat', catchAsync(patientController.chat));

export default r;
