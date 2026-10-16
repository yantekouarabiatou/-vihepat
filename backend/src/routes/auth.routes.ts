import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { authRequired } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

// Changement de mot de passe : 5 essais / 15 min par compte (le mot de passe actuel est vérifié)
const limiteChangement = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.userId ?? req.ip}`,
  message: { error: 'Trop de tentatives, réessayez plus tard', code: 'TOO_MANY_ATTEMPTS' },
});

// Mot de passe oublié / réinitialisation : 5 demandes / heure par adresse IP
const limiteOubli = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez plus tard', code: 'TOO_MANY_ATTEMPTS' },
});

r.get('/structures', catchAsync(authController.getStructures));
r.post('/register/patient', catchAsync(authController.registerPatient));
r.post('/register/soignant', catchAsync(authController.registerSoignant));
r.post('/login', catchAsync(authController.login));
r.post('/refresh', catchAsync(authController.refresh));
r.get('/me', authRequired, catchAsync(authController.me));
r.post('/password/change', authRequired, limiteChangement, catchAsync(authController.changePassword));
r.post('/password/forgot', limiteOubli, catchAsync(authController.forgotPassword));
r.post('/password/reset', limiteOubli, catchAsync(authController.resetPassword));

export default r;
