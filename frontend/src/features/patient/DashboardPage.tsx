import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill, CalendarDays, AlertCircle, Plus, Loader2, FlaskConical, Stethoscope } from "lucide-react";
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

import { OBSERVATION_LABELS } from "@/lib/observations";
import { ObservanceSection } from "./ObservanceSection";
import { TriageDialog } from "./TriageDialog";
import { Masque } from "@/components/masque";



const GRAVITE_LABELS: Record<string, string> = { leger: "Léger", modere: "Modéré", severe: "Sévère" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [rdvOpen, setRdvOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [dateHeure, setDateHeure] = useState("");

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

  const { mutate: requestRdv, isPending: requestingRdv } = useMutation({
    mutationFn: () => patientApi.createRendezVous({ dateHeure, ...(motif ? { motif } : {}) }),
    onSuccess: () => {
      toast.success("Demande de rendez-vous envoyée");
      setRdvOpen(false);
      setMotif("");
      setDateHeure("");
      queryClient.invalidateQueries({ queryKey: ["patient", "rendez-vous"] });
    },
    onError: () => toast.error("Impossible d'envoyer la demande"),
  });

  const dernierSignalement = signalements?.[0];

  return (
    <AppShell title="Espace patient">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Bonjour {user?.prenom} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Code patient : <span className="font-semibold text-foreground">{user?.patient?.codePatient ?? "—"}</span>
            {" · "}
            <Masque>{user?.patient?.pathologie?.toUpperCase()}</Masque>
          </p>
        </div>
        <Button className="h-12 rounded-full px-6" onClick={() => setTriageOpen(true)}>
          <Stethoscope className="mr-2 h-5 w-5" /> Signaler un symptôme
        </Button>
      </div>
      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />


      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Traitements actifs</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">{traitements?.length ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Rendez-vous à venir</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">{rendezVous?.length ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Dernier signalement</span>
          </div>
          <p className="mt-4 text-lg font-bold text-foreground">
            {dernierSignalement ? GRAVITE_LABELS[dernierSignalement.gravite] : "Aucun"}
          </p>
        </div>
      </div>

      <ObservanceSection />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Traitements */}

        <section className="min-w-0 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-3">
          <h2 className="text-lg font-bold text-foreground">Traitements en cours</h2>
          {traitementsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !traitements || traitements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun traitement enregistré pour le moment. Votre équipe soignante peut en ajouter.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {traitements.map((t) => (
                <li key={t.id} className="rounded-2xl border-2 border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-semibold text-foreground"><Masque>{t.molecule}</Masque></p>
                    {t.heurePrise && (
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">

                        {t.heurePrise}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.dosage && <><Masque>{t.dosage}</Masque> · </>}
                    {t.frequence}
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
              <h2 className="text-lg font-bold text-foreground">Prochains rendez-vous</h2>
              <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => setRdvOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Demander
              </Button>
            </div>
            {rdvLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !rendezVous || rendezVous.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun rendez-vous à venir.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rendezVous.map((rdv) => (
                  <li key={rdv.id} className="rounded-2xl bg-secondary p-4">
                    <p className="font-semibold text-foreground">{rdv.motif || "Consultation"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(rdv.dateHeure)}</p>
                    <span className="mt-1 inline-block rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                      {rdv.statut}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Observations */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Observations récentes</h2>
            </div>
            {!observations || observations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune observation biologique pour le moment.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {observations.map((obs) => (
                  <li key={obs.id} className="flex items-center justify-between rounded-2xl bg-secondary p-4">
                    <span className="text-sm font-medium text-foreground">
                      <Masque>{OBSERVATION_LABELS[obs.type] ?? obs.type}</Masque>
                    </span>
                    <span className="text-sm font-bold text-primary">
                      <Masque>{obs.valeur} {obs.unite}</Masque>

                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog open={rdvOpen} onOpenChange={setRdvOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander un rendez-vous</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestRdv();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="dateHeure">Date et heure souhaitées</Label>
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
              <Label htmlFor="motif">Motif (optionnel)</Label>
              <Input
                id="motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. renouvellement traitement"
                className="h-11 rounded-xl"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={requestingRdv} className="w-full rounded-full">
                {requestingRdv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer la demande
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
