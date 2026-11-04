import { Router } from 'express';
import * as controller from '../controllers/rappels-serveur.controller';
import { catchAsync } from '../utils/catchAsync';

/** Routes publiques des rappels envoyés par le serveur (sans session) */
const r = Router();

r.get('/cle-publique', catchAsync(controller.getClePublique));
r.post('/reponse', catchAsync(controller.reponseDepuisNotification));

export default r;
