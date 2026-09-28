import { create } from "zustand";

/**
 * Discrétion côté patient (téléphone souvent partagé) :
 * - code PIN local qui verrouille l'application, vérifié sur l'appareil (fonctionne hors ligne) ;
 * - mode discret qui masque les informations sensibles (pathologie, médicaments, examens).
 * Le PIN n'est jamais stocké en clair : seule une empreinte salée est conservée.
 */

interface Reglages {
  empreintePin: string | null;
  sel: string | null;
  modeDiscret: boolean;
}

interface DiscretionState extends Reglages {
  userId: number | null;
  verrouille: boolean;
  essaisRestants: number;
  charger: (userId: number | null) => void;
  definirPin: (pin: string) => Promise<void>;
  supprimerPin: () => void;
  verifierPin: (pin: string) => Promise<boolean>;
  verrouiller: () => void;
  basculerModeDiscret: () => void;
}

export const ESSAIS_MAX = 5;
const PAR_DEFAUT: Reglages = { empreintePin: null, sel: null, modeDiscret: false };

const cle = (userId: number) => `vihepat_discretion_${userId}`;

function lireReglages(userId: number): Reglages {
  try {
    return { ...PAR_DEFAUT, ...(JSON.parse(localStorage.getItem(cle(userId)) ?? "{}") as Partial<Reglages>) };
  } catch {
    return PAR_DEFAUT;
  }
}

function sauver(userId: number | null, r: Reglages) {
  if (userId === null) return;
  try {
    localStorage.setItem(cle(userId), JSON.stringify(r));
  } catch {
    /* stockage indisponible */
  }
}

async function empreinte(sel: string, pin: string): Promise<string> {
  const texte = `${sel}:${pin}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
    return Array.from(new Uint8Array(octets)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Contexte non sécurisé (http sur le réseau local) : repli FNV-1a, suffisant pour un verrou local
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv-${h.toString(16)}`;
}

function nouveauSel(): string {
  const octets = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(octets);
  else for (let i = 0; i < octets.length; i++) octets[i] = Math.floor(Math.random() * 256);
  return Array.from(octets).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const useDiscretionStore = create<DiscretionState>((set, get) => ({
  ...PAR_DEFAUT,
  userId: null,
  verrouille: false,
  essaisRestants: ESSAIS_MAX,

  // À l'ouverture de l'application, un PIN défini implique un écran verrouillé
  charger: (userId) => {
    if (userId === get().userId) return;
    const r = userId === null ? PAR_DEFAUT : lireReglages(userId);
    set({ ...r, userId, verrouille: !!r.empreintePin, essaisRestants: ESSAIS_MAX });
  },

  definirPin: async (pin) => {
    const sel = nouveauSel();
    const empreintePin = await empreinte(sel, pin);
    const r = { empreintePin, sel, modeDiscret: get().modeDiscret };
    sauver(get().userId, r);
    set({ ...r, verrouille: false, essaisRestants: ESSAIS_MAX });
  },

  supprimerPin: () => {
    const r = { empreintePin: null, sel: null, modeDiscret: get().modeDiscret };
    sauver(get().userId, r);
    set({ ...r, verrouille: false });
  },

  verifierPin: async (pin) => {
    const { sel, empreintePin, essaisRestants } = get();
    if (!sel || !empreintePin) return true;
    const ok = (await empreinte(sel, pin)) === empreintePin;
    set(ok ? { verrouille: false, essaisRestants: ESSAIS_MAX } : { essaisRestants: essaisRestants - 1 });
    return ok;
  },

  verrouiller: () => {
    if (get().empreintePin) set({ verrouille: true });
  },

  basculerModeDiscret: () => {
    const { empreintePin, sel, modeDiscret, userId } = get();
    const r = { empreintePin, sel, modeDiscret: !modeDiscret };
    sauver(userId, r);
    set(r);
  },
}));
