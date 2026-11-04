import type { Patient } from '../models';
import type { BilanInclusion } from '../models/BilanInclusion';
import {
  calculerRisque, construireEntree, modeleDisponible, pathologieConcernee, INFOS_MODELE,
  type Facteur, type NiveauRisque,
} from '../ia/perte-de-suivi';

/** Facteurs montrés au soignant : les plus influents dans chaque sens */
const NB_FACTEURS = 3;

export type RisquePerteSuivi =
  /** Pathologie hors du champ du modèle (appris sur des patients VIH) */
  | { statut: 'non_concerne' }
  /** Pas encore de bilan d'inclusion saisi : on n'invente pas un dossier « vide » */
  | { statut: 'bilan_absent' }
  /** Le portage du modèle ne redonne pas les résultats de scikit-learn */
  | { statut: 'indisponible' }
  | {
      statut: 'calcule';
      probabilite: number;
      niveau: NiveauRisque;
      examensManquants: number;
      hausse: Facteur[];
      baisse: Facteur[];
      modele: typeof INFOS_MODELE;
    };

export function evaluerRisquePatient(patient: Patient, bilan: BilanInclusion | null | undefined): RisquePerteSuivi {
  if (!pathologieConcernee(patient.pathologie)) return { statut: 'non_concerne' };
  if (!bilan) return { statut: 'bilan_absent' };
  if (!modeleDisponible()) return { statut: 'indisponible' };

  const entree = construireEntree({
    bilan,
    dateNaissance: patient.dateNaissance ?? null,
    sexe: patient.sexe ?? null,
    dateDiagnostic: patient.dateDiagnostic ?? null,
    dateDossier: (patient as any).createdAt ?? new Date(),
  });
  const r = calculerRisque(entree);
  return {
    statut: 'calcule',
    probabilite: r.probabilite,
    niveau: r.niveau,
    examensManquants: Number(entree.nb_examens_manquants),
    hausse: r.facteurs.filter((f) => f.contribution > 0.01).slice(0, NB_FACTEURS),
    baisse: r.facteurs.filter((f) => f.contribution < -0.01).slice(0, NB_FACTEURS),
    modele: INFOS_MODELE,
  };
}
