import { Request, Response } from 'express';
import { z } from 'zod';
import * as service from '../services/soignant-planification.service';
import * as vueGlobale from '../services/soignant-vue-globale.service';
import { logAudit } from '../middlewares/audit';

const idParam = z.coerce.number().int().positive();
const dates = z.array(z.string().datetime({ offset: true })).min(1).max(24);

export async function getAgenda(req: Request, res: Response) {
  const { du, au } = z.object({ du: z.coerce.date(), au: z.coerce.date() }).parse(req.query);
  res.json(await service.getAgenda(req.user!.userId, du, au));
}

export async function listeRendezVous(req: Request, res: Response) {
  const { du, au } = z.object({ du: z.coerce.date().optional(), au: z.coerce.date().optional() }).parse(req.query);
  res.json(await vueGlobale.listeRendezVous(req.user!.userId, du, au));
}

export async function apercuSerie(req: Request, res: Response) {
  const data = z.object({ patientId: z.coerce.number().int().positive(), dates }).parse(req.body);
  res.json(await service.apercuSerie(req.user!.userId, data.patientId, data.dates));
}

export async function creerSerie(req: Request, res: Response) {
  const data = z
    .object({ patientId: z.coerce.number().int().positive(), dates, motif: z.string().trim().max(200).optional(), rappelAuto: z.boolean().default(true) })
    .parse(req.body);
  const r = await service.creerSerie(req.user!.userId, data);
  await logAudit(req, 'CREATE_SERIE_RENDEZ_VOUS', `patient:${data.patientId}`, { nombre: r.crees });
  res.status(201).json(r);
}

export async function rappelerMaintenant(req: Request, res: Response) {
  const r = await service.rappelerMaintenant(req.user!.userId, idParam.parse(req.params.id));
  await logAudit(req, 'RAPPEL_RENDEZ_VOUS', `rendez_vous:${r.rendezVous.id}`, { email: r.email, notification: r.notification });
  res.json(r);
}

export async function changerRappelAuto(req: Request, res: Response) {
  const { rappelAuto } = z.object({ rappelAuto: z.boolean() }).parse(req.body);
  res.json(await service.changerRappelAuto(req.user!.userId, idParam.parse(req.params.id), rappelAuto));
}
