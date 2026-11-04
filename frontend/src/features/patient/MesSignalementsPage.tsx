import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronDown, Loader2, MessageSquareText } from "lucide-react";
import { patientApi, type Gravite, type StatutSignalement } from "@/api/patient.api";
import { AppShell } from "@/components/app-shell";
import { FilReponses } from "@/components/fil-reponses";
import { localeAffichage } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

/**
 * Signalements du patient et échanges avec l'équipe soignante (réponses écrites ou vocales).
 * Un signalement avec une réponse non lue s'ouvre en premier.
 */

const STYLE_GRAVITE: Record<Gravite, string> = {
  leger: "bg-secondary text-primary",
  modere: "bg-[hsl(var(--gold)/0.2)] text-foreground",
  severe: "bg-destructive/15 text-destructive",
};
const STYLE_STATUT: Record<StatutSignalement, string> = {
  nouveau: "bg-secondary text-muted-foreground",
  vu: "bg-primary/10 text-primary",
  traite: "bg-primary text-primary-foreground",
};

export function MesSignalementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["patient", "signalements"], queryFn: patientApi.getSignalements });
  const [ouvert, setOuvert] = useState<number | null>(null);
  const premierNonLu = data?.find((s) => (s.nonLus ?? 0) > 0)?.id ?? null;
  const actif = ouvert ?? premierNonLu;

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["patient", "signalements"] });
    queryClient.invalidateQueries({ queryKey: ["patient", "synthese"] });
  };

  return (
    <AppShell title={t("mes_signalements.titre")}>
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t("mes_signalements.retour")}
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{t("mes_signalements.titre")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("mes_signalements.sous_titre")}</p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center rounded-3xl bg-card p-10 shadow-[var(--shadow-card)]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-3xl bg-card p-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">{t("mes_signalements.vide")}</div>
        ) : (
          data.map((s) => {
            const estOuvert = actif === s.id;
            return (
              <div key={s.id} className="rounded-3xl bg-card shadow-[var(--shadow-card)]">
                <button
                  type="button"
                  onClick={() => {
                    setOuvert(estOuvert ? -1 : s.id);
                    if ((s.nonLus ?? 0) > 0) setTimeout(rafraichir, 800);
                  }}
                  aria-expanded={estOuvert}
                  className="flex w-full items-start gap-3 p-4 text-left sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STYLE_GRAVITE[s.gravite])}>{t(`shared.gravite.${s.gravite}`)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STYLE_STATUT[s.statut])}>{t(`mes_signalements.statut_${s.statut}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString(localeAffichage(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1.5 font-semibold text-foreground">{s.symptome}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                      {(s.nonLus ?? 0) > 0 ? (
                        <span className="font-semibold text-primary">{t("mes_signalements.nouvelles_reponses", { count: s.nonLus })}</span>
                      ) : (
                        t("mes_signalements.messages", { count: s.messages ?? 0 })
                      )}
                    </p>
                  </div>
                  <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", estOuvert && "rotate-180")} />
                </button>
                {estOuvert && (
                  <div className="border-t border-border/60 p-4 sm:p-5">
                    <FilReponses
                      cle={["patient", "signalement-reponses", s.id]}
                      moi="patient"
                      charger={() => patientApi.getReponsesSignalement(s.id)}
                      envoyer={async (r) => {
                        const res = await patientApi.repondreSignalement(s.id, r);
                        rafraichir();
                        return res;
                      }}
                      chargerAudio={patientApi.audioReponse}
                      placeholder={t("mes_signalements.placeholder")}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("mes_signalements.urgence")}</p>
    </AppShell>
  );
}
