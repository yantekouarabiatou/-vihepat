import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import * as triageController from '../controllers/triage.controller';
import { authRequired, requireRole, requirePermission as perm } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.use(authRequired, requireRole('patient'));

r.get('/me/rendez-vous', perm('patient:read_own'), catchAsync(patientController.getRendezVous));
r.post('/me/rendez-vous', perm('rendez_vous:request'), catchAsync(patientController.createRendezVous));
r.get('/me/traitements', perm('traitement:read'), catchAsync(patientController.getTraitements));
r.get('/me/observations', perm('observation:read'), catchAsync(patientController.getObservations));
r.get('/me/signalements', perm('patient:read_own'), catchAsync(patientController.getSignalements));
r.post('/me/signalements', perm('signalement:create'), catchAsync(patientController.createSignalement));
r.post('/me/chat', catchAsync(patientController.chat));
r.post('/me/triage-vocal', perm('signalement:create'), catchAsync(triageController.triageVocal));
r.get('/me/observance', perm('observance:read'), catchAsync(patientController.getObservance));
r.post('/me/prises', perm('observance:declare'), catchAsync(patientController.declarerPrise));
r.get('/me/alertes-examens', perm('observation:read'), catchAsync(patientController.getAlertesExamens));
r.get('/me/acces', perm('patient:read_own'), catchAsync(patientController.getAccesDossier));
r.get('/me/communiques', perm('communique:read'), catchAsync(patientController.getCommuniques));
r.get('/me/rappels/partage', perm('patient:read_own'), catchAsync(patientController.getPartageRappels));
r.put('/me/rappels/partage', perm('patient:read_own'), catchAsync(patientController.setPartageRappels));
r.post('/me/rappels/confirmations', perm('observance:declare'), catchAsync(patientController.enregistrerConfirmations));
r.post('/me/rappels/journal', catchAsync(patientController.journaliserRappel));

export default r;
