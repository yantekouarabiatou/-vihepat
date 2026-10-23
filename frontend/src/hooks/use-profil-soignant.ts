import { useQuery } from "@tanstack/react-query";
import { soignantApi } from "@/api/soignant.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Fonction du soignant connecté. Seul le médecin (ou l'admin) ouvre des dossiers et rattache
 * des soignants à ses patients ; l'API applique la même règle.
 */
export function useProfilSoignant() {
  const role = useAuthStore((s) => s.user?.role);
  const actif = role === "soignant" || role === "admin";
  const { data } = useQuery({
    queryKey: ["soignant", "moi"],
    queryFn: soignantApi.getMonProfil,
    enabled: actif,
    staleTime: 5 * 60_000,
  });
  return {
    fonction: data?.fonction ?? null,
    // En attendant la réponse : l'admin est toujours habilité, sinon on n'affiche rien de trop
    medecin: role === "admin" || (data?.medecin ?? false),
    charge: !!data,
  };
}
