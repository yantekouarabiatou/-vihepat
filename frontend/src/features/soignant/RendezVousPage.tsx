import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BellRing, CalendarClock, Loader2 } from "lucide-react";
import { soignantApi, type RendezVousGlobal } from "@/api/soignant.api";
import type { StatutRDV } from "@/api/patient.api";
import { AppShell } from "@/components/app-shell";
import { BoutonsExport } from "@/components/boutons-export";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { localeAffichage } from "@/lib/date-locale";
import type { Tableau } from "@/lib/export-tableau";

/**
 * Tous les rendez-vous en cours et à venir (ou d'une période) : qui, quand, pourquoi, avec quel
 * soignant, statut et rappel. Le médecin voit toute la patientèle, les autres soignants leurs
 * patients attribués. Exportable en Excel, CSV ou PDF (lignes filtrées).
 */

type Periode = "a_venir" | "aujourdhui" | "7j" | "30j" | "passes30" | "perso";
const STATUTS: StatutRDV[] = ["prevu", "confirme", "effectue", "manque", "annule"];
const STYLE_STATUT: Record<StatutRDV, string> = {
  prevu: "bg-secondary text-primary",
  confirme: "bg-primary/10 text-primary",
  effectue: "bg-primary text-primary-foreground",
  manque: "bg-destructive/15 text-destructive",
  annule: "bg-muted text-muted-foreground",
};

function bornes(p: Periode, du: string, au: string): { du?: Date; au?: Date } {
  const debutJour = new Date(new Date().setHours(0, 0, 0, 0));
  const plusJours = (n: number) => new Date(debutJour.getTime() + n * 86400_000);
  switch (p) {
    case "aujourdhui":
      return { du: debutJour, au: plusJours(1) };
    case "7j":
      return { du: debutJour, au: plusJours(7) };
    case "30j":
      return { du: debutJour, au: plusJours(30) };
    case "passes30":
      return { du: plusJours(-30), au: new Date() };
    case "perso":
      return du && au ? { du: new Date(`${du}T00:00:00`), au: new Date(new Date(`${au}T00:00:00`).getTime() + 86400_000) } : {};
    default:
      return {};
  }
}

