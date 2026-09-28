import { Op } from 'sequelize';
import { Observation, PriseMedicament, Traitement } from '../models';
import type { Pathologie } from '../models/Patient';
import type { StatutPrise } from '../models/PriseMedicament';

/** Fuseau de référence (Bénin, UTC+1) pour découper les journées. */
const APP_TZ = 'Africa/Porto-Novo';

function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/* ------------------------------------------------------------------ */
/* Outils de dates (jours au format YYYY-MM-DD)                        */
/* ------------------------------------------------------------------ */

export function jourLocal(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function ecartJours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Prises attendues                                                    */
/* ------------------------------------------------------------------ */

/** Déduit le nombre de prises quotidiennes à partir du libellé de fréquence ("1x/jour", "2 x/jour", "matin et soir"). */
export function prisesParJour(frequence: string): number {
  const m = frequence.match(/(\d+)\s*x/i);
  if (m) return Math.min(Math.max(Number(m[1]), 1), 4);
  if (/matin.*soir|soir.*matin/i.test(frequence)) return 2;
  return 1;
}

/** Heure indicative de la prise de rang `rang` (les prises sont réparties sur 24 h à partir de heurePrise). */
function heureDuRang(heurePrise: string | null | undefined, n: number, rang: number): string | null {
  if (!heurePrise) return null;
  const [h, min] = heurePrise.split(':').map(Number);
  if (h === undefined || min === undefined || Number.isNaN(h) || Number.isNaN(min)) return heurePrise;
  const total = (h * 60 + min + Math.round(((rang - 1) * 24 * 60) / n)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function actifLe(t: Traitement, jour: string): boolean {
  const debut = jourLocal(new Date(t.dateDebut));
  if (jour < debut) return false;
  if (t.dateFin && jour > jourLocal(new Date(t.dateFin))) return false;
  // Un traitement arrêté sans date de fin n'est plus attendu
  if (!t.actif && !t.dateFin) return false;
  return true;
}

async function traitementsSurPeriode(patientId: number, debut: string, fin: string) {
  return Traitement.findAll({
    where: {
      patientId,
      dateDebut: { [Op.lte]: new Date(`${fin}T23:59:59Z`) },
      [Op.or]: [{ dateFin: null }, { dateFin: { [Op.gte]: new Date(`${debut}T00:00:00Z`) } }],
    },
    order: [['heurePrise', 'ASC']],
  });
}

/* ------------------------------------------------------------------ */
/* Journée du patient                                                  */
/* ------------------------------------------------------------------ */

export interface PriseDuJour {
  traitementId: number;
  molecule: string;
  dosage: string | null;
  rang: number;
  nbParJour: number;
  heure: string | null;
  statut: StatutPrise | null;
}

export async function getJournee(patientId: number, jour: string = jourLocal()): Promise<PriseDuJour[]> {
  const traitements = (await traitementsSurPeriode(patientId, jour, jour)).filter((t) => actifLe(t, jour));
  const prises = await PriseMedicament.findAll({ where: { patientId, datePrevue: jour } });
  const statutDe = (traitementId: number, rang: number) =>
    prises.find((p) => p.traitementId === traitementId && p.rang === rang)?.statut ?? null;

  const liste: PriseDuJour[] = [];
  for (const t of traitements) {
    const n = prisesParJour(t.frequence);
    for (let rang = 1; rang <= n; rang++) {
      liste.push({
        traitementId: t.id,
        molecule: t.molecule,
        dosage: t.dosage ?? null,
        rang,
        nbParJour: n,
        heure: heureDuRang(t.heurePrise, n, rang),
        statut: statutDe(t.id, rang),
      });
    }
  }
  return liste.sort((a, b) => (a.heure ?? '99').localeCompare(b.heure ?? '99'));
}

export async function declarerPrise(
  patientId: number,
  input: { traitementId: number; rang?: number | undefined; statut: StatutPrise; date?: string | undefined }
) {
  const aujourdhui = jourLocal();
  const jour = input.date ?? aujourdhui;
  const ecart = ecartJours(jour, aujourdhui);
  // On autorise la déclaration pour aujourd'hui et les 2 jours précédents, pas au-delà
  if (ecart < 0 || ecart > 2) throw httpError(400, 'Déclaration possible uniquement pour les 3 derniers jours');

  const traitement = await Traitement.findOne({ where: { id: input.traitementId, patientId } });
  if (!traitement || !actifLe(traitement, jour)) throw httpError(404, 'Traitement introuvable pour ce jour');

  const rang = input.rang ?? 1;
  if (rang < 1 || rang > prisesParJour(traitement.frequence)) throw httpError(400, 'Rang de prise invalide');

  const existante = await PriseMedicament.findOne({
    where: { traitementId: traitement.id, datePrevue: jour, rang },
  });
  if (existante) {
    existante.statut = input.statut;
    existante.declareeA = new Date();
    await existante.save();
    return existante;
  }
  return PriseMedicament.create({
    patientId, traitementId: traitement.id, datePrevue: jour, rang, statut: input.statut,
  });
}

/* ------------------------------------------------------------------ */
/* Score d'observance                                                  */
/* ------------------------------------------------------------------ */

export interface JourObservance {
  date: string;
  prevues: number;
  prises: number;
  manquees: number;
}

export interface ResumeObservance {
  /** Taux sur 7 jours (0-100), null si aucune prise attendue */
  taux7: number | null;
  taux30: number | null;
  /** Nombre de jours consécutifs (jusqu'à hier, ou aujourd'hui si tout est pris) sans oubli */
  serie: number;
  /** Prises non renseignées sur 30 jours (hors aujourd'hui) */
  nonRenseignees30: number;
  /** 14 derniers jours, du plus ancien au plus récent */
  jours: JourObservance[];
}

export async function getResumeObservance(patientId: number): Promise<ResumeObservance> {
  const aujourdhui = jourLocal();
  const debut = ajouterJours(aujourdhui, -29);
  const traitements = await traitementsSurPeriode(patientId, debut, aujourdhui);
  const prises = await PriseMedicament.findAll({
    where: { patientId, datePrevue: { [Op.between]: [debut, aujourdhui] } },
  });

  const parJour = new Map<string, { prises: number; manquees: number }>();
  for (const p of prises) {
    const e = parJour.get(p.datePrevue) ?? { prises: 0, manquees: 0 };
    if (p.statut === 'prise') e.prises++;
    else e.manquees++;
    parJour.set(p.datePrevue, e);
  }

  const jours: JourObservance[] = [];
  for (let i = 0; i < 30; i++) {
    const date = ajouterJours(debut, i);
    const declare = parJour.get(date) ?? { prises: 0, manquees: 0 };
    let prevues = traitements
      .filter((t) => actifLe(t, date))
      .reduce((s, t) => s + prisesParJour(t.frequence), 0);
    // Aujourd'hui : on ne compte que ce qui a déjà été déclaré (la journée n'est pas finie)
    if (date === aujourdhui) prevues = Math.min(prevues, declare.prises + declare.manquees);
    jours.push({ date, prevues, prises: Math.min(declare.prises, prevues), manquees: declare.manquees });
  }

  const taux = (liste: JourObservance[]) => {
    const prevues = liste.reduce((s, j) => s + j.prevues, 0);
    if (prevues === 0) return null;
    return Math.round((liste.reduce((s, j) => s + j.prises, 0) / prevues) * 100);
  };

  let serie = 0;
  const dernier = jours[jours.length - 1];
  const inclureAujourdhui = !!dernier && dernier.prevues > 0 && dernier.prises === dernier.prevues;
  for (let i = jours.length - (inclureAujourdhui ? 1 : 2); i >= 0; i--) {
    const j = jours[i]!;
    if (j.prevues === 0) continue;
    if (j.prises < j.prevues) break;
    serie++;
  }

  const nonRenseignees30 = jours
    .filter((j) => j.date !== aujourdhui)
    .reduce((s, j) => s + Math.max(j.prevues - j.prises - j.manquees, 0), 0);

  return {
    taux7: taux(jours.slice(-7)),
    taux30: taux(jours),
    serie,
    nonRenseignees30,
    jours: jours.slice(-14),
  };
}

/* ------------------------------------------------------------------ */
/* Alertes d'examens biologiques                                       */
/* ------------------------------------------------------------------ */

/**
 * Fréquences indicatives de suivi biologique, à paramétrer selon les directives
 * du programme national (PNLS/PSLS). Elles déclenchent un rappel, jamais une décision clinique.
 */
const CALENDRIER_EXAMENS: { type: string; libelle: string; intervalleJours: number; pour: (p: Pathologie) => boolean }[] = [
  { type: 'charge_virale', libelle: 'Charge virale VIH', intervalleJours: 182, pour: (p) => p.startsWith('vih') },
  { type: 'cd4', libelle: 'CD4', intervalleJours: 365, pour: (p) => p.startsWith('vih') },
  { type: 'transaminases', libelle: 'Transaminases (ALAT)', intervalleJours: 182, pour: (p) => p.includes('vhb') || p.includes('vhc') },
  { type: 'arn_vhc', libelle: 'ARN VHC', intervalleJours: 365, pour: (p) => p.includes('vhc') },
];

export interface AlerteExamen {
  type: string;
  libelle: string;
  dernierPrelevement: string | null;
  echeance: string;
  statut: 'en_retard' | 'bientot';
  joursRestants: number;
}

export async function getAlertesExamens(patientId: number, pathologie: Pathologie): Promise<AlerteExamen[]> {
  const aujourdhui = jourLocal();
  const observations = await Observation.findAll({
    where: { patientId },
    order: [['datePrelevement', 'DESC']],
  });

  const alertes: AlerteExamen[] = [];
  for (const regle of CALENDRIER_EXAMENS.filter((r) => r.pour(pathologie))) {
    const derniere = observations.find((o) => o.type === regle.type);
    const dernierJour = derniere ? jourLocal(new Date(derniere.datePrelevement)) : null;
    const echeance = dernierJour ? ajouterJours(dernierJour, regle.intervalleJours) : aujourdhui;
    const joursRestants = ecartJours(aujourdhui, echeance);
    if (joursRestants > 30) continue;
    alertes.push({
      type: regle.type,
      libelle: regle.libelle,
      dernierPrelevement: dernierJour,
      echeance,
      statut: joursRestants <= 0 ? 'en_retard' : 'bientot',
      joursRestants,
    });
  }
  return alertes.sort((a, b) => a.joursRestants - b.joursRestants);
}
