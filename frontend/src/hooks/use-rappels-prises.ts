import { useCallback, useEffect, useRef, useState } from "react";
import type { PriseDuJour } from "@/api/patient.api";

const CLE_ACTIF = "vihepat_rappels";
const CLE_ENVOYES = "vihepat_rappels_envoyes";

/** Texte volontairement neutre : aucune mention de maladie ni de médicament (discrétion). */
const TITRE = "Petit rappel";
const MESSAGE = "C'est le moment de prendre soin de vous 🌿";

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible (navigation privée) : on continue sans persistance */
  }
}

function heureCourante(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Rappels de prise discrets via l'API Notification du navigateur.
 * Fonctionne tant que l'application est ouverte (onglet ou PWA) ; les notifications
 * push hors application viendront avec le service worker (mode hors ligne).
 */
export function useRappelsPrises(journee: PriseDuJour[] | undefined, date: string | undefined) {
  const supporte = typeof window !== "undefined" && "Notification" in window;
  const [actif, setActif] = useState(() => supporte && lire(CLE_ACTIF) === "1" && Notification.permission === "granted");
  const envoyes = useRef<Set<string>>(new Set());

  // Recharge les rappels déjà envoyés aujourd'hui (évite les doublons après un rafraîchissement)
  useEffect(() => {
    if (!date) return;
    try {
      const brut = JSON.parse(lire(CLE_ENVOYES) ?? "{}") as { date?: string; cles?: string[] };
      envoyes.current = new Set(brut.date === date ? brut.cles ?? [] : []);
    } catch {
      envoyes.current = new Set();
    }
  }, [date]);

  const activer = useCallback(async () => {
    if (!supporte) return false;
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    const ok = permission === "granted";
    setActif(ok);
    ecrire(CLE_ACTIF, ok ? "1" : "0");
    return ok;
  }, [supporte]);

  const desactiver = useCallback(() => {
    setActif(false);
    ecrire(CLE_ACTIF, "0");
  }, []);

  useEffect(() => {
    if (!actif || !journee || !date) return;

    const verifier = () => {
      const maintenant = heureCourante();
      const dues = journee.filter(
        (p) => p.statut === null && p.heure !== null && p.heure <= maintenant && !envoyes.current.has(`${p.traitementId}-${p.rang}`),
      );
      if (dues.length === 0) return;
      for (const p of dues) envoyes.current.add(`${p.traitementId}-${p.rang}`);
      ecrire(CLE_ENVOYES, JSON.stringify({ date, cles: Array.from(envoyes.current) }));
      const options = { body: MESSAGE, silent: true, tag: `rappel-${date}`, icon: "/icons/icon-192.png" };
      // Sur mobile, les notifications passent par le service worker
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        void navigator.serviceWorker.ready.then((r) => r.showNotification(TITRE, options)).catch(() => undefined);
      } else {
        try {
          new Notification(TITRE, options);
        } catch {
          /* navigateur sans prise en charge : ignoré */
        }
      }

    };

    verifier();
    const id = window.setInterval(verifier, 60_000);
    return () => window.clearInterval(id);
  }, [actif, journee, date]);

  return { supporte, actif, activer, desactiver };
}
