import { Request, Response } from 'express';
import { z } from 'zod';
import * as patientService from '../services/patient.service';
import * as service from '../services/rappels-serveur.service';
import { logAudit } from '../middlewares/audit';

const texte = (max: number) => z.string().trim().min(1).max(max);

const synchroSchema = z.object({
  abonnement: z
    .object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(64) }) })
    .optional(),
  textes: z.object({ titre: texte(60), corps: texte(160), fait: texte(40), plusTard: texte(40) }),
  apiBase: z.string().url().max(255),
  decalageMin: z.number().int().min(-840).max(840),
  delaiRelanceMin: z.number().int().min(1).max(240),
  rappels: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9]{1,64}$/i),
        type: z.enum(['prise', 'rdv']),
        heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        jours: z.array(z.number().int().min(0).max(6)).max(7),
        actif: z.boolean(),
        depuis: z.string().datetime({ offset: true }),
      })
    )
    .max(50),
});

const cleSchema = z.string().regex(/^[a-z0-9]{1,64}-\d{12}$/i);

export async function getClePublique(_req: Request, res: Response) {
  res.json(await service.getClePublique());
}

export async function synchroniser(req: Request, res: Response) {
  const data = synchroSchema.parse(req.body);
  await patientService.getPatientOrThrow(req.user!.userId);
  const r = await service.synchroniser(req.user!.userId, data);
  if (data.abonnement) await logAudit(req, 'RAPPELS_SERVEUR_ACTIVES', 'rappels');
  res.json(r);
}

export async function desactiver(req: Request, res: Response) {
  const { endpoint } = z.object({ endpoint: z.string().max(2000).optional() }).parse(req.body ?? {});
  const r = await service.desactiver(req.user!.userId, endpoint);
  await logAudit(req, 'RAPPELS_SERVEUR_DESACTIVES', 'rappels');
  res.json(r);
}

export async function reponsesRecentes(req: Request, res: Response) {
  res.json(await service.reponsesRecentes(req.user!.userId));
}

export async function noterReponse(req: Request, res: Response) {
  const { cle } = z.object({ cle: cleSchema }).parse(req.body);
  await service.noterReponse(req.user!.userId, cle);
  res.json({ ok: true });
}

/** Sans session : appelé par le service worker depuis la notification */
export async function reponseDepuisNotification(req: Request, res: Response) {
  const data = z
    .object({ id: z.number().int().positive(), cle: cleSchema, jeton: z.string().max(64), action: z.enum(['fait', 'plus_tard']) })
    .parse(req.body);
  res.json(await service.reponseDepuisNotification(data));
}
