import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Pill,
  CalendarDays,
  TrendingUp,
  MessageCircleHeart,
  Check,
  Plus,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMyRole } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Mon suivi — VIHEPAT" },
      { name: "description", content: "Votre tableau de bord de suivi de traitement VIHEPAT." },
    ],
  }),
  component: PatientDashboard,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function PatientDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: role, isLoading: roleLoading } = useMyRole();

  useEffect(() => {
    if (role === "soignant") navigate({ to: "/soignant", replace: true });
  }, [role, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").single();
      return data;
    },
  });

  const { data: treatments, isLoading: treatmentsLoading } = useQuery({
    queryKey: ["treatments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatments")
        .select("*")
        .eq("active", true)
        .order("time_of_day");
      if (error) throw error;
      return data;
    },
  });

  const { data: todayLogs } = useQuery({
    queryKey: ["dose-logs", todayStr()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dose_logs")
        .select("treatment_id")
        .eq("scheduled_date", todayStr());
      if (error) throw error;
      return data;
    },
  });

  const { data: weekLogs } = useQuery({
    queryKey: ["dose-logs-week"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("dose_logs")
        .select("id")
        .gte("scheduled_date", since);
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  async function toggleDose(treatmentId: string, taken: boolean) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    if (taken) {
      await supabase
        .from("dose_logs")
        .delete()
        .eq("treatment_id", treatmentId)
        .eq("scheduled_date", todayStr());
    } else {
      const { error } = await supabase
        .from("dose_logs")
        .insert({ treatment_id: treatmentId, patient_id: userId });
      if (error) {
        toast.error("Impossible d'enregistrer la prise");
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["dose-logs"] });
    queryClient.invalidateQueries({ queryKey: ["dose-logs-week"] });
  }

  if (roleLoading || role === "soignant") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const takenToday = new Set(todayLogs?.map((l) => l.treatment_id) ?? []);
  const totalToday = treatments?.length ?? 0;
  const doneToday = treatments?.filter((t) => takenToday.has(t.id)).length ?? 0;
  const weekTarget = totalToday * 7;
  const adherence = weekTarget > 0 ? Math.round(((weekLogs?.length ?? 0) / weekTarget) * 100) : 0;
  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <AppShell title="Espace patient">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Bonjour{firstName ? ` ${firstName}` : ""} 👋
      </h1>
      <p className="mt-1 text-muted-foreground">Voici votre suivi du jour.</p>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <Pill className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Prises du jour</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">
            {doneToday}/{totalToday}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Observance 7 jours</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">{adherence}%</p>
          <Progress value={adherence} className="mt-3 h-2" />
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Rendez-vous</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">
            {appointments?.length ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Traitements du jour */}
        <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Traitement du jour</h2>
            <Button variant="ghost" size="sm" className="rounded-full text-primary">
              <Plus className="mr-1 h-4 w-4" /> Ajouter
            </Button>
          </div>
          {treatmentsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : totalToday === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun traitement enregistré pour le moment. Votre équipe soignante peut en ajouter.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {treatments!.map((t) => {
                const taken = takenToday.has(t.id);
                return (
                  <li
                    key={t.id}
                    className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-colors ${
                      taken ? "border-primary/30 bg-secondary" : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDose(t.id, taken)}
                      aria-label={taken ? "Annuler la prise" : "Marquer comme pris"}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                        taken
                          ? "bg-primary text-primary-foreground"
                          : "border-2 border-border bg-background hover:border-primary"
                      }`}
                    >
                      {taken && <Check className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold ${taken ? "text-primary line-through" : "text-foreground"}`}
                      >
                        {t.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{t.dosage}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                      {t.time_of_day}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          {/* Rendez-vous */}
          <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold text-foreground">Prochains rendez-vous</h2>
            {!appointments || appointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun rendez-vous à venir.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {appointments.map((a) => (
                  <li key={a.id} className="rounded-2xl bg-secondary p-4">
                    <p className="font-semibold text-foreground">{a.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(a.scheduled_at).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {a.location && (
                      <p className="text-sm text-muted-foreground">{a.location}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Contact soignant */}
          <section className="rounded-3xl bg-[linear-gradient(140deg,var(--brand)_0%,var(--brand-deep)_100%)] p-6 text-primary-foreground shadow-[var(--shadow-soft)]">
            <MessageCircleHeart className="h-8 w-8" strokeWidth={1.75} />
            <h2 className="mt-3 text-lg font-bold">Besoin d'aide ?</h2>
            <p className="mt-1 text-sm text-primary-foreground/85">
              Contactez votre équipe soignante ou un pair aidant, en toute confidentialité.
            </p>
            <Button
              className="mt-4 h-11 w-full rounded-full bg-background font-semibold text-primary hover:bg-background/90"
            >
              Contacter mon soignant
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
