import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authRequired } from '../middlewares/auth';

const r = Router();

r.post('/register/patient', authController.registerPatient);
r.post('/register/soignant', authController.registerSoignant);
r.post('/login', authController.login);
r.post('/refresh', authController.refresh);
r.get('/me', authRequired, authController.me);

export default r;