import { Router } from 'express';
import * as soignantController from '../controllers/soignant.controller';
import { authRequired, requireRole } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('soignant', 'admin'));

r.get('/patients', catchAsync(soignantController.getPatients));
r.post('/patients', catchAsync(soignantController.creerPatient));
r.post('/patients/rattacher', catchAsync(soignantController.rattacherPatient));
r.get('/patients/:id', catchAsync(soignantController.getPatientDetail));
r.patch('/patients/:id', catchAsync(soignantController.updatePatient));
r.post('/patients/:id/reinitialiser-acces', catchAsync(soignantController.reinitialiserAccesPatient));
r.post('/patients/:id/observations', catchAsync(soignantController.createObservation));
r.post('/patients/:id/traitements', catchAsync(soignantController.createTraitement));
r.patch('/traitements/:id', catchAsync(soignantController.updateTraitement));

r.get('/rendez-vous', catchAsync(soignantController.getRendezVous));
r.post('/rendez-vous', catchAsync(soignantController.createRendezVous));
r.patch('/rendez-vous/:id', catchAsync(soignantController.updateRendezVous));
r.post('/rendez-vous/:id/rappel', catchAsync(soignantController.envoyerRappelRdv));
r.get('/signalements', catchAsync(soignantController.getSignalements));
r.patch('/signalements/:id', catchAsync(soignantController.updateSignalement));
r.get('/communiques', catchAsync(soignantController.getCommuniques));
r.post('/communiques', catchAsync(soignantController.createCommunique));

export default r;
