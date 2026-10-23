import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Pill, CalendarDays, Plus, Loader2, FlaskConical, Stethoscope, Megaphone, BellRing, Globe,
  CheckCircle2, Hourglass, MessageSquareWarning, Clock, UserRound, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { patientApi, type StatutTraitement, type SynthesePatient } from "@/api/patient.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { ObservanceSection } from "./ObservanceSection";
import { TriageDialog } from "./TriageDialog";
import { Masque } from "@/components/masque";
import { ListenButton } from "@/components/listen-button";
import { localeAffichage } from "@/lib/date-locale";

const SEPT_JOURS_MS = 7 * 24 * 60 * 60 * 1000;

type TraitementListe = SynthesePatient["traitements"]["liste"][number];

/** Part du traitement déjà écoulée (null si pas de date de fin). */
function progression(tr: TraitementListe) {
  if (!tr.dateFin) return null;
  const debut = new Date(tr.dateDebut).getTime();
  const fin = new Date(tr.dateFin).getTime();
  if (fin <= debut) return null;
  return Math.min(100, Math.max(0, Math.round(((Date.now() - debut) / (fin - debut)) * 100)));
}

function Tuile({ icon: Icon, label, valeur, detail, accent }: {
  icon: typeof Pill; label: string; valeur: number | string; detail?: string | undefined; accent: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-3xl font-extrabold leading-none text-foreground">{valeur}</p>
      <p className="mt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-primary">{detail}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = localeAffichage(i18n.resolvedLanguage);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [rdvOpen, setRdvOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [dateHeure, setDateHeure] = useState("");

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const dateCourte = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const { data: synthese, isLoading: syntheseLoading } = useQuery({
    queryKey: ["patient", "synthese"],
    queryFn: patientApi.getSynthese,
  });
  const { data: rendezVous, isLoading: rdvLoading } = useQuery({
    queryKey: ["patient", "rendez-vous"],
    queryFn: patientApi.getRendezVous,
  });
  const { data: observations } = useQuery({
    queryKey: ["patient", "observations"],
    queryFn: patientApi.getObservations,
  });

  const { mutate: requestRdv, isPending: requestingRdv } = useMutation({
    mutationFn: () =>
      patientApi.createRendezVous({ dateHeure, ...(motif ? { motif } : {}) }),
    onSuccess: () => {
      toast.success(t("dashboard_patient.toast_rdv_success"));
      setRdvOpen(false);
      setMotif("");
      setDateHeure("");
      queryClient.invalidateQueries({ queryKey: ["patient", "rendez-vous"] });
      queryClient.invalidateQueries({ queryKey: ["patient", "synthese"] });
    },
    onError: () => toast.error(t("dashboard_patient.toast_rdv_error")),
  });

  const parStatut = useMemo(() => {
    const liste = synthese?.traitements.liste ?? [];
    return {
      en_cours: liste.filter((tr) => tr.statut === "en_cours"),
      a_venir: liste.filter((tr) => tr.statut === "a_venir"),
      termine: liste.filter((tr) => tr.statut === "termine"),
    } satisfies Record<StatutTraitement, TraitementListe[]>;
  }, [synthese]);

  const tr = synthese?.traitements;
  const communiques = synthese?.communiques.liste ?? [];
  const prochain = synthese?.rendezVous.prochain;

  return (
    <AppShell title={t("app_shell.patient_space")}>
      {/* ===== En-tête ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              {t("dashboard_patient.greeting", { prenom: user?.prenom })}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("dashboard_patient.code_patient")}
              <span className="font-semibold text-foreground">
                {user?.patient?.codePatient ?? "-"}
              </span>
              {" · "}
              <Masque>
                {user?.patient?.pathologie
                  ? t(`shared.pathologie.${user.patient.pathologie}`)
                  : ""}
              </Masque>
            </p>
          </div>
          <ListenButton
            className="mt-1"
            text={[
              t("dashboard_patient.greeting", { prenom: user?.prenom }),
              `${t("dashboard_patient.kpi_en_cours")} : ${tr?.enCours ?? 0}.`,
              `${t("dashboard_patient.kpi_termines")} : ${tr?.termines ?? 0}.`,
              `${t("dashboard_patient.kpi_rdv")} : ${synthese?.rendezVous.aVenir ?? 0}.`,
              `${t("dashboard_patient.kpi_communiques")} : ${synthese?.communiques.total ?? 0}.`,
            ].join(" ")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/">
            <Button
              variant="outline"
              className="h-12 rounded-full px-5 gap-2 border-border/80 font-semibold shadow-xs hover:bg-secondary"
            >
              <Globe className="h-4 w-4 text-primary" />
              <span>{t("app_shell.site_public")}</span>
            </Button>
          </Link>
          <Button
            className="h-12 rounded-full px-6 font-semibold shadow-xs"
            onClick={() => setTriageOpen(true)}
          >
            <Stethoscope className="mr-2 h-5 w-5" />
            {t("dashboard_patient.signaler_symptome")}
          </Button>
        </div>
      </div>

      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />

      {/* ===== Indicateurs ===== */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Tuile
          icon={Pill}
          label={t("dashboard_patient.kpi_en_cours")}
          valeur={syntheseLoading ? "…" : tr?.enCours ?? 0}
          accent="bg-primary/10 text-primary"
        />
        <Tuile
          icon={Hourglass}
          label={t("dashboard_patient.kpi_a_venir")}
          valeur={syntheseLoading ? "…" : tr?.aVenir ?? 0}
          accent="bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold))]"
        />
        <Tuile
          icon={CheckCircle2}
          label={t("dashboard_patient.kpi_termines")}
          valeur={syntheseLoading ? "…" : tr?.termines ?? 0}
          accent="bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]"
        />
        <Tuile
          icon={CalendarDays}
          label={t("dashboard_patient.kpi_rdv")}
          valeur={syntheseLoading ? "…" : synthese?.rendezVous.aVenir ?? 0}
          accent="bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]"
        />
        <Tuile
          icon={Megaphone}
          label={t("dashboard_patient.kpi_communiques")}
          valeur={syntheseLoading ? "…" : synthese?.communiques.total ?? 0}
          detail={
            synthese && synthese.communiques.recents > 0
              ? t("dashboard_patient.kpi_communiques_nouveaux", { count: synthese.communiques.recents })
              : undefined
          }
          accent="bg-[hsl(var(--violet)/0.12)] text-[hsl(var(--violet))]"
        />
        <Tuile
          icon={MessageSquareWarning}
          label={t("dashboard_patient.kpi_signalements")}
          valeur={syntheseLoading ? "…" : synthese?.signalements.enAttente ?? 0}
          accent="bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]"
        />
      </div>

      {/* ===== Prochain rendez-vous ===== */}
      {prochain && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-3xl bg-[linear-gradient(135deg,hsl(var(--brand))_0%,hsl(var(--brand-deep))_100%)] p-5 text-white shadow-[var(--shadow-soft)]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              {t("dashboard_patient.prochain_rdv")}
            </p>
            <p className="mt-0.5 text-lg font-bold first-letter:uppercase">{formatDate(prochain.dateHeure)}</p>
            <p className="text-sm text-white/80">{prochain.motif || t("shared.consultation")}</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {t(`shared.statut_rdv.${prochain.statut}`)}
          </span>
        </div>
      )}

      <ObservanceSection />

      {/* ===== Corps ===== */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Traitements */}
        <section className="min-w-0 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-3">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{t("dashboard_patient.mes_traitements")}</h2>
          </div>
          {syntheseLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !tr || tr.total === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("dashboard_patient.traitements_empty")}
            </p>
          ) : (
            <Tabs defaultValue="en_cours" className="mt-4">
              <TabsList className="grid w-full grid-cols-3 rounded-full">
                {(["en_cours", "a_venir", "termine"] as const).map((s) => (
                  <TabsTrigger key={s} value={s} className="rounded-full text-xs sm:text-sm">
                    {t(`dashboard_patient.onglet_${s}`)}
                    <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[11px] font-bold text-primary">
                      {parStatut[s].length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {(["en_cours", "a_venir", "termine"] as const).map((s) => (
                <TabsContent key={s} value={s}>
                  {parStatut[s].length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t(`dashboard_patient.onglet_vide_${s}`)}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {parStatut[s].map((tr2) => {
                        const pct = s === "en_cours" ? progression(tr2) : null;
                        return (
                          <li
                            key={tr2.id}
                            className={cn(
                              "rounded-2xl border-2 p-4",
                              s === "termine" ? "border-dashed border-border opacity-75" : "border-border",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 break-words font-semibold text-foreground">
                                <Masque>{tr2.molecule}</Masque>
                              </p>
                              {tr2.heurePrise && s !== "termine" && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                                  <Clock className="h-3 w-3" />
                                  {tr2.heurePrise}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {tr2.dosage && (
                                <>
                                  <Masque>{tr2.dosage}</Masque> ·{" "}
                                </>
                              )}
                              {tr2.frequence}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>
                                {s === "a_venir"
                                  ? t("dashboard_patient.commence_le", { date: dateCourte(tr2.dateDebut) })
                                  : tr2.dateFin
                                    ? t("dashboard_patient.periode", { debut: dateCourte(tr2.dateDebut), fin: dateCourte(tr2.dateFin) })
                                    : t("dashboard_patient.depuis", { date: dateCourte(tr2.dateDebut) })}
                              </span>
                              {tr2.prescripteur && (
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="h-3 w-3" />
                                  {t("equipe.prescrit_par", {
                                    nom: `${tr2.prescripteur.user.prenom} ${tr2.prescripteur.user.nom}`,
                                    fonction: t(`fonction.${tr2.prescripteur.fonction}`),
                                  })}
                                </span>
                              )}
                            </div>
                            {pct !== null && (
                              <div className="mt-3">
                                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                                  {t("dashboard_patient.progression", { pct })}
                                </p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Communiqués */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {t("dashboard_patient.communiques_title")}
              </h2>
            </div>
            {communiques.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("dashboard_patient.communiques_empty")}
              </p>
            ) : (
              <ul className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {communiques.map((c) => {
                  const nouveau = Date.now() - new Date(c.createdAt).getTime() < SEPT_JOURS_MS;
                  return (
                    <li key={c.id} className="rounded-2xl bg-secondary p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-semibold text-foreground">{c.titre}</p>
                        <div className="flex shrink-0 gap-1">
                          {c.cible === "patient" && (
                            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {t("dashboard_patient.communique_perso")}
                            </span>
                          )}
                          {nouveau && (
                            <span className="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[11px] font-bold text-white">
                              {t("dashboard_patient.nouveau_badge")}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{c.contenu}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {c.auteur ? `${c.auteur.user.prenom} ${c.auteur.user.nom} · ` : ""}
                        {dateCourte(c.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Rendez-vous */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {t("dashboard_patient.rdv_title")}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-primary"
                onClick={() => setRdvOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("dashboard_patient.rdv_demander")}
              </Button>
            </div>
            {rdvLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !rendezVous || rendezVous.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("dashboard_patient.rdv_empty")}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rendezVous.map((rdv) => (
                  <li key={rdv.id} className="rounded-2xl bg-secondary p-4">
                    <p className="font-semibold text-foreground">
                      {rdv.motif || t("shared.consultation")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(rdv.dateHeure)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-block rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                        {t(`shared.statut_rdv.${rdv.statut}`)}
                      </span>
                      {rdv.rappelEnvoyeLe && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-[hsl(var(--gold))]">
                          <BellRing className="h-3 w-3" />
                          {t("dashboard_patient.rdv_rappel")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Observations */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {t("dashboard_patient.observations_title")}
              </h2>
            </div>
            {!observations || observations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("dashboard_patient.observations_empty")}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {observations.map((obs) => (
                  <li
                    key={obs.id}
                    className="flex items-center justify-between rounded-2xl bg-secondary p-4"
                  >
                    <span className="text-sm font-medium text-foreground">
                      <Masque>
                        {t(`observations.types.${obs.type}`, {
                          defaultValue: obs.type,
                        })}
                      </Masque>
                    </span>
                    <span className="text-sm font-bold text-primary">
                      <Masque>
                        {obs.valeur} {obs.unite}
                      </Masque>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* ===== Dialog RDV ===== */}
      <Dialog open={rdvOpen} onOpenChange={setRdvOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard_patient.rdv_dialog_title")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestRdv();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="dateHeure">
                {t("dashboard_patient.rdv_dialog_date")}
              </Label>
              <Input
                id="dateHeure"
                type="datetime-local"
                value={dateHeure}
                onChange={(e) => setDateHeure(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motif">
                {t("dashboard_patient.rdv_dialog_motif")}
              </Label>
              <Input
                id="motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={t("dashboard_patient.rdv_dialog_motif_placeholder")}
                className="h-11 rounded-xl"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={requestingRdv}
                className="w-full rounded-full"
              >
                {requestingRdv && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("dashboard_patient.rdv_dialog_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
