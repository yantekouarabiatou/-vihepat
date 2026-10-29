import { Router } from 'express';
import * as soignantController from '../controllers/soignant.controller';
import { authRequired, requireRole, requirePermission as perm } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('soignant', 'admin'));

r.get('/moi', catchAsync(soignantController.getMonProfil));
r.get('/patients', perm('patient:read_assigned'), catchAsync(soignantController.getPatients));
r.post('/patients', perm('patient:create'), catchAsync(soignantController.creerPatient));
r.post('/patients/rattacher', perm('patient:attach'), catchAsync(soignantController.rattacherPatient));
r.get('/patients/:id', perm('patient:read_assigned'), catchAsync(soignantController.getPatientDetail));
r.get('/patients/:id/equipe', perm('patient:read_assigned'), catchAsync(soignantController.getEquipePatient));
r.post('/patients/:id/equipe', perm('patient:attach'), catchAsync(soignantController.rattacherSoignant));
r.delete('/patients/:id/equipe/:soignantId', perm('patient:attach'), catchAsync(soignantController.detacherSoignant));
r.patch('/patients/:id', perm('patient:update'), catchAsync(soignantController.updatePatient));
r.post('/patients/:id/reinitialiser-acces', perm('patient:update'), catchAsync(soignantController.reinitialiserAccesPatient));
r.put('/patients/:id/bilan-inclusion', perm('observation:create'), catchAsync(soignantController.enregistrerBilanInclusion));
r.post('/patients/:id/observations', perm('observation:create'), catchAsync(soignantController.createObservation));
r.post('/patients/:id/traitements', perm('traitement:manage'), catchAsync(soignantController.createTraitement));
r.patch('/traitements/:id', perm('traitement:manage'), catchAsync(soignantController.updateTraitement));

r.get('/rendez-vous', perm('rendez_vous:manage'), catchAsync(soignantController.getRendezVous));
r.post('/rendez-vous', perm('rendez_vous:manage'), catchAsync(soignantController.createRendezVous));
r.patch('/rendez-vous/:id', perm('rendez_vous:manage'), catchAsync(soignantController.updateRendezVous));
r.post('/rendez-vous/:id/rappel', perm('rendez_vous:manage'), catchAsync(soignantController.envoyerRappelRdv));
r.get('/signalements', perm('signalement:manage'), catchAsync(soignantController.getSignalements));
r.patch('/signalements/:id', perm('signalement:manage'), catchAsync(soignantController.updateSignalement));
r.get('/communiques', perm('communique:read'), catchAsync(soignantController.getCommuniques));
r.post('/communiques', perm('communique:publish'), catchAsync(soignantController.createCommunique));

export default r;
