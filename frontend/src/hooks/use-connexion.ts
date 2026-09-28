import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { abonnerFileAttente, nombreEnAttente, synchroniser } from "@/lib/offline-queue";

/** État du réseau + nombre de saisies en attente, avec synchronisation automatique. */
export function useConnexion() {
  const queryClient = useQueryClient();
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [enAttente, setEnAttente] = useState(nombreEnAttente);

  useEffect(() => abonnerFileAttente(setEnAttente), []);

  useEffect(() => {
    const lancer = async () => {
      const n = await synchroniser();
      if (n > 0) {
        toast.success(n > 1 ? `${n} saisies envoyées à votre équipe` : "Saisie envoyée à votre équipe");
        queryClient.invalidateQueries({ queryKey: ["patient"] });
      }
    };
    const surEnLigne = () => {
      setEnLigne(true);
      void lancer();
    };
    const surHorsLigne = () => setEnLigne(false);
    window.addEventListener("online", surEnLigne);
    window.addEventListener("offline", surHorsLigne);
    void lancer();
    // Filet de sécurité : l'événement « online » n'est pas fiable sur tous les téléphones
    const id = window.setInterval(() => void lancer(), 30_000);
    return () => {
      window.removeEventListener("online", surEnLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.clearInterval(id);
    };
  }, [queryClient]);

  return { enLigne, enAttente };
}

/** État du réseau seul (sans synchronisation), pour les composants qui l'affichent. */
export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return enLigne;
}
