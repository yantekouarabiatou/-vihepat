import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type SoignantSignalement } from "@/api/soignant.api";
import type { Gravite, StatutSignalement } from "@/api/patient.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { apiErrorMessage } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

/**
 * Tous les signalements de symptômes reçus par l'équipe : ceux des patients suivis (tous pour le
 * médecin et le super admin), avec l'historique des signalements déjà traités.
 */

export const GRAVITE_STYLES: Record<Gravite, string> = {
  leger: "bg-secondary text-primary",
  modere: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  severe: "bg-destructive/15 text-destructive",
};
const STATUT_STYLES: Record<StatutSignalement, string> = {
  nouveau: "bg-destructive/10 text-destructive",
  vu: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  traite: "bg-primary/10 text-primary",
};
const RANG_GRAVITE: Record<Gravite, number> = { severe: 0, modere: 1, leger: 2 };

type FiltreStatut = "a_traiter" | StatutSignalement | "tous";

function dateHeure(iso: string) {
  return new Date(iso).toLocaleString(localeAffichage(), {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function SignalementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState<FiltreStatut>("a_traiter");
  const [gravite, setGravite] = useState<Gravite | "toutes">("toutes");

  const { data, isLoading } = useQuery({
    queryKey: ["soignant", "signalements", "tous"],
    queryFn: () => soignantApi.getSignalements("tous"),
    refetchInterval: 30_000,
  });

  const { mutate, isPending, variables } = useMutation({
    mutationFn: ({ id, statut: s }: { id: number; statut: "vu" | "traite" }) => soignantApi.updateSignalement(id, s),
    onSuccess: () => {
      toast.success(t("signalements_page.toast_ok"));
      // Le tableau de bord et la cloche lisent la même source
      void queryClient.invalidateQueries({ queryKey: ["soignant", "signalements"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("signalements_page.toast_erreur"))),
  });

  const lignes = useMemo(() => {
    const toutes = data ?? [];
    return toutes.filter(
      (s) =>
        (statut === "tous" || (statut === "a_traiter" ? s.statut !== "traite" : s.statut === statut)) &&
        (gravite === "toutes" || s.gravite === gravite),
    );
  }, [data, statut, gravite]);

  const compteurs = useMemo(() => {
    const toutes = data ?? [];
    return {
      nouveau: toutes.filter((s) => s.statut === "nouveau").length,
      severe: toutes.filter((s) => s.statut !== "traite" && s.gravite === "severe").length,
      aTraiter: toutes.filter((s) => s.statut !== "traite").length,
    };
  }, [data]);

  const columns: DataTableColumn<SoignantSignalement>[] = [
    {
      key: "date",
      header: t("signalements_page.col_date"),
      render: (s) => <span className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(s.createdAt)}</span>,
      sortValue: (s) => new Date(s.createdAt).getTime(),
    },
    {
      key: "patient",
      header: t("signalements_page.col_patient"),
      render: (s) => (
        <Link to={`/soignant/patients/${s.patient.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
          {s.patient.user.prenom} {s.patient.user.nom}
          <span className="block font-mono text-xs font-normal text-primary">{s.patient.codePatient}</span>
        </Link>
      ),
      sortValue: (s) => `${s.patient.user.nom} ${s.patient.user.prenom}`,
    },
    {
      key: "symptome",
      header: t("signalements_page.col_symptome"),
      render: (s) => (
        <div className="min-w-[12rem] max-w-md">
          <p className="font-medium text-foreground">{s.symptome}</p>
          {s.notes && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{s.notes}</p>}
        </div>
      ),
      sortValue: (s) => s.symptome,
    },
    {
      key: "gravite",
      header: t("signalements_page.col_gravite"),
      render: (s) => (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", GRAVITE_STYLES[s.gravite])}>
          {t(`shared.gravite.${s.gravite}`)}
        </span>
      ),
      sortValue: (s) => RANG_GRAVITE[s.gravite],
    },
    {
      key: "statut",
      header: t("signalements_page.col_statut"),
      render: (s) => (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUT_STYLES[s.statut])}>
          {t(`shared.statut_signalement.${s.statut}`)}
        </span>
      ),
      sortValue: (s) => s.statut,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => {
        const enCours = isPending && variables?.id === s.id;
        if (s.statut === "traite") return null;
        return (
          <div className="flex justify-end gap-1">
            {s.statut === "nouveau" && (
              <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" disabled={enCours} onClick={() => mutate({ id: s.id, statut: "vu" })}>
                <Eye className="mr-1 h-3.5 w-3.5" /> {t("signalements_page.marquer_vu")}
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" disabled={enCours} onClick={() => mutate({ id: s.id, statut: "traite" })}>
              {enCours ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-primary" />}
              {t("signalements_page.marquer_traite")}
            </Button>
          </div>
        );
      },
    },
  ];

  const filtresStatut: FiltreStatut[] = ["a_traiter", "nouveau", "vu", "traite", "tous"];
  const selectClass = "h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground";

  return (
    <AppShell title={t("sidebar.role_soignant")}>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("signalements_page.titre")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("signalements_page.sous_titre")}</p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-2xl font-extrabold text-foreground">{compteurs.aTraiter}</p>
          <p className="text-xs text-muted-foreground">{t("signalements_page.a_traiter")}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-2xl font-extrabold text-destructive">{compteurs.nouveau}</p>
          <p className="text-xs text-muted-foreground">{t("signalements_page.nouveaux")}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-2xl font-extrabold text-destructive">{compteurs.severe}</p>
          <p className="text-xs text-muted-foreground">{t("signalements_page.severes")}</p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{t("signalements_page.liste")}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="filtre-statut">{t("signalements_page.col_statut")}</label>
            <select id="filtre-statut" value={statut} onChange={(e) => setStatut(e.target.value as FiltreStatut)} className={selectClass}>
              {filtresStatut.map((f) => (
                <option key={f} value={f}>{t(`signalements_page.filtre.${f}`)}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="filtre-gravite">{t("signalements_page.col_gravite")}</label>
            <select id="filtre-gravite" value={gravite} onChange={(e) => setGravite(e.target.value as Gravite | "toutes")} className={selectClass}>
              <option value="toutes">{t("signalements_page.toutes_gravites")}</option>
              {(["severe", "modere", "leger"] as Gravite[]).map((g) => (
                <option key={g} value={g}>{t(`shared.gravite.${g}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <DataTable
              data={lignes}
              columns={columns}
              getRowKey={(s) => s.id}
              searchText={(s) => `${s.patient.user.prenom} ${s.patient.user.nom} ${s.patient.codePatient} ${s.symptome} ${s.notes ?? ""}`}
              searchPlaceholder={t("signalements_page.recherche")}
              pageSize={15}
              emptyText={t("signalements_page.vide")}
            />
          )}
        </div>
      </section>
    </AppShell>
  );
}
