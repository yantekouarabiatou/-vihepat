import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, CalendarDays, AlertCircle, Loader2, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { soignantApi } from "@/api/soignant.api";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const GRAVITE_STYLES: Record<string, string> = {
  leger: "bg-secondary text-primary",
  modere: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  severe: "bg-destructive/15 text-destructive",
};

const GRAVITE_LABELS: Record<string, string> = { leger: "Léger", modere: "Modéré", severe: "Sévère" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

function initials(nom: string, prenom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["soignant", "patients", search],
    queryFn: () => soignantApi.getPatients(search || undefined),
  });
  const { data: rendezVous, isLoading: rdvLoading } = useQuery({
    queryKey: ["soignant", "rendez-vous"],
    queryFn: soignantApi.getRendezVous,
  });
  const { data: signalements, isLoading: signalementsLoading } = useQuery({
    queryKey: ["soignant", "signalements"],
    queryFn: () => soignantApi.getSignalements(),
  });

  const { mutate: confirmRdv } = useMutation({
    mutationFn: (id: number) => soignantApi.updateRendezVous(id, { statut: "confirme" }),
    onSuccess: () => {
      toast.success("Rendez-vous confirmé");
      queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
    },
    onError: () => toast.error("Impossible de confirmer le rendez-vous"),
  });

  const { mutate: markSignalement } = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: "vu" | "traite" }) =>
      soignantApi.updateSignalement(id, statut),
    onSuccess: () => {
      toast.success("Signalement mis à jour");
      queryClient.invalidateQueries({ queryKey: ["soignant", "signalements"] });
    },
    onError: () => toast.error("Impossible de mettre à jour le signalement"),
  });

  return (
    <AppShell title="Espace soignant">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Suivi des patients</h1>
      <p className="mt-1 text-muted-foreground">
        Vue d'ensemble de vos patients, rendez-vous et signalements.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Patients suivis</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">{patients?.length ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">RDV à venir</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">{rendezVous?.length ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent-soft))]">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--accent))]" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Signalements nouveaux</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">
            {signalements?.filter((s) => s.statut === "nouveau").length ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Patients */}
        <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-foreground">Patients</h2>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="h-10 rounded-full pl-9"
              />
            </div>
          </div>
          {patientsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !patients || patients.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun patient affecté pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {patients.map((p) => (
                <li key={p.id} className="flex items-center gap-4 rounded-2xl border-2 border-border p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                    {initials(p.user.nom, p.user.prenom)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{p.user.prenom} {p.user.nom}</p>
                    <p className="text-sm text-muted-foreground">{p.codePatient}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                    {p.pathologie.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          {/* Rendez-vous */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold text-foreground">Rendez-vous à venir</h2>
            {rdvLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !rendezVous || rendezVous.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun rendez-vous planifié.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rendezVous.map((rdv) => (
                  <li key={rdv.id} className="rounded-2xl bg-secondary p-4">
                    <p className="font-semibold text-foreground">
                      {rdv.patient.user.prenom} {rdv.patient.user.nom}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(rdv.dateHeure)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                        {rdv.statut}
                      </span>
                      {rdv.statut === "prevu" && (
                        <Button size="sm" variant="ghost" className="h-7 rounded-full text-primary" onClick={() => confirmRdv(rdv.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Confirmer
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Signalements */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold text-foreground">Signalements</h2>
            {signalementsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !signalements || signalements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun signalement en attente.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {signalements.map((s) => (
                  <li key={s.id} className="rounded-2xl bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{s.patient.user.prenom} {s.patient.user.nom}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRAVITE_STYLES[s.gravite]}`}>
                        {GRAVITE_LABELS[s.gravite]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{s.symptome}</p>
                    {s.notes && <p className="mt-1 text-sm text-muted-foreground">{s.notes}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      {s.statut !== "traite" && (
                        <div className="flex gap-2">
                          {s.statut === "nouveau" && (
                            <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => markSignalement({ id: s.id, statut: "vu" })}>
                              Marquer vu
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 rounded-full text-primary" onClick={() => markSignalement({ id: s.id, statut: "traite" })}>
                            Marquer traité
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
