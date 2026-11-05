import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BellRing, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type SoignantRendezVous } from "@/api/soignant.api";
import type { StatutRDV } from "@/api/patient.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { apiErrorMessage } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";
import { PlanifierRdvDialog } from "./PlanifierRdvDialog";
import { BadgeRisquePerteSuivi } from "./RisquePerteSuivi";

/**
 * Agenda des rendez-vous sur une semaine ou un mois : suivi des statuts et des rappels envoyés
 * aux patients, planification en série, et liste des patients sans rendez-vous à venir.
 */

type Vue = "semaine" | "mois";
const STATUTS: StatutRDV[] = ["prevu", "confirme", "effectue", "manque", "annule"];
const STYLE_STATUT: Record<StatutRDV, string> = {
  prevu: "bg-secondary text-primary",
  confirme: "bg-primary/10 text-primary",
  effectue: "bg-primary text-primary-foreground",
  manque: "bg-destructive/15 text-destructive",
  annule: "bg-muted text-muted-foreground line-through",
};

function bornes(vue: Vue, reference: Date) {
  const du = new Date(reference);
  du.setHours(0, 0, 0, 0);
  if (vue === "semaine") {
    // Semaine du lundi au dimanche
    du.setDate(du.getDate() - ((du.getDay() + 6) % 7));
    const au = new Date(du);
    au.setDate(au.getDate() + 7);
    return { du, au };
  }
  du.setDate(1);
  const au = new Date(du);
  au.setMonth(au.getMonth() + 1);
  return { du, au };
}

