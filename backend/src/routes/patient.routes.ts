import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import * as triageController from '../controllers/triage.controller';
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
r.post('/me/triage-vocal', catchAsync(triageController.triageVocal));
r.get('/me/observance', catchAsync(patientController.getObservance));
r.post('/me/prises', catchAsync(patientController.declarerPrise));
r.get('/me/alertes-examens', catchAsync(patientController.getAlertesExamens));
r.get('/me/acces', catchAsync(patientController.getAccesDossier));
r.get('/me/communiques', catchAsync(patientController.getCommuniques));



export default r;
