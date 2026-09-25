import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Users, CalendarDays, TrendingUp, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMyRole } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/soignant")({
  head: () => ({
    meta: [
      { title: "Espace soignant — VIHEPAT" },
      {
        name: "description",
        content: "Tableau de bord soignant VIHEPAT : suivi des patients et de l'observance.",
      },
    ],
  }),
  component: SoignantDashboard,
});

function SoignantDashboard() {
  const navigate = useNavigate();
  const { data: role, isLoading: roleLoading } = useMyRole();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (role === "patient") navigate({ to: "/dashboard", replace: true });
  }, [role, navigate]);

  const { data: patients, isLoading } = useQuery({
    queryKey: ["soignant-patients"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "patient");
      if (error) throw error;
      const ids = roles?.map((r) => r.user_id) ?? [];
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .in("id", ids);
      if (pErr) throw pErr;
      return profiles;
    },
    enabled: role === "soignant",
  });

  const { data: weekLogs } = useQuery({
    queryKey: ["soignant-week-logs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("dose_logs")
        .select("patient_id")
        .gte("scheduled_date", since);
      if (error) throw error;
      return data;
    },
    enabled: role === "soignant",
  });

  const { data: upcomingAppointments } = useQuery({
    queryKey: ["soignant-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: role === "soignant",
  });

  if (roleLoading || role !== "soignant") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filtered = (patients ?? []).filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell title="Espace soignant">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Suivi des patients
      </h1>
      <p className="mt-1 text-muted-foreground">
        Vue d'ensemble de l'observance et des rendez-vous.
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
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Prises cette semaine</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">{weekLogs?.length ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">RDV à venir</span>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-foreground">
            {upcomingAppointments?.length ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
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
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun patient pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((p) => {
                const taken = weekLogs?.filter((l) => l.patient_id === p.id).length ?? 0;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-4 rounded-2xl border-2 border-border p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                      {p.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{p.full_name || "Sans nom"}</p>
                      <p className="text-sm text-muted-foreground">
                        Suivi depuis le{" "}
                        {new Date(p.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                      {taken} prise{taken > 1 ? "s" : ""} / 7 j
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h2 className="text-lg font-bold text-foreground">Rendez-vous à venir</h2>
          {!upcomingAppointments || upcomingAppointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun rendez-vous planifié.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcomingAppointments.map((a) => (
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
      </div>
    </AppShell>
  );
}