export function RendezVousPage() {
  const { t } = useTranslation();
  const [periode, setPeriode] = useState<Periode>("a_venir");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [statut, setStatut] = useState<StatutRDV | "tous" | "actifs">("actifs");
  const [soignant, setSoignant] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const b = useMemo(() => bornes(periode, du, au), [periode, du, au]);
  const persoIncomplete = periode === "perso" && !(b.du && b.au);

  const { data, isLoading } = useQuery({
    queryKey: ["soignant", "rendez-vous-tous", b.du?.toISOString() ?? null, b.au?.toISOString() ?? null],
    queryFn: () => soignantApi.getTousRendezVous(b.du, b.au),
    enabled: !persoIncomplete,
  });

  const nomSoignant = (r: RendezVousGlobal) => (r.soignant ? `${r.soignant.user.prenom} ${r.soignant.user.nom}` : "");
  const soignants = useMemo(() => [...new Set((data ?? []).map(nomSoignant).filter(Boolean))].sort(), [data]);

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (statut === "actifs" ? r.statut === "annule" : statut !== "tous" && r.statut !== statut) return false;
      if (soignant !== "tous" && nomSoignant(r) !== soignant) return false;
      if (!q) return true;
      return `${r.patient.user.prenom} ${r.patient.user.nom} ${r.patient.codePatient} ${r.motif ?? ""} ${nomSoignant(r)}`.toLowerCase().includes(q);
    });
  }, [data, statut, soignant, recherche]);

  const date = (iso: string) => new Date(iso).toLocaleDateString(localeAffichage(), { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const heure = (iso: string) => new Date(iso).toLocaleTimeString(localeAffichage(), { hour: "2-digit", minute: "2-digit" });
  const libelleStatut = (s: StatutRDV) => t(`shared.statut_rdv.${s}`, { defaultValue: s });
  const libelleRappel = (r: RendezVousGlobal) =>
    r.rappelEnvoyeLe
      ? t("vue_rdv.rappel_le", { date: new Date(r.rappelEnvoyeLe).toLocaleString(localeAffichage(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) })
      : r.rappelAuto !== false
        ? t("vue_rdv.rappel_prevu")
        : t("vue_rdv.rappel_aucun");

  const tableau = (): Tableau => ({
    titre: t("vue_rdv.titre"),
    sousTitre: `${t(`vue_rdv.periode_${periode}`)}${b.du && b.au ? ` (${b.du.toLocaleDateString(localeAffichage())} – ${new Date(b.au.getTime() - 1).toLocaleDateString(localeAffichage())})` : ""} · ${t("vue_rdv.exporte_le", { date: new Date().toLocaleString(localeAffichage()) })}`,
    colonnes: [t("vue_rdv.col_date"), t("vue_rdv.col_heure"), t("vue_rdv.col_patient"), t("vue_rdv.col_code"), t("vue_rdv.col_pathologie"), t("vue_rdv.col_telephone"), t("vue_rdv.col_motif"), t("vue_rdv.col_soignant"), t("vue_rdv.col_statut"), t("vue_rdv.col_rappel")],
    lignes: lignes.map((r) => [
      date(r.dateHeure),
      heure(r.dateHeure),
      `${r.patient.user.prenom} ${r.patient.user.nom}`,
      r.patient.codePatient,
      t(`shared.pathologie.${r.patient.pathologie}`, { defaultValue: r.patient.pathologie }),
      r.patient.telephone ?? "",
      r.motif ?? "",
      r.soignant ? `${nomSoignant(r)} (${t(`fonction.${r.soignant.fonction}`, { defaultValue: r.soignant.fonction })})` : "",
      libelleStatut(r.statut),
      libelleRappel(r),
    ]),
  });

  const selectClass = "h-10 rounded-full border border-input bg-background px-3 text-sm";

  return (
    <AppShell title={t("sidebar.role_soignant")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("vue_rdv.titre")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("vue_rdv.sous_titre")}</p>
        </div>
        <BoutonsExport tableau={tableau} disabled={lignes.length === 0} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <select aria-label={t("vue_rdv.periode")} value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} className={selectClass}>
          {(["a_venir", "aujourdhui", "7j", "30j", "passes30", "perso"] as Periode[]).map((p) => (
            <option key={p} value={p}>{t(`vue_rdv.periode_${p}`)}</option>
          ))}
        </select>
        {periode === "perso" && (
          <>
            <Input type="date" aria-label={t("vue_rdv.du")} value={du} onChange={(e) => setDu(e.target.value)} className="h-10 w-auto rounded-full" />
            <Input type="date" aria-label={t("vue_rdv.au")} value={au} min={du} onChange={(e) => setAu(e.target.value)} className="h-10 w-auto rounded-full" />
          </>
        )}
        <select aria-label={t("vue_rdv.col_statut")} value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className={selectClass}>
          <option value="actifs">{t("vue_rdv.statut_actifs")}</option>
          <option value="tous">{t("vue_rdv.statut_tous")}</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>{libelleStatut(s)}</option>
          ))}
        </select>
        {soignants.length > 1 && (
          <select aria-label={t("vue_rdv.col_soignant")} value={soignant} onChange={(e) => setSoignant(e.target.value)} className={selectClass}>
            <option value="tous">{t("vue_rdv.soignant_tous")}</option>
            {soignants.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t("vue_rdv.recherche")}
          className="h-10 min-w-[200px] flex-1 rounded-full sm:max-w-xs"
        />
        <span className="text-sm text-muted-foreground">{t("vue_rdv.nb", { count: lignes.length })}</span>
      </div>

      <section className="mt-4 rounded-3xl bg-card p-2 shadow-[var(--shadow-card)] sm:p-4">
        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : persoIncomplete ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("vue_rdv.perso_aide")}</p>
        ) : (
          <DataTable
            data={lignes}
            getRowKey={(r) => r.id}
            searchText={() => ""}
            hideSearch
            pageSize={20}
            emptyText={t("vue_rdv.vide")}
            columns={[
              {
                key: "quand",
                header: t("vue_rdv.col_quand"),
                sortValue: (r) => new Date(r.dateHeure).getTime(),
                render: (r) => (
                  <div className="whitespace-nowrap">
                    <p className="font-semibold capitalize text-foreground">{date(r.dateHeure)}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" /> {heure(r.dateHeure)}
                    </p>
                  </div>
                ),
              },
              {
                key: "patient",
                header: t("vue_rdv.col_patient"),
                sortValue: (r) => `${r.patient.user.nom} ${r.patient.user.prenom}`,
                render: (r) => (
                  <div>
                    <Link to={`/soignant/patients/${r.patient.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                      {r.patient.user.prenom} {r.patient.user.nom}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono text-primary">{r.patient.codePatient}</span> · {t(`shared.pathologie.${r.patient.pathologie}`, { defaultValue: r.patient.pathologie })}
                      {r.patient.telephone ? <span className="whitespace-nowrap"> · {r.patient.telephone}</span> : null}
                    </p>
                  </div>
                ),
              },
              {
                key: "motif",
                header: t("vue_rdv.col_motif"),
                sortValue: (r) => r.motif ?? "",
                render: (r) => <span className="text-sm text-foreground">{r.motif || <span className="text-muted-foreground">—</span>}</span>,
              },
              {
                key: "soignant",
                header: t("vue_rdv.col_soignant"),
                sortValue: nomSoignant,
                render: (r) =>
                  r.soignant ? (
                    <div className="text-sm">
                      <p className="whitespace-nowrap text-foreground">{nomSoignant(r)}</p>
                      <p className="text-xs text-muted-foreground">{t(`fonction.${r.soignant.fonction}`, { defaultValue: r.soignant.fonction })}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                key: "statut",
                header: t("vue_rdv.col_statut"),
                sortValue: (r) => r.statut,
                render: (r) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STYLE_STATUT[r.statut]}`}>{libelleStatut(r.statut)}</span>,
              },
              {
                key: "rappel",
                header: t("vue_rdv.col_rappel"),
                render: (r) => (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BellRing className={`h-3.5 w-3.5 ${r.rappelEnvoyeLe ? "text-primary" : ""}`} aria-hidden="true" /> {libelleRappel(r)}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("vue_rdv.gerer")} <Link to="/soignant/agenda" className="font-semibold text-primary hover:underline">{t("sidebar.agenda")}</Link>
      </p>
    </AppShell>
  );
}
