import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { authOptional } from '../middlewares/auth';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

// Endpoint accessible par tout le monde (visiteurs, patients, soignants, admins)
r.post('/', authOptional, catchAsync(chatController.handleChat));

export default r;
