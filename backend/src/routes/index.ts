import { Router } from 'express';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import soignantRoutes from './soignant.routes';
import groupeRoutes from './groupe.routes';
import adminRoutes from './admin.routes';
import chatRoutes from './chat.routes';

const r = Router();

r.use('/auth', authRoutes);
r.use('/patients/me/groupes', groupeRoutes);
r.use('/patients', patientRoutes);
r.use('/soignant', soignantRoutes);
r.use('/admin', adminRoutes);
r.use('/chat', chatRoutes);

export default r;