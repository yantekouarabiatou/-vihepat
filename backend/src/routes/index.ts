import { Router } from 'express';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import soignantRoutes from './soignant.routes';

const r = Router();

r.use('/auth', authRoutes);
r.use('/patients', patientRoutes);
r.use('/soignant', soignantRoutes);

export default r;