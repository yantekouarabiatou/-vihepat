import i18n from "@/i18n";
import { premiereFois, useCelebration } from "@/components/celebration";
import { useAuthStore } from "@/store/auth.store";
import type { ObservanceResponse, RendezVous, StatutPrise } from "@/api/patient.api";

/**
 * Quand féliciter ou encourager le patient. Ton positif, jamais culpabilisant : un oubli ou un
 * rendez-vous manqué reçoit un encouragement, pas un reproche.
 */

/** Séries de jours sans oubli fêtées */
const ETAPES_SERIE = [3, 7, 14, 21, 30, 60, 90, 180, 365];
/** Un rendez-vous honoré plus ancien n'est plus fêté (première ouverture après une longue absence) */
const RDV_RECENT_MS = 14 * 24 * 60 * 60 * 1000;

const userId = () => useAuthStore.getState().user?.id;
const celebrer = (...a: Parameters<ReturnType<typeof useCelebration.getState>["celebrer"]>) => useCelebration.getState().celebrer(...a);

/** Après une prise déclarée, avec l'observance à jour */
export function apresPrise(statut: StatutPrise, obs: ObservanceResponse | undefined) {
  const t = i18n.t.bind(i18n);
  if (statut === "manquee") {
    celebrer({ genre: "encouragement", grande: false, titre: t("celebration.oubli_titre"), message: t("celebration.oubli_message") });
    return;
  }
  const serie = obs?.resume.serie ?? 0;
  if (ETAPES_SERIE.includes(serie) && premiereFois(userId(), `serie-${serie}-${obs?.date}`)) {
    celebrer({ genre: "serie", grande: true, titre: t("celebration.serie_titre", { count: serie }), message: t("celebration.serie_message", { count: serie }) });
    return;
  }
  const journee = obs?.journee ?? [];
  if (journee.length > 0 && journee.every((p) => p.statut === "prise") && premiereFois(userId(), `journee-${obs?.date}`)) {
    celebrer({ genre: "journee", grande: true, titre: t("celebration.journee_titre"), message: t("celebration.journee_message") });
    return;
  }
  celebrer({ genre: "prise", grande: false, titre: t("celebration.prise_titre"), message: t("celebration.prise_message") });
}

/** « C'est fait » sur un rappel */
export function apresRappel() {
  celebrer({ genre: "prise", grande: false, titre: i18n.t("celebration.prise_titre"), message: i18n.t("celebration.rappel_message") });
}

/** À l'ouverture du tableau de bord : dernier rendez-vous passé, honoré ou manqué */
export function verifierRendezVous(liste: Pick<RendezVous, "id" | "dateHeure" | "statut">[] | undefined) {
  const id = userId();
  if (!liste || !id) return;
  const t = i18n.t.bind(i18n);
  const passes = liste
    .filter((r) => r.statut === "effectue" || r.statut === "manque")
    .sort((a, b) => new Date(b.dateHeure).getTime() - new Date(a.dateHeure).getTime());
  const dernier = passes[0];
  if (!dernier || Date.now() - new Date(dernier.dateHeure).getTime() > RDV_RECENT_MS) return;
  if (!premiereFois(id, `rdv-${dernier.id}-${dernier.statut}`)) return;
  if (dernier.statut === "manque") {
    celebrer({ genre: "encouragement", grande: true, titre: t("celebration.rdv_manque_titre"), message: t("celebration.rdv_manque_message") });
    return;
  }
  let suite = 0;
  for (const r of passes) {
    if (r.statut !== "effectue") break;
    suite++;
  }
  celebrer({
    genre: "rdv",
    grande: true,
    titre: t("celebration.rdv_titre"),
    message: suite >= 2 ? t("celebration.rdv_suite", { count: suite }) : t("celebration.rdv_message"),
  });
}
