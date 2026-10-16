import { create } from "zustand";
import i18n from "@/i18n";
import { mettreEnAttente, synchroniser } from "@/lib/offline-queue";

/**
 * Rappels discrets du patient (prises et rendez-vous).
 *
 * Tout est conservé sur l'appareil, par compte : le libellé, l'heure, les jours et les
 * réglages ne quittent jamais le téléphone. Le serveur ne reçoit que :
 * - les réponses (« C'est fait » / non confirmé), si le patient accepte le partage ;
 * - un journal d'audit de type « rappel créé / modifié / supprimé », sans aucun contenu.
 * Les alarmes se déclenchent sans réseau ; les réponses sont mises en file d'attente
 * puis envoyées au retour de la connexion (voir offline-queue).
 */

export type TypeRappel = "prise" | "rdv";
export type ModeSonore = "son_vibration" | "vibration" | "silencieux";
export type ActionJournal = "RAPPEL_CREE" | "RAPPEL_MODIFIE" | "RAPPEL_SUPPRIME" | "RAPPEL_ACTIVE" | "RAPPEL_DESACTIVE";

export interface Rappel {
  id: string;
  libelle: string;
  /** « HH:MM », heure locale */
  heure: string;
  /** Jours de la semaine (0 = dimanche … 6 = samedi) ; vide = tous les jours */
  jours: number[];
  type: TypeRappel;
  actif: boolean;
  /** Création, modification ou réactivation (ISO) : aucune échéance antérieure n'est générée */
  depuis: string;
}

export interface ReglagesRappels {
  /** Titre de la notification (vide = titre neutre par défaut, traduit) */
  titreNotification: string;
  modeSonore: ModeSonore;
  /** Délai avant l'unique relance, puis avant le passage à « non confirmé » */
  delaiRelanceMin: number;
  /** Copie locale du consentement au partage (la référence est sur le serveur) */
  partage: boolean;
}

export type EtatOccurrence = "en_attente" | "confirmee" | "non_confirmee";

/** Une échéance précise d'un rappel (ex. « rappel X du 16/10 à 08:00 »). */
export interface Occurrence {
  cle: string;
  rappelId: string;
  type: TypeRappel;
  /** Échéance prévue (ISO) */
  prevuLe: string;
  etat: EtatOccurrence;
  /** Prochaine alerte (ISO) : l'échéance, ou l'heure choisie via « Plus tard » */
  alerteA: string;
  notifiee: boolean;
  relancee: boolean;
  /** Fin du délai de réponse après la relance (ISO) */
  limiteA: string | null;
  reports: number;
  reponduLe: string | null;
}

export const REPORTS_MINUTES = [10, 30, 60] as const;
export const DELAIS_RELANCE = [10, 15, 30, 60] as const;
/** Une échéance manquée depuis plus longtemps (application fermée) n'est plus notifiée. */
const RETARD_MAX_NOTIF_MS = 60 * 60 * 1000;
/** Historique local conservé. */
const CONSERVATION_MS = 14 * 24 * 60 * 60 * 1000;

const REGLAGES_DEFAUT: ReglagesRappels = {
  titreNotification: "",
  modeSonore: "vibration",
  delaiRelanceMin: 15,
  partage: true,
};

interface DonneesRappels {
  rappels: Rappel[];
  reglages: ReglagesRappels;
  occurrences: Occurrence[];
}

const VIDE: DonneesRappels = { rappels: [], reglages: REGLAGES_DEFAUT, occurrences: [] };
const cleStockage = (userId: number) => `vihepat_rappels_v2_${userId}`;

function lire(userId: number): DonneesRappels {
  try {
    const brut = JSON.parse(localStorage.getItem(cleStockage(userId)) ?? "null") as Partial<DonneesRappels> | null;
    if (!brut) return VIDE;
    return {
      rappels: brut.rappels ?? [],
      reglages: { ...REGLAGES_DEFAUT, ...(brut.reglages ?? {}) },
      occurrences: brut.occurrences ?? [],
    };
  } catch {
    return VIDE;
  }
}

function sauver(userId: number | null, d: DonneesRappels) {
  if (userId === null) return;
  try {
    localStorage.setItem(cleStockage(userId), JSON.stringify(d));
  } catch {
    /* stockage plein ou indisponible : les rappels restent actifs pour la session */
  }
}

