import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import { authRequired, requireRole } from '../middlewares/auth';

const r = Router();

r.use(authRequired, requireRole('patient'));

r.get('/me/rendez-vous', patientController.getRendezVous);
r.post('/me/rendez-vous', patientController.createRendezVous);
r.get('/me/traitements', patientController.getTraitements);
r.get('/me/observations', patientController.getObservations);
r.get('/me/signalements', patientController.getSignalements);
r.post('/me/signalements', patientController.createSignalement);

export default r;
