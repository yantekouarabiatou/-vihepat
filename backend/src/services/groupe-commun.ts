import { MembreGroupe, MessageGroupe, Patient, ReactionMessage, User } from '../models';
import { pseudonyme } from './pseudonyme.service';

/** Fonctions communes aux groupes de soutien (membres et équipe soignante). */

export function httpError(status: number, message: string) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function estMembre(groupeId: number, patientId: number) {
  const membre = await MembreGroupe.findOne({ where: { groupeId, patientId } });
  return !!membre;
}

/** Les membres ne voient jamais de prénom : initiales + nom généré (services/pseudonyme.service.ts) */
// Des fonctions, pas des constantes : Sequelize modifie l'objet d'inclusion qu'on lui passe,
// et un même objet réutilisé dans une requête produit un alias en double (ER_NONUNIQ_TABLE)
export const inclureAuteur = () => ({
  model: Patient, as: 'patient', attributes: ['id', 'codePatient'],
  include: [{ model: User, as: 'user', attributes: ['prenom', 'nom'] }],
});
export const inclureReponse = () => ({
  model: MessageGroupe, as: 'reponseAMessage', attributes: ['id', 'contenu', 'masque', 'patientId'],
  include: [inclureAuteur()],
});

export function pseudoDe(m: MessageGroupe) {
  const p = (m as any).patient as (Patient & { user?: User }) | undefined;
  return pseudonyme(m.patientId, p?.user?.prenom, p?.user?.nom);
}

/** Extrait du message cité dans une réponse (un message masqué n'est jamais recité) */
export function citation(m: MessageGroupe) {
  const cite = (m as any).reponseAMessage as MessageGroupe | null | undefined;
  if (!cite) return null;
  return { id: cite.id, auteur: pseudoDe(cite), extrait: cite.masque ? null : cite.contenu.slice(0, 140) };
}

export function compterReactions(m: MessageGroupe, patientId?: number) {
  const reactions = ((m as any).reactions ?? []) as ReactionMessage[];
  return {
    soutien: reactions.filter((r) => r.type === 'soutien').length,
    merci: reactions.filter((r) => r.type === 'merci').length,
    miennes: patientId === undefined ? [] : reactions.filter((r) => r.patientId === patientId).map((r) => r.type),
  };
}