function nouvelId(): string {
  const octets = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(octets);
  else for (let i = 0; i < octets.length; i++) octets[i] = Math.floor(Math.random() * 256);
  return Array.from(octets).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function journaliser(action: ActionJournal) {
  mettreEnAttente({ type: "journal_rappel", payload: { action } });
  void synchroniser();
}

interface RappelsState extends DonneesRappels {
  userId: number | null;
  charger: (userId: number | null) => void;
  ajouter: (r: Omit<Rappel, "id" | "actif" | "depuis">) => void;
  modifier: (id: string, r: Omit<Rappel, "id" | "actif" | "depuis">) => void;
  supprimer: (id: string) => void;
  basculer: (id: string) => void;
  reglerAvec: (r: Partial<ReglagesRappels>) => void;
  /** « C'est fait » */
  confirmer: (cle: string) => void;
  /** « Plus tard » */
  reporter: (cle: string, minutes: number) => void;
  /** Avance la machine à états ; renvoie les alertes à afficher maintenant. */
  tic: (maintenant?: Date) => { occurrence: Occurrence; relance: boolean }[];
}

export const useRappelsStore = create<RappelsState>((set, get) => {
  const appliquer = (partiel: Partial<DonneesRappels>) => {
    const { rappels, reglages, occurrences, userId } = { ...get(), ...partiel };
    sauver(userId, { rappels, reglages, occurrences });
    set(partiel);
  };

  /** Met une réponse en file d'envoi (seulement si le patient partage ses confirmations). */
  const transmettre = (o: Occurrence) => {
    if (!get().reglages.partage || o.etat === "en_attente") return;
    mettreEnAttente({
      type: "confirmation_rappel",
      payload: {
        clientId: o.cle,
        type: o.type,
        statut: o.etat,
        prevuLe: o.prevuLe,
        reponduLe: o.reponduLe,
        reports: o.reports,
      },
    });
    void synchroniser();
  };

  const majOccurrence = (cle: string, f: (o: Occurrence) => Occurrence) => {
    let modifiee: Occurrence | null = null;
    const occurrences = get().occurrences.map((o) => {
      if (o.cle !== cle) return o;
      modifiee = f(o);
      return modifiee;
    });
    appliquer({ occurrences });
    return modifiee as Occurrence | null;
  };

  return {
    ...VIDE,
    userId: null,

    charger: (userId) => {
      if (userId === get().userId) return;
      set({ ...(userId === null ? VIDE : lire(userId)), userId });
    },

    ajouter: (r) => {
      appliquer({ rappels: [...get().rappels, { ...r, id: nouvelId(), actif: true, depuis: new Date().toISOString() }] });
      journaliser("RAPPEL_CREE");
    },

    modifier: (id, r) => {
      appliquer({ rappels: get().rappels.map((x) => (x.id === id ? { ...x, ...r, depuis: new Date().toISOString() } : x)) });
      journaliser("RAPPEL_MODIFIE");
    },

    supprimer: (id) => {
      appliquer({
        rappels: get().rappels.filter((x) => x.id !== id),
        // Les échéances encore en attente disparaissent avec le rappel
        occurrences: get().occurrences.filter((o) => o.rappelId !== id || o.etat !== "en_attente"),
      });
      journaliser("RAPPEL_SUPPRIME");
    },

    basculer: (id) => {
      const cible = get().rappels.find((x) => x.id === id);
      if (!cible) return;
      appliquer({
        rappels: get().rappels.map((x) => (x.id === id ? { ...x, actif: !x.actif, depuis: new Date().toISOString() } : x)),
      });
      journaliser(cible.actif ? "RAPPEL_DESACTIVE" : "RAPPEL_ACTIVE");
    },

    reglerAvec: (r) => appliquer({ reglages: { ...get().reglages, ...r } }),

    confirmer: (cle) => {
      const o = majOccurrence(cle, (x) => ({ ...x, etat: "confirmee", reponduLe: new Date().toISOString() }));
      if (o) transmettre(o);
    },

    reporter: (cle, minutes) => {
      majOccurrence(cle, (x) => ({
        ...x,
        etat: "en_attente",
        alerteA: new Date(Date.now() + minutes * 60_000).toISOString(),
        notifiee: false,
        relancee: false,
        limiteA: null,
        reports: x.reports + 1,
      }));
    },

    tic: (maintenant = new Date()) => {
      const { rappels, reglages } = get();
      const t = maintenant.getTime();
      const delai = reglages.delaiRelanceMin * 60_000;
      let occurrences = get().occurrences.filter((o) => t - new Date(o.prevuLe).getTime() < CONSERVATION_MS);
      const alertes: { occurrence: Occurrence; relance: boolean }[] = [];
      const aTransmettre: Occurrence[] = [];

      // 1. Crée les échéances du jour arrivées à leur heure
      const jour = maintenant.getDay();
      for (const r of rappels) {
        if (!r.actif || (r.jours.length > 0 && !r.jours.includes(jour))) continue;
        const [h, m] = r.heure.split(":").map(Number);
        const prevu = new Date(maintenant);
        prevu.setHours(h ?? 0, m ?? 0, 0, 0);
        if (prevu.getTime() > t || prevu.getTime() < new Date(r.depuis ?? 0).getTime()) continue;
        const cle = `${r.id}-${prevu.getFullYear()}${String(prevu.getMonth() + 1).padStart(2, "0")}${String(prevu.getDate()).padStart(2, "0")}${r.heure.replace(":", "")}`;
        if (occurrences.some((o) => o.cle === cle)) continue;
        // Application fermée trop longtemps : pas d'alerte tardive ; le patient peut encore
        // répondre dans l'application jusqu'à la fin de la journée, puis c'est « non confirmé »
        const enRetard = t - prevu.getTime() > RETARD_MAX_NOTIF_MS;
        const finDeJournee = new Date(prevu);
        finDeJournee.setHours(23, 59, 59, 0);
        occurrences.push({
          cle,
          rappelId: r.id,
          type: r.type,
          prevuLe: prevu.toISOString(),
          etat: "en_attente",
          alerteA: prevu.toISOString(),
          notifiee: enRetard,
          relancee: enRetard,
          limiteA: enRetard ? finDeJournee.toISOString() : null,
          reports: 0,
          reponduLe: null,
        });
      }

      // 2. Avance chaque échéance en attente : alerte → une relance → non confirmé
      occurrences = occurrences.map((o) => {
        if (o.etat !== "en_attente") return o;
        if (!o.notifiee && t >= new Date(o.alerteA).getTime()) {
          const suivante = { ...o, notifiee: true };
          alertes.push({ occurrence: suivante, relance: false });
          return suivante;
        }
        if (o.notifiee && !o.relancee && t >= new Date(o.alerteA).getTime() + delai) {
          const suivante = { ...o, relancee: true, limiteA: new Date(t + delai).toISOString() };
          alertes.push({ occurrence: suivante, relance: true });
          return suivante;
        }
        if (o.relancee && o.limiteA && t >= new Date(o.limiteA).getTime()) {
          const suivante: Occurrence = { ...o, etat: "non_confirmee" };
          aTransmettre.push(suivante);
          return suivante;
        }
        return o;
      });

      appliquer({ occurrences });
      aTransmettre.forEach(transmettre);
      return alertes;
    },
  };
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Titre neutre : jamais le libellé (il peut être personnel), jamais de mot médical. */
export function titreNotification(reglages: ReglagesRappels): string {
  return reglages.titreNotification.trim() || i18n.t("rappels.notif_titre_defaut");
}

export function notificationsSupportees() {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Bref signal sonore joué dans l'application (aucun fichier audio, aucun nom de piste). */
function bip() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio indisponible */
  }
}

/**
 * Affiche une alerte. Contenu volontairement neutre : titre configurable, corps fixe,
 * aucune mention du libellé. Actions « C'est fait » / « Plus tard » (Android/desktop ;
 * iOS les ignore : l'appui ouvre alors l'application sur la page des rappels).
 */
export async function afficherAlerte(occurrence: Occurrence, reglages: ReglagesRappels) {
  const visible = typeof document !== "undefined" && document.visibilityState === "visible";
  if (reglages.modeSonore !== "silencieux" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.([200, 100, 200]);
  }
  if (visible && reglages.modeSonore === "son_vibration") bip();

  if (!notificationsSupportees() || Notification.permission !== "granted") return;
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean; actions?: { action: string; title: string }[] } = {
    body: i18n.t("rappels.notif_corps"),
    tag: `rappel-${occurrence.cle}`,
    renotify: true,
    // « Vibration seule » et « silencieux » : la notification ne sonne pas
    silent: reglages.modeSonore !== "son_vibration",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { cle: occurrence.cle },
    actions: [
      { action: "fait", title: i18n.t("rappels.action_fait") },
      { action: "plus_tard", title: i18n.t("rappels.action_plus_tard_court") },
    ],
  };
  if (reglages.modeSonore !== "silencieux") options.vibrate = [200, 100, 200];
  const titre = titreNotification(reglages);
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(titre, options);
    } else {
      const { actions: _actions, ...simples } = options;
      new Notification(titre, simples);
    }
  } catch {
    /* plateforme sans prise en charge : l'alerte reste visible dans l'application */
  }
}

