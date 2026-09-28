import { isAxiosError } from "axios";
import { patientApi, type Gravite, type StatutPrise } from "@/api/patient.api";

/**
 * File d'attente hors ligne : les saisies faites sans réseau sont conservées
 * sur l'appareil puis envoyées automatiquement au retour de la connexion.
 */

export type ActionEnAttente =
  | { type: "signalement"; payload: { symptome: string; gravite: Gravite; notes?: string | undefined } }
  | { type: "prise"; payload: { traitementId: number; rang: number; statut: StatutPrise; date: string } };

interface Element {
  id: string;
  creeLe: string;
  /** Propriétaire de la saisie : on n'envoie jamais une saisie sous le compte d'un autre utilisateur */
  userId: number | null;
  action: ActionEnAttente;
}

function utilisateurCourant(): number | null {
  try {
    const u = JSON.parse(localStorage.getItem("vihepat_user") ?? "null") as { id?: number } | null;
    return u?.id ?? null;
  } catch {
    return null;
  }
}

const CLE = "vihepat_file_attente";
const abonnes = new Set<(n: number) => void>();

function lire(): Element[] {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "[]") as Element[];
  } catch {
    return [];
  }
}

function ecrire(elements: Element[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(elements));
  } catch {
    /* stockage plein ou indisponible */
  }
  const moi = utilisateurCourant();
  abonnes.forEach((f) => f(elements.filter((e) => e.userId === moi).length));
}

export function nombreEnAttente() {
  const moi = utilisateurCourant();
  return lire().filter((e) => e.userId === moi).length;
}

export function abonnerFileAttente(f: (n: number) => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

export function mettreEnAttente(action: ActionEnAttente) {
  const elements = lire();
  // Une seule déclaration par prise : la plus récente remplace la précédente
  const filtres =
    action.type === "prise"
      ? elements.filter(
          (e) =>
            !(
              e.action.type === "prise" &&
              e.action.payload.traitementId === action.payload.traitementId &&
              e.action.payload.rang === action.payload.rang &&
              e.action.payload.date === action.payload.date
            ),
        )
      : elements;
  filtres.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creeLe: new Date().toISOString(),
    userId: utilisateurCourant(),
    action,
  });
  ecrire(filtres);
}

export function viderFileAttente() {
  ecrire([]);
}

/** Vrai si l'erreur vient d'une absence de réseau (et non d'un refus du serveur). */
export function estErreurReseau(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return isAxiosError(err) && !err.response;
}

async function executer(action: ActionEnAttente) {
  if (action.type === "signalement") await patientApi.createSignalement(action.payload);
  else await patientApi.declarerPrise(action.payload);
}

let enCours = false;

/** Envoie les éléments en attente. Retourne le nombre d'éléments envoyés. */
export async function synchroniser(): Promise<number> {
  if (enCours || (typeof navigator !== "undefined" && !navigator.onLine)) return 0;
  enCours = true;
  let envoyes = 0;
  try {
    const moi = utilisateurCourant();
    if (moi === null) return 0;
    for (const element of lire().filter((e) => e.userId === moi)) {

      try {
        await executer(element.action);
        envoyes++;
        ecrire(lire().filter((e) => e.id !== element.id));
      } catch (err) {
        if (estErreurReseau(err)) break; // toujours hors ligne : on réessaiera plus tard
        // Refus définitif du serveur (ex. prise trop ancienne) : on abandonne cet élément
        ecrire(lire().filter((e) => e.id !== element.id));
      }
    }
  } finally {
    enCours = false;
  }
  return envoyes;
}
