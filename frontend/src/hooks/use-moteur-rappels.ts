import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { afficherAlerte, REPORTS_MINUTES, useRappelsStore } from "@/lib/rappels";

/** Fréquence de vérification des échéances (l'horloge tourne même sans réseau). */
const PERIODE_MS = 20_000;

/**
 * Moteur des rappels du patient, monté dans la coquille de l'application (y compris
 * écran verrouillé : une alerte ne révèle rien, et « C'est fait » ne demande pas le code).
 * - vérifie les échéances toutes les 20 s et au retour au premier plan ;
 * - traite les actions venues des notifications (message du service worker ou lien d'ouverture).
 */
export function useMoteurRappels(userId: number | null) {
  const navigate = useNavigate();
  const charger = useRappelsStore((s) => s.charger);

  useEffect(() => {
    charger(userId);
  }, [charger, userId]);

  useEffect(() => {
    if (userId === null) return;

    const verifier = () => {
      const store = useRappelsStore.getState();
      for (const { occurrence } of store.tic()) void afficherAlerte(occurrence, store.reglages);
    };

    const traiterAction = (cle: string | null, action: string | null) => {
      if (!cle || !action) return;
      const store = useRappelsStore.getState();
      if (!store.occurrences.some((o) => o.cle === cle)) return;
      if (action === "fait") store.confirmer(cle);
      else if (action === "plus_tard") store.reporter(cle, REPORTS_MINUTES[0]);
    };

    // Actions transmises par le service worker quand l'application est ouverte
    const surMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; cle?: string; action?: string } | null;
      if (d?.type !== "rappel-action") return;
      if (d.action === "ouvrir") navigate("/rappels");
      else traiterAction(d.cle ?? null, d.action ?? null);
    };
    navigator.serviceWorker?.addEventListener("message", surMessage);

    // Application ouverte depuis une notification : /rappels?occ=…&action=…
    const params = new URLSearchParams(window.location.search);
    if (params.has("occ")) {
      traiterAction(params.get("occ"), params.get("action"));
      params.delete("occ");
      params.delete("action");
      const reste = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${reste ? `?${reste}` : ""}`);
    }

    const surVisibilite = () => {
      if (document.visibilityState === "visible") verifier();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    verifier();
    const id = window.setInterval(verifier, PERIODE_MS);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", surVisibilite);
      navigator.serviceWorker?.removeEventListener("message", surMessage);
    };
  }, [userId, navigate]);
}
