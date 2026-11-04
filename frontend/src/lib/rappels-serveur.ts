import i18n from "@/i18n";
import { api } from "@/api/client";
import { titreNotification, useRappelsStore } from "@/lib/rappels";

/**
 * Rappels envoyés par le serveur, pour qu'ils sonnent application fermée et patient déconnecté.
 * Option activée par le patient : le serveur reçoit alors l'heure, les jours et le type de chaque
 * rappel, jamais le libellé. Sans cette option, tout reste sur l'appareil (voir rappels.ts).
 */

export function pushSupporte() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone / iPad hors application installée : Safari n'y autorise pas les notifications */
export function iosNonInstalle() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installe = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  return ios && !installe;
}

function cleVersOctets(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const versB64 = (o: Uint8Array) => btoa(String.fromCharCode(...o));

function contenu() {
  const { rappels, reglages } = useRappelsStore.getState();
  return {
    textes: {
      titre: titreNotification(reglages).slice(0, 60),
      corps: i18n.t("rappels.notif_corps"),
      fait: i18n.t("rappels.action_fait"),
      plusTard: i18n.t("rappels.action_plus_tard_court"),
    },
    apiBase: new URL(api.defaults.baseURL ?? "/api", window.location.origin).toString().replace(/\/$/, ""),
    decalageMin: new Date().getTimezoneOffset(),
    delaiRelanceMin: reglages.delaiRelanceMin,
    rappels: rappels.map(({ id, type, heure, jours, actif, depuis }) => ({ id, type, heure, jours, actif, depuis })),
  };
}

/** Active l'envoi par le serveur pour cet appareil (demande l'autorisation des notifications) */
export async function activerRappelsServeur() {
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
    throw new Error("permission");
  }
  const reg = await navigator.serviceWorker.ready;
  const { clePublique } = (await api.get<{ clePublique: string }>("/push/cle-publique")).data;
  let abonnement = await reg.pushManager.getSubscription();
  // Abonnement créé avec une autre clé (serveur réinstallé) : on le renouvelle
  const cleActuelle = abonnement?.options.applicationServerKey;
  if (abonnement && cleActuelle && versB64(new Uint8Array(cleActuelle)) !== versB64(cleVersOctets(clePublique))) {
    await abonnement.unsubscribe();
    abonnement = null;
  }
  abonnement ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVersOctets(clePublique) });
  await api.put("/patients/me/rappels-serveur", { abonnement: abonnement.toJSON(), ...contenu() });
  useRappelsStore.getState().reglerAvec({ serveur: true });
}

export async function desactiverRappelsServeur() {
  const reg = pushSupporte() ? await navigator.serviceWorker.ready : null;
  const abonnement = await reg?.pushManager.getSubscription();
  await api.delete("/patients/me/rappels-serveur", { data: { endpoint: abonnement?.endpoint } });
  await abonnement?.unsubscribe();
  useRappelsStore.getState().reglerAvec({ serveur: false });
}

let minuterie: number | undefined;

/** Après chaque modification des rappels : la copie du serveur est mise à jour (regroupé sur 2 s) */
export function planifierSynchroServeur() {
  window.clearTimeout(minuterie);
  minuterie = window.setTimeout(() => {
    if (!useRappelsStore.getState().reglages.serveur) return;
    // Hors ligne : la prochaine modification ou ouverture de l'application refera l'envoi
    api.put("/patients/me/rappels-serveur", contenu()).catch(() => undefined);
  }, 2000);
}

/** « C'est fait » dans l'application : le serveur n'envoie pas de relance pour cette échéance */
export function signalerReponseServeur(cle: string) {
  if (!useRappelsStore.getState().reglages.serveur) return;
  api.post("/patients/me/rappels-serveur/reponses", { cle }).catch(() => undefined);
}

/** Réponses données depuis les notifications (application fermée) : reportées dans l'historique */
export async function recupererReponsesServeur() {
  if (!useRappelsStore.getState().reglages.serveur) return;
  try {
    const { cles } = (await api.get<{ cles: string[] }>("/patients/me/rappels-serveur/reponses")).data;
    // Crée d'abord les échéances du jour, puis confirme celles déjà réglées depuis une notification
    useRappelsStore.getState().tic();
    for (const cle of cles) {
      const store = useRappelsStore.getState();
      if (store.occurrences.some((o) => o.cle === cle && o.etat !== "confirmee")) store.confirmer(cle);
    }
  } catch {
    /* hors ligne : sans conséquence */
  }
}
