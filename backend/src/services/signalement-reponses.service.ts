import { Op } from 'sequelize';
import { Patient, Signalement, Soignant, User } from '../models';
import { ReponseSignalement } from '../models/ReponseSignalement';
import { avertirPatient, getContexte, getPatientIds, httpError } from './soignant-contexte';
import { getPatientOrThrow } from './patient.service';
import { envoyerAUtilisateur } from './rappels-serveur.service';

/**
 * Réponses écrites ou vocales à un signalement, entre l'équipe soignante et le patient.
 * Le patient est prévenu sans aucun contenu médical (e-mail neutre, notification au titre discret).
 */

const TYPES_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a'];
const AUDIO_MAX_OCTETS = 3 * 1024 * 1024;
const DUREE_MAX_S = 180;

export interface ReponseEntree {
  texte?: string | undefined;
  audio?: { base64: string; type: string; duree: number } | undefined;
}

/** Sans le fichier audio (servi à part), avec le nom de l'auteur */
const ATTRIBUTS = ['id', 'signalementId', 'auteurId', 'auteurRole', 'texte', 'audioType', 'audioDuree', 'luLe', 'createdAt'];
const inclureAuteur = () => ({
  model: User,
  as: 'auteur',
  attributes: ['nom', 'prenom'],
  include: [{ model: Soignant, as: 'soignant', attributes: ['fonction'] }],
});

function valider(e: ReponseEntree) {
  const texte = e.texte?.trim() || null;
  let audio: Buffer | null = null;
  const audioType = e.audio ? e.audio.type.split(';')[0]!.trim().toLowerCase() : null;
  if (e.audio) {
    if (!TYPES_AUDIO.includes(audioType!)) throw httpError(400, 'Format audio non pris en charge');
    audio = Buffer.from(e.audio.base64, 'base64');
    if (audio.length === 0 || audio.length > AUDIO_MAX_OCTETS) throw httpError(400, 'Note vocale vide ou trop lourde');
    if (e.audio.duree > DUREE_MAX_S) throw httpError(400, 'Note vocale trop longue');
  }
  if (!texte && !audio) throw httpError(400, 'Message vide');
  return { texte, audio, audioType, audioDuree: e.audio ? Math.round(e.audio.duree) : null };
}

async function signalementPourSoignant(userId: number, signalementId: number) {
  const ctx = await getContexte(userId);
  const s = await Signalement.findByPk(signalementId);
  if (!s || !(await getPatientIds(ctx)).includes(s.patientId)) throw httpError(404, 'Signalement introuvable');
  return s;
}

async function signalementPourPatient(userId: number, signalementId: number) {
  const patient = await getPatientOrThrow(userId);
  const s = await Signalement.findByPk(signalementId);
  if (!s || s.patientId !== patient.id) throw httpError(404, 'Signalement introuvable');
  return s;
}

function lister(signalementId: number) {
  return ReponseSignalement.findAll({ where: { signalementId }, attributes: ATTRIBUTS, include: [inclureAuteur()], order: [['createdAt', 'ASC']] });
}

const relire = (id: number) => ReponseSignalement.findByPk(id, { attributes: ATTRIBUTS, include: [inclureAuteur()] });

// ---------------------------------------------------------------------------
// Équipe soignante
// ---------------------------------------------------------------------------

export async function listerPourSoignant(userId: number, signalementId: number) {
  await signalementPourSoignant(userId, signalementId);
  // Les messages du patient sont maintenant lus par l'équipe
  await ReponseSignalement.update({ luLe: new Date() }, { where: { signalementId, auteurRole: 'patient', luLe: null } });
  return lister(signalementId);
}

export async function repondreSoignant(userId: number, signalementId: number, e: ReponseEntree) {
  const s = await signalementPourSoignant(userId, signalementId);
  const r = await ReponseSignalement.create({ signalementId, auteurId: userId, auteurRole: 'soignant', ...valider(e) });
  // Répondre vaut prise en compte
  if (s.statut === 'nouveau') await s.update({ statut: 'vu' });
  // Patient prévenu sans contenu : e-mail neutre, et notification s'il a activé les rappels sur son téléphone
  void avertirPatient(s.patientId);
  const patient = await Patient.findByPk(s.patientId, { attributes: ['userId', 'languePreferee'] });
  if (patient) {
    const corps = patient.languePreferee === 'en' ? 'You have a new message in your space.' : 'Vous avez un nouveau message dans votre espace.';
    void envoyerAUtilisateur(patient.userId, (textes) => ({ titre: textes.titre, corps, cle: `message-${r.id}`, url: '/signalements' })).catch(() => 0);
  }
  return relire(r.id);
}

/** Nombre de messages du patient pas encore lus par l'équipe, par signalement */
export async function nonLusParSignalement(signalementIds: number[]) {
  const m = new Map<number, number>();
  if (signalementIds.length === 0) return m;
  const rows = await ReponseSignalement.findAll({
    where: { signalementId: { [Op.in]: signalementIds }, auteurRole: 'patient', luLe: null },
    attributes: ['signalementId'],
  });
  for (const r of rows) m.set(r.signalementId, (m.get(r.signalementId) ?? 0) + 1);
  return m;
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export async function listerPourPatient(userId: number, signalementId: number) {
  await signalementPourPatient(userId, signalementId);
  await ReponseSignalement.update({ luLe: new Date() }, { where: { signalementId, auteurRole: 'soignant', luLe: null } });
  return lister(signalementId);
}

export async function repondrePatient(userId: number, signalementId: number, e: ReponseEntree) {
  const s = await signalementPourPatient(userId, signalementId);
  const r = await ReponseSignalement.create({ signalementId, auteurId: userId, auteurRole: 'patient', ...valider(e) });
  // Un signalement déjà traité revient dans la liste « à traiter » de l'équipe
  if (s.statut === 'traite') await s.update({ statut: 'vu' });
  return relire(r.id);
}

/** Signalements du patient, avec le nombre de messages et de réponses de l'équipe non lues */
export async function signalementsAvecMessages(userId: number) {
  const patient = await getPatientOrThrow(userId);
  const signalements = await Signalement.findAll({ where: { patientId: patient.id }, order: [['createdAt', 'DESC']] });
  const ids = signalements.map((s) => s.id);
  const reponses = ids.length
    ? await ReponseSignalement.findAll({ where: { signalementId: { [Op.in]: ids } }, attributes: ['signalementId', 'auteurRole', 'luLe'] })
    : [];
  return signalements.map((s) => {
    const fil = reponses.filter((r) => r.signalementId === s.id);
    return { ...s.toJSON(), messages: fil.length, nonLus: fil.filter((r) => r.auteurRole === 'soignant' && !r.luLe).length };
  });
}

export async function reponsesNonLuesPatient(patientId: number) {
  const ids = (await Signalement.findAll({ where: { patientId }, attributes: ['id'] })).map((s) => s.id);
  if (ids.length === 0) return 0;
  return ReponseSignalement.count({ where: { signalementId: { [Op.in]: ids }, auteurRole: 'soignant', luLe: null } });
}

// ---------------------------------------------------------------------------
// Note vocale (servie à part, avec contrôle d'accès)
// ---------------------------------------------------------------------------

export async function audio(userId: number, role: string, reponseId: number) {
  const r = await ReponseSignalement.findByPk(reponseId);
  if (!r?.audio) throw httpError(404, 'Note vocale introuvable');
  if (role === 'patient') await signalementPourPatient(userId, r.signalementId);
  else await signalementPourSoignant(userId, r.signalementId);
  return { contenu: r.audio, type: r.audioType ?? 'audio/webm' };
}
