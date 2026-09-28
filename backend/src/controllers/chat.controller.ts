import { Request, Response } from 'express';
import { z } from 'zod';
import * as chatService from '../services/chat.service';
import { logAudit } from '../middlewares/audit';

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(3000),
    })
  ).min(1),
});

export async function handleChat(req: Request, res: Response) {
  const { messages } = chatSchema.parse(req.body);
  const userId = req.user?.userId ?? null;
  const userRole = req.user?.role ?? null;

  const result = await chatService.sendChatMessage(userId, userRole, messages);

  if (result.signalementCreated && userId) {
    await logAudit(req, 'CREATE_SIGNALEMENT_CHAT', `user:${userId}`);
  }

  res.json(result);
}