export function AgendaPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [vue, setVue] = useState<Vue>("semaine");
  const [reference, setReference] = useState(() => new Date());
  const [planifierOpen, setPlanifierOpen] = useState(false);
  const [patientInitial, setPatientInitial] = useState<number | null>(null);
  const { du, au } = useMemo(() => bornes(vue, reference), [vue, reference]);

  const { data, isLoading } = useQuery({
    queryKey: ["soignant", "agenda", du.toISOString(), au.toISOString()],
    queryFn: () => soignantApi.getAgenda(du, au),
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["soignant", "agenda"] });
    queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
  };

  const { mutate: changerStatut } = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: StatutRDV }) => soignantApi.updateRendezVous(id, { statut }),
    onSuccess: () => {
      toast.success(t("agenda.toast_statut"));
      rafraichir();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("agenda.erreur"))),
  });

  const { mutate: rappeler, isPending: rappelEnCours, variables: rappelId } = useMutation({
    mutationFn: (id: number) => soignantApi.envoyerRappelRdv(id),
    onSuccess: (r) => {
      if (r.email || r.notification > 0) {
        toast.success(t("agenda.toast_rappel", { canaux: [r.email ? t("agenda.canal_email") : null, r.notification > 0 ? t("agenda.canal_notification") : null].filter(Boolean).join(" + ") }));
      } else {
        toast.warning(t("agenda.toast_rappel_aucun"));
      }
      rafraichir();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("agenda.erreur"))),
  });

  const { mutate: changerAuto } = useMutation({
    mutationFn: ({ id, actif }: { id: number; actif: boolean }) => soignantApi.changerRappelAuto(id, actif),
    onSuccess: rafraichir,
    onError: (err) => toast.error(apiErrorMessage(err, t("agenda.erreur"))),
  });

  const parJour = useMemo(() => {
    const groupes = new Map<string, SoignantRendezVous[]>();
    for (const r of data?.rendezVous ?? []) {
      const d = new Date(r.dateHeure);
      const cle = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      groupes.set(cle, [...(groupes.get(cle) ?? []), r]);
    }
    return [...groupes.values()];
  }, [data]);

  const liste = data?.rendezVous ?? [];
  const chiffres = {
    total: liste.filter((r) => r.statut !== "annule").length,
    confirmes: liste.filter((r) => r.statut === "confirme" || r.statut === "effectue").length,
    rappels: liste.filter((r) => r.rappelEnvoyeLe).length,
    manques: liste.filter((r) => r.statut === "manque").length,
  };

  const deplacer = (sens: number) => {
    const d = new Date(reference);
    if (vue === "semaine") d.setDate(d.getDate() + 7 * sens);
    else d.setMonth(d.getMonth() + sens);
    setReference(d);
  };
  const libellePeriode =
    vue === "mois"
      ? du.toLocaleDateString(localeAffichage(), { month: "long", year: "numeric" })
      : `${du.toLocaleDateString(localeAffichage(), { day: "numeric", month: "short" })} – ${new Date(au.getTime() - 1).toLocaleDateString(localeAffichage(), { day: "numeric", month: "short", year: "numeric" })}`;
  const heure = (iso: string) => new Date(iso).toLocaleTimeString(localeAffichage(), { hour: "2-digit", minute: "2-digit" });
  const passe = (iso: string) => new Date(iso).getTime() < Date.now();

  const ouvrirPlanification = (patientId: number | null) => {
    setPatientInitial(patientId);
    setPlanifierOpen(true);
  };

  return (
    <AppShell title={t("sidebar.role_soignant")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("agenda.titre")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("agenda.sous_titre")}</p>
        </div>
        <Button className="h-11 rounded-full" onClick={() => ouvrirPlanification(null)}>
          <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" /> {t("agenda.planifier")}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-secondary p-1">
          {(["semaine", "mois"] as Vue[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVue(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${vue === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {t(`agenda.vue_${v}`)}
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => deplacer(-1)} aria-label={t("agenda.precedent")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => setReference(new Date())}>
          {t("agenda.aujourdhui")}
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => deplacer(1)} aria-label={t("agenda.suivant")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <p className="ml-1 text-sm font-semibold capitalize text-foreground">{libellePeriode}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["total", chiffres.total],
            ["confirmes", chiffres.confirmes],
            ["rappels", chiffres.rappels],
            ["manques", chiffres.manques],
          ] as const
        ).map(([cle, valeur]) => (
          <div key={cle} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="text-2xl font-extrabold text-foreground">{valeur}</p>
            <p className="text-xs text-muted-foreground">{t(`agenda.chiffre_${cle}`)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 space-y-4 lg:col-span-2">
          {isLoading ? (
            <div className="flex justify-center rounded-3xl bg-card p-10 shadow-[var(--shadow-card)]">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : parJour.length === 0 ? (
            <div className="rounded-3xl bg-card p-10 text-center shadow-[var(--shadow-card)]">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">{t("agenda.vide")}</p>
            </div>
          ) : (
            parJour.map((jour) => (
              <div key={jour[0]!.id} className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
                <h2 className="text-sm font-bold capitalize text-foreground">
                  {new Date(jour[0]!.dateHeure).toLocaleDateString(localeAffichage(), { weekday: "long", day: "numeric", month: "long" })}
                  <span className="ml-2 font-normal text-muted-foreground">{t("agenda.nb_rdv", { count: jour.length })}</span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {jour.map((r) => (
                    <li key={r.id} className="rounded-2xl bg-secondary/60 p-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-bold tabular-nums text-foreground">{heure(r.dateHeure)}</span>
                        <Link to={`/soignant/patients/${r.patient.id}`} className="text-sm font-semibold text-primary">
                          {r.patient.user.prenom} {r.patient.user.nom}
                        </Link>
                        <span className="text-xs text-muted-foreground">{r.patient.codePatient}</span>
                        <BadgeRisquePerteSuivi risque={data?.risques[r.patient.id]} />
                        {r.motif && <span className="text-xs text-muted-foreground">· {r.motif}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SimpleSelect
                          value={r.statut}
                          ariaLabel={t("agenda.statut")}
                          onChange={(v) => changerStatut({ id: r.id, statut: v as StatutRDV })}
                          className={`h-8 w-auto gap-1.5 rounded-full border-0 px-3 text-xs font-semibold ${STYLE_STATUT[r.statut]}`}
                          options={STATUTS.map((s) => ({ value: s, label: t(`shared.statut_rdv.${s}`, { defaultValue: s }) }))}
                        />
                        {r.rappelEnvoyeLe ? (
                          <span className="flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                            {t("agenda.rappel_envoye_le", {
                              date: new Date(r.rappelEnvoyeLe).toLocaleString(localeAffichage(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
                            })}
                          </span>
                        ) : (
                          !passe(r.dateHeure) &&
                          r.statut !== "annule" && (
                            <label className="flex items-center gap-2 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                              <Switch
                                checked={r.rappelAuto !== false}
                                onCheckedChange={(v) => changerAuto({ id: r.id, actif: v })}
                                aria-label={t("agenda.rappel_auto")}
                                className="scale-75"
                              />
                              {t("agenda.rappel_veille")}
                            </label>
                          )
                        )}
                        {!passe(r.dateHeure) && r.statut !== "annule" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-full text-primary"
                            disabled={rappelEnCours && rappelId === r.id}
                            onClick={() => rappeler(r.id)}
                          >
                            {rappelEnCours && rappelId === r.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <BellRing className="mr-1 h-3.5 w-3.5" />}
                            {t(r.rappelEnvoyeLe ? "agenda.rappeler_encore" : "agenda.rappeler")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <UserX className="h-4 w-4 text-[hsl(var(--gold))]" aria-hidden="true" /> {t("agenda.sans_rdv_titre")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("agenda.sans_rdv_aide")}</p>
            {(data?.sansRendezVous.filter((p) => p.risquePerteSuivi?.niveau === "eleve").length ?? 0) > 0 && (
              <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {t("agenda.sans_rdv_risque", { count: data!.sansRendezVous.filter((p) => p.risquePerteSuivi?.niveau === "eleve").length })}
              </p>
            )}
            {(data?.sansRendezVous.length ?? 0) === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t("agenda.sans_rdv_aucun")}</p>
            ) : (
              <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
                {data!.sansRendezVous.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                    <Link to={`/soignant/patients/${p.id}`} className="min-w-0 text-sm">
                      <span className="block truncate font-semibold text-foreground">{p.prenom} {p.nom}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.codePatient} · {t(`shared.pathologie.${p.pathologie}`, { defaultValue: p.pathologie })}
                      </span>
                      <BadgeRisquePerteSuivi risque={p.risquePerteSuivi} className="mt-0.5" />
                    </Link>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full" onClick={() => ouvrirPlanification(p.id)}>
                      {t("agenda.planifier_court")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl bg-card p-5 text-xs text-muted-foreground shadow-[var(--shadow-card)]">
            <p className="font-semibold text-foreground">{t("agenda.rappels_comment_titre")}</p>
            <p className="mt-1">{t("agenda.rappels_comment")}</p>
          </div>
        </aside>
      </div>

      <PlanifierRdvDialog open={planifierOpen} onOpenChange={setPlanifierOpen} patientInitial={patientInitial} />
    </AppShell>
  );
}
