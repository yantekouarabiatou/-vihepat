import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

/**
 * Déconnexion automatique après une période d'inactivité (soignants et administrateurs : ils
 * consultent les dossiers de nombreux patients ; les patients ont le verrouillage par code PIN).
 *
 * - Toute interaction (clic, toucher, frappe, défilement, souris) remet le compteur à zéro.
 * - Un avertissement apparaît avant la fin, avec un bouton pour rester connecté.
 * - Le compteur est partagé entre les onglets (localStorage) : un onglet actif garde la session,
 *   et une déconnexion dans un onglet ferme la session dans tous les autres.
 * - Les minuteries étant ralenties en arrière-plan, le délai est revérifié au retour sur l'onglet.
 */

const CLE_ACTIVITE = "vihepat_derniere_activite";
const EVENEMENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove", "wheel"] as const;

function lireDerniereActivite() {
  try {
    return Number(localStorage.getItem(CLE_ACTIVITE)) || Date.now();
  } catch {
    return Date.now();
  }
}

function noterActivite(t = Date.now()) {
  try {
    localStorage.setItem(CLE_ACTIVITE, String(t));
  } catch {
    /* stockage indisponible : le compteur reste local à l'onglet */
  }
}

export function useDeconnexionInactivite({
  actif,
  delaiMs = 5 * 60_000,
  avertissementMs = 60_000,
}: { actif: boolean; delaiMs?: number; avertissementMs?: number }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [secondesRestantes, setSecondesRestantes] = useState<number | null>(null);
  const derniereEcriture = useRef(0);

  const deconnecter = useCallback(() => {
    logout();
    try {
      localStorage.removeItem(CLE_ACTIVITE);
    } catch {
      /* rien */
    }
    navigate("/login?raison=inactivite", { replace: true });
  }, [logout, navigate]);

  const resterConnecte = useCallback(() => {
    noterActivite();
    setSecondesRestantes(null);
  }, []);

  useEffect(() => {
    if (!actif) return;
    noterActivite();

    // Activité : on écrit au plus une fois toutes les 5 s (mousemove est très fréquent)
    const surActivite = () => {
      const maintenant = Date.now();
      if (maintenant - derniereEcriture.current < 5000) return;
      derniereEcriture.current = maintenant;
      // Pendant l'avertissement, seul le bouton « Rester connecté » prolonge la session
      if (Date.now() - lireDerniereActivite() < delaiMs - avertissementMs) noterActivite(maintenant);
    };

    const verifier = () => {
      // Session fermée dans un autre onglet
      if (!localStorage.getItem("vihepat_access_token")) {
        deconnecter();
        return;
      }
      const restant = delaiMs - (Date.now() - lireDerniereActivite());
      if (restant <= 0) deconnecter();
      else if (restant <= avertissementMs) setSecondesRestantes(Math.ceil(restant / 1000));
      else setSecondesRestantes(null);
    };

    for (const e of EVENEMENTS) window.addEventListener(e, surActivite, { passive: true });
    const surVisibilite = () => {
      if (document.visibilityState === "visible") verifier();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    const surStockage = (e: StorageEvent) => {
      if (e.key === CLE_ACTIVITE || e.key === "vihepat_access_token") verifier();
    };
    window.addEventListener("storage", surStockage);
    const id = window.setInterval(verifier, 1000);
    return () => {
      for (const e of EVENEMENTS) window.removeEventListener(e, surActivite);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("storage", surStockage);
      window.clearInterval(id);
    };
  }, [actif, delaiMs, avertissementMs, deconnecter]);

  return { secondesRestantes, resterConnecte, deconnecter };
}