// ---------------------------------------------------------------------------
// Plan B : export vers l'agenda du téléphone (.ics)
// Les alarmes d'agenda sonnent hors ligne, application fermée, sur iOS comme sur Android.
// ---------------------------------------------------------------------------

const JOURS_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function echapperIcs(texte: string) {
  return texte.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Fichier iCalendar des rappels actifs, avec le titre neutre (jamais le libellé). */
export function exporterIcs(rappels: Rappel[], reglages: ReglagesRappels): string {
  const titre = echapperIcs(titreNotification(reglages));
  const maintenant = new Date();
  const horodatage = maintenant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = `${maintenant.getFullYear()}${String(maintenant.getMonth() + 1).padStart(2, "0")}${String(maintenant.getDate()).padStart(2, "0")}`;
  const lignes = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//rappels//FR", "CALSCALE:GREGORIAN"];
  for (const r of rappels.filter((x) => x.actif)) {
    const regle = r.jours.length === 0 || r.jours.length === 7
      ? "RRULE:FREQ=DAILY"
      : `RRULE:FREQ=WEEKLY;BYDAY=${[...r.jours].sort().map((j) => JOURS_ICS[j]).join(",")}`;
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@rappels`,
      `DTSTAMP:${horodatage}`,
      // Heure « flottante » : suit le fuseau du téléphone
      `DTSTART:${date}T${r.heure.replace(":", "")}00`,
      "DURATION:PT5M",
      regle,
      `SUMMARY:${titre}`,
      "TRANSP:TRANSPARENT",
      "CLASS:PRIVATE",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${titre}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lignes.push("END:VCALENDAR");
  return lignes.join("\r\n");
}
