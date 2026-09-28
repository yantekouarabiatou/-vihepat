import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Pill, CalendarDays, AlertCircle, Plus, Loader2,
  FlaskConical, Stethoscope, Megaphone, BellRing, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { patientApi } from "@/api/patient.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

import { ObservanceSection } from "./ObservanceSection";
import { TriageDialog } from "./TriageDialog";
import { Masque } from "@/components/masque";
import { ListenButton } from "@/components/listen-button";

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [rdvOpen, setRdvOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [dateHeure, setDateHeure] = useState("");

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const { data: rendezVous, isLoading: rdvLoading } = useQuery({
    queryKey: ["patient", "rendez-vous"],
    queryFn: patientApi.getRendezVous,
  });
  const { data: traitements, isLoading: traitementsLoading } = useQuery({
    queryKey: ["patient", "traitements"],
    queryFn: patientApi.getTraitements,
  });
  const { data: observations } = useQuery({
    queryKey: ["patient", "observations"],
    queryFn: patientApi.getObservations,
  });
  const { data: signalements } = useQuery({
    queryKey: ["patient", "signalements"],
    queryFn: patientApi.getSignalements,
  });
  const { data: communiques } = useQuery({
    queryKey: ["patient", "communiques"],
    queryFn: patientApi.getCommuniques,
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
    },
    onError: () => toast.error(t("dashboard_patient.toast_rdv_error")),
  });

  const dernierSignalement = signalements?.[0];

  return (
    <AppShell title="Espace patient">
      {/* ===== Header ===== */}
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
              `${t("dashboard_patient.stat_traitements")} : ${traitements?.length ?? 0}.`,
              `${t("dashboard_patient.stat_rdv")} : ${rendezVous?.length ?? 0}.`,
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
              <span>Site public</span>
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

      {/* ===== Stats ===== */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {t("dashboard_patient.stat_traitements")}
            </span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">
            {traitements?.length ?? 0}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {t("dashboard_patient.stat_rdv")}
            </span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">
            {rendezVous?.length ?? 0}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {t("dashboard_patient.stat_dernier_signalement")}
            </span>
          </div>
          <p className="mt-4 text-lg font-bold text-foreground">
            {dernierSignalement
              ? t(`shared.gravite.${dernierSignalement.gravite}`)
              : t("shared.aucun")}
          </p>
        </div>
      </div>

      <ObservanceSection />

      {/* ===== Corps ===== */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Traitements */}
        <section className="min-w-0 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-3">
          <h2 className="text-lg font-bold text-foreground">
            {t("dashboard_patient.traitements_title")}
          </h2>
          {traitementsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !traitements || traitements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("dashboard_patient.traitements_empty")}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {traitements.map((t2) => (
                <li
                  key={t2.id}
                  className="rounded-2xl border-2 border-border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-semibold text-foreground">
                      <Masque>{t2.molecule}</Masque>
                    </p>
                    {t2.heurePrise && (
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                        {t2.heurePrise}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t2.dosage && (
                      <>
                        <Masque>{t2.dosage}</Masque> ·{" "}
                      </>
                    )}
                    {t2.frequence}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">
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

          {/* Communiqués */}
          {communiques && communiques.length > 0 && (
            <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {t("dashboard_patient.communiques_title")}
                </h2>
              </div>
              <ul className="mt-4 space-y-3">
                {communiques.map((c) => (
                  <li key={c.id} className="rounded-2xl bg-secondary p-4">
                    <p className="font-semibold text-foreground">{c.titre}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.contenu}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
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