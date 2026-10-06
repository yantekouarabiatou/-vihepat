import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, Check, X, Flame, Loader2, FlaskConical, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { patientApi, type ObservanceResponse, type PriseDuJour, type StatutPrise } from "@/api/patient.api";
import { Button } from "@/components/ui/button";
import { ObservanceBars, formatTaux, libelleEcheance, tauxStyle } from "@/lib/observance";
import { useRappelsPrises } from "@/hooks/use-rappels-prises";
import { estErreurReseau, mettreEnAttente } from "@/lib/offline-queue";
import { Masque } from "@/components/masque";
import { ListenButton } from "@/components/listen-button";

const CLE_OBSERVANCE = ["patient", "observance"] as const;

function IconeMoment({ heure }: { heure: string | null }) {
  const h = heure ? Number(heure.slice(0, 2)) : 12;
  return h >= 6 && h < 18 ? <Sun className="h-5 w-5 text-[hsl(var(--gold))]" /> : <Moon className="h-5 w-5 text-primary" />;
}

export function ObservanceSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: CLE_OBSERVANCE, queryFn: patientApi.getObservance });
  const { data: alertes } = useQuery({ queryKey: ["patient", "alertes-examens"], queryFn: patientApi.getAlertesExamens });
  const rappels = useRappelsPrises(data?.journee, data?.date);

  const { mutate: declarer, isPending, variables } = useMutation({
    mutationFn: async (v: { prise: PriseDuJour; statut: StatutPrise }) => {
      const payload = { traitementId: v.prise.traitementId, rang: v.prise.rang, statut: v.statut, date: data?.date ?? "" };
      try {
        await patientApi.declarerPrise(payload);
        return { horsLigne: false };
      } catch (err) {
        // Sans réseau : la prise est gardée sur l'appareil et envoyée plus tard
        if (estErreurReseau(err) && payload.date) {
          mettreEnAttente({ type: "prise", payload });
          return { horsLigne: true };
        }
        throw err;
      }
    },
    // Mise à jour optimiste : la case se coche instantanément, même sur un réseau lent
    onMutate: async ({ prise, statut }) => {
      await queryClient.cancelQueries({ queryKey: CLE_OBSERVANCE });
      const avant = queryClient.getQueryData<ObservanceResponse>(CLE_OBSERVANCE);
      if (avant) {
        queryClient.setQueryData<ObservanceResponse>(CLE_OBSERVANCE, {
          ...avant,
          journee: avant.journee.map((p) =>
            p.traitementId === prise.traitementId && p.rang === prise.rang ? { ...p, statut } : p,
          ),
        });
      }
      return { avant };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.avant) queryClient.setQueryData(CLE_OBSERVANCE, ctx.avant);
      toast.error(t("observance.toast_save_error"));
    },
    onSuccess: (res, { statut }) => {
      if (res.horsLigne) toast(t("observance.toast_hors_ligne"));
      else if (statut === "prise") toast.success(t("observance.toast_bravo"));
    },
    onSettled: (res) => {
      // Hors ligne, on garde l'affichage optimiste au lieu de recharger depuis le cache
      if (!res?.horsLigne) queryClient.invalidateQueries({ queryKey: CLE_OBSERVANCE });
    },

  });

  if (isLoading || !data) {
    return (
      <div className="mt-8 flex justify-center rounded-3xl bg-card p-10 shadow-[var(--shadow-card)]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const { journee, resume } = data;
  const faites = journee.filter((p) => p.statut === "prise").length;

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Prises du jour */}
      <section className="min-w-0 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">{t("observance.today_title")}</h2>
            <p className="text-sm text-muted-foreground">
              {journee.length === 0 ? t("observance.no_prise") : t("observance.prises_faites", { faites, total: journee.length, count: journee.length })}
            </p>
          </div>
          {rappels.supporte && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-primary"
              onClick={async () => {
                if (rappels.actif) {
                  rappels.desactiver();
                  toast(t("observance.toast_rappels_off"));
                } else if (await rappels.activer()) {
                  toast.success(t("observance.toast_rappels_on"));
                } else {
                  toast.error(t("observance.toast_rappels_error"));
                }
              }}
            >
              {rappels.actif ? <Bell className="mr-1 h-4 w-4" /> : <BellOff className="mr-1 h-4 w-4" />}
              {rappels.actif ? t("observance.rappels_actif") : t("observance.rappels_activer")}
            </Button>
          )}
        </div>

        {journee.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("observance.no_traitement")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {journee.map((p) => {
              const enCours = isPending && variables?.prise.traitementId === p.traitementId && variables.prise.rang === p.rang;
              return (
                <li
                  key={`${p.traitementId}-${p.rang}`}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors sm:gap-4 sm:p-4 ${
                    p.statut === "prise" ? "border-primary/40 bg-secondary/60" : "border-border"
                  }`}
                >
                  <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary sm:flex">
                    <IconeMoment heure={p.heure} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{p.heure ?? t("observance.dans_journee")}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      <Masque>{p.molecule}</Masque>
                      {p.nbParJour > 1 && ` · ${t("observance.prise_rang", { rang: p.rang, total: p.nbParJour })}`}
                    </p>
                  </div>
                  <ListenButton
                    text={`${p.heure ?? t("observance.dans_journee")}. ${p.molecule}. ${t("observance.signaler_oubli_title")}`}
                  />
                  {enCours ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : p.statut === "prise" ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      <Check className="h-3.5 w-3.5" /> {t("observance.pris_badge")}
                    </span>
                  ) : (
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" className="rounded-full" onClick={() => declarer({ prise: p, statut: "prise" })}>
                        <Check className="mr-1 h-4 w-4" /> {t("observance.pris_badge")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`rounded-full ${p.statut === "manquee" ? "text-destructive" : "text-muted-foreground"}`}
                        onClick={() => declarer({ prise: p, statut: "manquee" })}
                        title={t("observance.signaler_oubli_title")}
                      >
                        <X className="h-4 w-4" />
                        {p.statut === "manquee" && <span className="ml-1">{t("observance.oublie_badge")}</span>}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="min-w-0 space-y-6 lg:col-span-2">

        {/* Score */}
        <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold text-foreground">{t("observance.regularite_title")}</h2>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className={`rounded-2xl p-3 ${tauxStyle(resume.taux7)}`}>
              <p className="text-2xl font-extrabold">{formatTaux(resume.taux7)}</p>
              <p className="text-xs font-medium">{t("observance.jours7")}</p>
            </div>
            <div className={`rounded-2xl p-3 ${tauxStyle(resume.taux30)}`}>
              <p className="text-2xl font-extrabold">{formatTaux(resume.taux30)}</p>
              <p className="text-xs font-medium">{t("observance.jours30")}</p>
            </div>
            <div className="rounded-2xl bg-[hsl(var(--accent-soft))] p-3 text-[hsl(var(--accent))]">
              <p className="flex items-center justify-center gap-1 text-2xl font-extrabold">
                <Flame className="h-5 w-5" />
                {resume.serie}
              </p>
              <p className="text-xs font-medium">{t("observance.jours_suite")}</p>
            </div>
          </div>
          <div className="mt-5">
            <ObservanceBars jours={resume.jours} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("observance.footnote")}
          </p>
        </section>

        {/* Examens à prévoir */}
        {alertes && alertes.length > 0 && (
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">{t("observance.examens_title")}</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {alertes.map((a) => (
                <li key={a.type} className="flex items-center justify-between gap-2 rounded-2xl bg-secondary p-4">
                  <span className="text-sm font-medium text-foreground"><Masque>{t(`observations.types.${a.type}`, { defaultValue: a.libelle })}</Masque></span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      a.statut === "en_retard" ? "bg-destructive/15 text-destructive" : "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]"
                    }`}
                  >
                    {libelleEcheance(a, t)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t("observance.examens_footnote")}</p>
          </section>
        )}
      </div>
    </div>
  );
}
