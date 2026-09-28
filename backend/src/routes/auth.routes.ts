import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authRequired } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.get('/structures', catchAsync(authController.getStructures));
r.post('/register/patient', catchAsync(authController.registerPatient));
r.post('/register/soignant', catchAsync(authController.registerSoignant));
r.post('/login', catchAsync(authController.login));
r.post('/refresh', catchAsync(authController.refresh));
r.get('/me', authRequired, catchAsync(authController.me));

export default r;
