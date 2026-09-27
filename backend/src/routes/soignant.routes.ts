import { Router } from 'express';
import * as soignantController from '../controllers/soignant.controller';
import { authRequired, requireRole } from '../middlewares/auth';

const r = Router();

r.use(authRequired, requireRole('soignant'));

r.get('/patients', soignantController.getPatients);
r.get('/rendez-vous', soignantController.getRendezVous);
r.patch('/rendez-vous/:id', soignantController.updateRendezVous);
r.get('/signalements', soignantController.getSignalements);
r.patch('/signalements/:id', soignantController.updateSignalement);

export default r;
