import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Database, Plus, Trash2, Edit3, Loader2, Shield, Users, Stethoscope,
  HeartPulse, UserCheck, UserX, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, KeyRound, Copy, Check, Eye, Lock, FileText, Search, Globe,
  FileDown, Printer
} from "lucide-react";
import { toast } from "sonner";
import {
  adminApi,
  type AdminField,
  type AdminRow,
  type AdminTableDef,
  type UserOverview,
} from "@/api/admin.api";
import {
  ROLES_CONFIG,
  PERMISSIONS_CATALOG,
  PERMISSION_CATEGORIES,
  type Permission,
  type RoleConfig
} from "@/lib/permissions";
import { telechargerFichePatientPdf, imprimerFichePatient, type PatientCredentialsDoc } from "@/lib/patient-pdf";
import { useAuthStore, type Role } from "@/store/auth.store";
import { apiErrorMessage as messageErreurApi } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";
import { PasswordInput } from "@/components/ui/password-input";
import i18n from "@/i18n";
import { AppShell } from "@/components/app-shell";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const apiErrorMessage = messageErreurApi;

function formatCellValue(row: AdminRow, f: AdminField): string {
  if (f.type === "fk") return row._labels?.[f.key] ?? (row[f.key] != null ? `#${row[f.key]}` : "—");
  const val = row[f.key];
  if (val == null) return "—";
  if (f.type === "boolean") return val ? i18n.t("admin_ui.oui") : i18n.t("admin_ui.non");
  if (f.type === "date" || f.type === "datetime") {
    const d = new Date(val as string);
    return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString(localeAffichage());
  }
  return String(val);
}

function rowToFormValues(row: AdminRow | null, table: AdminTableDef): Record<string, unknown> {
  const initial: Record<string, unknown> = {};
  for (const f of table.fields) {
    if (!row) {
      initial[f.key] = f.type === "boolean" ? false : "";
      continue;
    }
    const v = row[f.key];
    if (f.type === "datetime" && typeof v === "string") {
      initial[f.key] = v.slice(0, 16);
    } else if (f.type === "date" && typeof v === "string") {
      initial[f.key] = v.slice(0, 10);
    } else {
      initial[f.key] = v ?? (f.type === "boolean" ? false : "");
    }
  }
  return initial;
}

function FieldInput({
  field,
  value,
  onChange,
  lookups,
}: {
  field: AdminField;
  value: unknown;
  onChange: (val: unknown) => void;
  lookups: Record<string, { value: string; label: string }[]>;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="rounded-xl"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          step="any"
          value={value != null && value !== "" ? String(value) : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-11 rounded-xl"
        />
      );
    case "password":
      return (
        <PasswordInput
          autoComplete="new-password"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={i18n.t("admin_ui.mdp_inchange")}
          className="h-11 rounded-xl"
        />
      );
    case "boolean":
      return (
        <div className="flex h-11 items-center">
          <Checkbox checked={value === true} onCheckedChange={(v) => onChange(v === true)} />
        </div>
      );
    case "date":
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-xl"
        />
      );
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-xl"
        />
      );
    case "select":
      return (
        <SearchableSelect
          value={value != null ? String(value) : ""}
          onChange={onChange}
          options={field.options ?? []}
          placeholder={field.label}
        />
      );
    case "fk":
      return (
        <SearchableSelect
          value={value != null ? String(value) : ""}
          onChange={onChange}
          options={lookups[field.fkTable ?? ""] ?? []}
          placeholder={field.label}
        />
      );
    default:
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-xl"
        />
      );
  }
}

export function AdminPage() {
  const { t, i18n: i18nInstance } = useTranslation();
  const locale = localeAffichage(i18nInstance.resolvedLanguage);
  // Émetteur affiché sur la fiche d'accès PDF
  const user = useAuthStore((s) => s.user);
  const permLabel = (key: string, champ: "label" | "description", defaut: string) =>
    t(`permissions.perm.${key.replace(":", "_")}.${champ}`, { defaultValue: defaut });
  const queryClient = useQueryClient();

  // Navigation par onglets
  const [activeTab, setActiveTab] = useState<"roles" | "data">("roles");
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState<string>("");

  // État modification de rôle
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserOverview | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<Role>("patient");

  // État création nouveau patient par Admin
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [npEmail, setNpEmail] = useState("");
  const [npNom, setNpNom] = useState("");
  const [npPrenom, setNpPrenom] = useState("");
  const [npPathologie, setNpPathologie] = useState<string>("vih");
  const [npSexe, setNpSexe] = useState<string>("");
  const [npTelephone, setNpTelephone] = useState<string>("");
  const [npSoignantId, setNpSoignantId] = useState<string>("");
  const [npConsentement, setNpConsentement] = useState(true);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    patient: { id: number; codePatient: string; user: { nom: string; prenom: string; email: string } };
    motDePasseTemporaire: string;
  } | null>(null);

  // État tables de données brutes
  const [tableKey, setTableKey] = useState<string>("users");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AdminRow | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [rowToDelete, setRowToDelete] = useState<AdminRow | null>(null);

  // Requêtes
  const { data: usersOverview, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users-overview"],
    queryFn: adminApi.getUsersOverview,
  });

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ["admin", "tables"],
    queryFn: adminApi.getTables,
  });

  const { data: soignantsLookup } = useQuery({
    queryKey: ["admin", "lookup", "soignants"],
    queryFn: () => adminApi.getLookup("soignants"),
  });

  const table = useMemo(() => tables?.find((t) => t.key === tableKey), [tables, tableKey]);

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ["admin", "rows", tableKey],
    queryFn: () => adminApi.listRows(tableKey),
    enabled: !!tableKey,
  });

  const fkTables = useMemo(
    () => Array.from(new Set(table?.fields.filter((f) => f.type === "fk").map((f) => f.fkTable!) ?? [])),
    [table]
  );

  const { data: lookups } = useQuery({
    queryKey: ["admin", "lookups", tableKey, fkTables],
    queryFn: async () => {
      const entries = await Promise.all(fkTables.map(async (ft) => [ft, await adminApi.getLookup(ft)] as const));
      return Object.fromEntries(entries) as Record<string, { value: string; label: string }[]>;
    },
    enabled: fkTables.length > 0,
  });

  // Mutations
  const { mutate: updateRole, isPending: updatingRole } = useMutation({
    mutationFn: () => adminApi.updateUserRole(selectedUserForRole!.id, newSelectedRole),
    onSuccess: (res) => {
      toast.success(t("admin_ui.toast_role", { nom: `${res.user.prenom} ${res.user.nom}`, role: t(`permissions.role.${res.newRole}.badge`, { defaultValue: res.newRole }) }));
      setRoleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "rows"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("admin_ui.erreur_role"))),
  });

  const { mutate: toggleStatus } = useMutation({
    mutationFn: (id: number) => adminApi.toggleUserStatus(id),
    onSuccess: (res) => {
      toast.success(res.actif ? t("admin_ui.toast_reactive") : t("admin_ui.toast_suspendu"));
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "rows"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("admin_ui.erreur_statut"))),
  });

  const { mutate: creerPatient, isPending: creatingPatient } = useMutation({
    mutationFn: () =>
      adminApi.creerPatientAdmin({
        email: npEmail,
        nom: npNom,
        prenom: npPrenom,
        pathologie: npPathologie,
        consentementDonne: npConsentement,
        ...(npSexe ? { sexe: npSexe } : {}),
        ...(npTelephone ? { telephone: npTelephone } : {}),
        ...(npSoignantId ? { soignantId: Number(npSoignantId) } : {}),
      }),
    onSuccess: (res) => {
      setNewPatientOpen(false);
      setGeneratedCredentials(res);
      toast.success(t("patients.toast_modifie_cree"));
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "rows"] });

      const doc: PatientCredentialsDoc = {
        patient: {
          prenom: res.patient.user.prenom,
          nom: res.patient.user.nom,
          codePatient: res.patient.codePatient,
          email: res.patient.user.email,
          pathologie: res.patient.pathologie,
          telephone: npTelephone || null,
        },
        motDePasseTemporaire: res.motDePasseTemporaire,
        structure: "Administration Centrale VIHEPAT",
        emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
        dateCreation: new Date().toLocaleDateString("fr-FR"),
      };
      telechargerFichePatientPdf(doc);

      setNpEmail("");
      setNpNom("");
      setNpPrenom("");
      setNpTelephone("");
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patients.erreur_creation"))),
  });

  const { mutate: saveRow, isPending: saving } = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      for (const f of table!.fields) {
        if (f.readOnly) continue;
        const v = values[f.key];
        if (f.type === "password" && (!v || (typeof v === "string" && v.trim() === ""))) continue;
        payload[f.key] = v;
      }
      return editingRow
        ? adminApi.updateRow(table!.key, editingRow.id, payload)
        : adminApi.createRow(table!.key, payload);
    },
    onSuccess: () => {
      toast.success(editingRow ? t("admin_ui.toast_ligne_maj") : t("admin_ui.toast_ligne_creee"));
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "rows", tableKey] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("admin_ui.erreur_enregistrement"))),
  });

  const { mutate: removeRow, isPending: deleting } = useMutation({
    mutationFn: (row: AdminRow) => adminApi.deleteRow(table!.key, row.id),
    onSuccess: () => {
      toast.success(t("admin_ui.toast_ligne_supprimee"));
      setRowToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "rows", tableKey] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("admin_ui.erreur_suppression"))),
  });

  // KPI
  const stats = useMemo(() => {
    if (!usersOverview) return { total: 0, patients: 0, soignants: 0, admins: 0 };
    return {
      total: usersOverview.length,
      patients: usersOverview.filter((u) => u.role === "patient").length,
      soignants: usersOverview.filter((u) => u.role === "soignant").length,
      admins: usersOverview.filter((u) => u.role === "admin").length,
    };
  }, [usersOverview]);

  // Filtrage utilisateurs
  const filteredUsers = useMemo(() => {
    if (!usersOverview) return [];
    if (!userSearch.trim()) return usersOverview;
    const q = userSearch.toLowerCase();
    return usersOverview.filter(
      (u) =>
        u.nom.toLowerCase().includes(q) ||
        u.prenom.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.patient?.codePatient.toLowerCase().includes(q) ||
        u.soignant?.structure.toLowerCase().includes(q)
    );
  }, [usersOverview, userSearch]);

  // Filtrage matrice de permissions
  const filteredPermissions = useMemo(() => {
    if (matrixCategoryFilter === "all") return PERMISSIONS_CATALOG;
    return PERMISSIONS_CATALOG.filter((p) => p.category === matrixCategoryFilter);
  }, [matrixCategoryFilter]);

  // Colonnes pour les tables brutes
  const tableColumns: DataTableColumn<AdminRow>[] = useMemo(() => {
    if (!table) return [];
    const cols: DataTableColumn<AdminRow>[] = [
      {
        key: "id",
        header: "ID",
        render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.id}</span>,
        sortValue: (r) => r.id,
        className: "w-16",
      },
    ];
    for (const f of table.fields) {
      if (f.type === "password") continue;
      cols.push({
        key: f.key,
        header: f.label,
        render: (r) => formatCellValue(r, f),
        sortValue: (r) => formatCellValue(r, f),
        ...(f.type === "textarea" ? { className: "max-w-xs truncate" } : {}),
      });
    }
    cols.push({
      key: "actions",
      header: t("patients.col_actions"),
      render: (r) => (
        <div className="flex items-center gap-1">
          {table.allowUpdate && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => {
                setEditingRow(r);
                setValues(rowToFormValues(r, table));
                setDialogOpen(true);
              }}
              aria-label={t("patients.modifier")}
              title={t("patients.modifier")}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          {table.allowDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => setRowToDelete(r)}
              aria-label={t("rappels.supprimer_bouton")}
              title={t("rappels.supprimer_bouton")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: "w-24 text-right",
    });
    return cols;
  }, [table, t]);

  return (
    <AppShell title={t("sidebar.administration")}>
      <div className="space-y-6">
        {/* Entête héroïque */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary text-xs font-semibold px-3 py-0.5">
                <Shield className="h-3 w-3 mr-1" /> {t("admin_ui.badge_gouvernance")}
              </Badge>
              <span className="text-xs text-muted-foreground">VIHEPAT Core Platform</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("admin_ui.titre")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {t("admin_ui.sous_titre")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/">
              <Button
                variant="outline"
                className="rounded-full border-border/80 bg-background hover:bg-secondary font-semibold text-xs h-10 px-4 gap-1.5 shadow-xs"
              >
                <Globe className="h-4 w-4 text-primary" />
                {t("app_shell.site_public")}
              </Button>
            </Link>
            <Button
              onClick={() => setNewPatientOpen(true)}
              className="rounded-full shadow-md bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-deep))] text-white font-semibold text-xs h-10 px-4 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {t("admin_ui.creer_patient")}
            </Button>
          </div>
        </div>

        {/* Métriques / KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{t("admin_ui.kpi_utilisateurs")}</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.total}
            </div>
            <span className="text-[11px] text-muted-foreground">{t("admin_ui.kpi_utilisateurs_sub")}</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{t("admin_ui.kpi_patients")}</span>
              <HeartPulse className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-600 dark:text-sky-400">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.patients}
            </div>
            <span className="text-[11px] text-muted-foreground">{t("admin_ui.kpi_patients_sub")}</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{t("admin_ui.kpi_soignants")}</span>
              <Stethoscope className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.soignants}
            </div>
            <span className="text-[11px] text-muted-foreground">{t("admin_ui.kpi_soignants_sub")}</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{t("admin_ui.kpi_admins")}</span>
              <Shield className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.admins}
            </div>
            <span className="text-[11px] text-muted-foreground">{t("admin_ui.kpi_admins_sub")}</span>
          </div>
        </div>

        {/* Barre d'onglets principale */}
        <div className="flex border-b border-border/80 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === "roles"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("admin_ui.onglet_roles")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === "data"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("admin_ui.onglet_donnees")}
            </span>
          </button>
        </div>

        {/* ======================= ONGLET 1 : RÔLES & PERMISSIONS ======================= */}
        {activeTab === "roles" && (
          <div className="space-y-8">
            {/* Cartes de présentation des 3 rôles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(ROLES_CONFIG) as Role[]).map((rKey) => {
                const rCfg = ROLES_CONFIG[rKey];
                return (
                  <div
                    key={rKey}
                    className={`rounded-3xl border p-5 transition-shadow shadow-sm hover:shadow-md ${rCfg.colorClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${rCfg.badgeBg}`}>
                        {t(`permissions.role.${rKey}.badge`, { defaultValue: rCfg.badge })}
                      </span>
                      <span className="text-xs font-mono font-semibold opacity-75">
                        {t("admin_ui.privileges", { count: rCfg.permissions.length })}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-extrabold text-foreground">{t(`permissions.role.${rKey}.name`, { defaultValue: rCfg.name })}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {t(`permissions.role.${rKey}.description`, { defaultValue: rCfg.description })}
                    </p>
                    <div className="mt-4 pt-3 border-t border-border/40 text-[11px] font-medium text-foreground/80 flex items-center justify-between">
                      <span>{t("admin_ui.creation_patient")}</span>
                      {rKey === "patient" ? (
                        <span className="inline-flex items-center gap-1 text-destructive font-bold">
                          <XCircle className="h-3.5 w-3.5" /> {t("admin_ui.interdit_centre")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t("admin_ui.autorise")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SECTION A : TABLEAU DES UTILISATEURS & GESTION DES RÔLES */}
            <div className="rounded-3xl bg-card border border-border/70 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {t("admin_ui.utilisateurs_titre")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("admin_ui.utilisateurs_desc")}
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t("admin_ui.recherche_utilisateurs")}
                    aria-label={t("admin_ui.recherche_utilisateurs")}
                    className="pl-9 h-10 rounded-full text-xs"
                  />
                </div>
              </div>

              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {t("admin_ui.utilisateurs_vide")}
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-3">{t("admin_ui.col_utilisateur")}</th>
                        <th className="py-3 px-3">{t("admin_ui.col_role")}</th>
                        <th className="py-3 px-3">{t("admin_ui.col_entite")}</th>
                        <th className="py-3 px-3">{t("admin_ui.col_statut")}</th>
                        <th className="py-3 px-3">{t("admin_ui.col_connexion")}</th>
                        <th className="py-3 px-3 text-right">{t("patients.col_actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredUsers.map((u) => {
                        const rCfg = ROLES_CONFIG[u.role];
                        return (
                          <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-foreground">
                                {u.prenom} {u.nom}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                            </td>
                            <td className="py-3 px-3">
                              <Badge className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rCfg?.badgeBg ?? "bg-secondary"}`}>
                                {rCfg ? t(`permissions.role.${u.role}.badge`, { defaultValue: rCfg.badge }) : u.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-xs">
                              {u.patient ? (
                                <span className="font-mono bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-md font-semibold border border-sky-200 dark:border-sky-800">
                                  {u.patient.codePatient} ({t(`shared.pathologie.${u.patient.pathologie}`, { defaultValue: u.patient.pathologie.toUpperCase() })})
                                </span>
                              ) : u.soignant ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                                  {u.soignant.structure} ({u.soignant.matricule})
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">{t("admin_ui.administration_centrale")}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  u.actif
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-destructive/15 text-destructive dark:bg-destructive/25"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${u.actif ? "bg-emerald-500" : "bg-destructive"}`} />
                                {u.actif ? t("admin_ui.actif") : t("admin_ui.suspendu")}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground">
                              {u.derniereConnexion ? new Date(u.derniereConnexion).toLocaleDateString(locale) : t("admin_ui.jamais")}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUserForRole(u);
                                    setNewSelectedRole(u.role);
                                    setRoleDialogOpen(true);
                                  }}
                                  className="h-8 rounded-full text-xs font-medium gap-1"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                                  {t("admin_ui.modifier_role")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleStatus(u.id)}
                                  className={`h-8 w-8 p-0 rounded-full ${
                                    u.actif
                                      ? "text-destructive hover:bg-destructive/10"
                                      : "text-emerald-600 hover:bg-emerald-50"
                                  }`}
                                  title={u.actif ? t("admin_ui.suspendre") : t("admin_ui.reactiver")}
                                  aria-label={u.actif ? t("admin_ui.suspendre") : t("admin_ui.reactiver")}
                                >
                                  {u.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SECTION B : MATRICE DES PERMISSIONS */}
            <div className="rounded-3xl bg-card border border-border/70 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {t("admin_ui.matrice_titre")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("admin_ui.matrice_desc")}
                  </p>
                </div>

                {/* Filtre de catégories */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMatrixCategoryFilter("all")}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      matrixCategoryFilter === "all"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("admin_ui.toutes", { count: PERMISSIONS_CATALOG.length })}
                  </button>
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setMatrixCategoryFilter(cat.key)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        matrixCategoryFilter === cat.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t(`permissions.cat.${cat.key}.label`, { defaultValue: cat.label })}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tableau de la matrice */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-4 w-2/5">{t("admin_ui.col_capacite")}</th>
                      <th className="py-3 px-4 text-center w-1/5">
                        <span className="text-amber-600 dark:text-amber-400">{t("permissions.role.admin.badge")}</span>
                      </th>
                      <th className="py-3 px-4 text-center w-1/5">
                        <span className="text-emerald-600 dark:text-emerald-400">{t("permissions.role.soignant.badge")}</span>
                      </th>
                      <th className="py-3 px-4 text-center w-1/5">
                        <span className="text-sky-600 dark:text-sky-400">{t("permissions.role.patient.badge")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredPermissions.map((perm) => {
                      const adminHas = ROLES_CONFIG.admin.permissions.includes(perm.key);
                      const soignantHas = ROLES_CONFIG.soignant.permissions.includes(perm.key);
                      const patientHas = ROLES_CONFIG.patient.permissions.includes(perm.key);

                      // Mise en avant spécifique pour la création de patient
                      const isPatientCreation = perm.key === "patient:create";

                      return (
                        <tr
                          key={perm.key}
                          className={`hover:bg-secondary/20 transition-colors ${
                            isPatientCreation ? "bg-amber-500/10 font-medium" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              {permLabel(perm.key, "label", perm.label)}
                              {isPatientCreation && (
                                <Badge className="bg-amber-600 text-white text-[10px] py-0 px-2 rounded-full">
                                  {t("admin_ui.regle_cle")}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                              {permLabel(perm.key, "description", perm.description)}
                            </div>
                          </td>

                          {/* Admin */}
                          <td className="py-3 px-4 text-center">
                            {adminHas ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4" /> {t("admin_ui.autorise")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                <XCircle className="h-4 w-4" /> —
                              </span>
                            )}
                          </td>

                          {/* Soignant */}
                          <td className="py-3 px-4 text-center">
                            {soignantHas ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4" /> {t("admin_ui.autorise")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                <XCircle className="h-4 w-4 text-muted-foreground/60" /> {t("admin_ui.interdit")}
                              </span>
                            )}
                          </td>

                          {/* Patient */}
                          <td className="py-3 px-4 text-center">
                            {patientHas ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4" /> {t("admin_ui.son_dossier")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive/80 bg-destructive/10 px-2.5 py-1 rounded-full">
                                <XCircle className="h-4 w-4 text-destructive" /> {t("admin_ui.interdit")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================= ONGLET 2 : DONNÉES BRUTES & REGISTRE ======================= */}
        {activeTab === "data" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div className="w-72">
                  <SearchableSelect
                    value={tableKey}
                    onChange={setTableKey}
                    options={(tables ?? []).map((tb) => ({ value: tb.key, label: tb.label }))}
                    placeholder={t("admin_ui.choisir_table")}
                    searchPlaceholder={t("admin_ui.rechercher_table")}
                  />
                </div>
              </div>

              {table?.allowCreate && (
                <Button
                  className="h-10 rounded-full gap-1.5"
                  onClick={() => {
                    setEditingRow(null);
                    setValues(rowToFormValues(null, table));
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> {t("admin_ui.nouvelle_entree", { table: table.label })}
                </Button>
              )}
            </div>

            <div className="rounded-3xl bg-card border border-border/70 p-6 shadow-sm">
              {tablesLoading || rowsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !table ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t("admin_ui.selectionnez_table")}</p>
              ) : (
                <DataTable
                  data={rows ?? []}
                  columns={tableColumns}
                  getRowKey={(r) => r.id}
                  searchPlaceholder={t("admin_ui.rechercher_donnees")}
                  emptyText={t("admin_ui.table_vide")}
                  pageSize={10}
                  searchText={(r) =>
                    table.fields
                      .map((f) => (f.type === "fk" ? r._labels?.[f.key] : r[f.key]))
                      .filter(Boolean)
                      .join(" ")
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================= DIALOGUE DE MODIFICATION DU RÔLE ======================= */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {t("admin_ui.role_dialog_titre")}
            </DialogTitle>
            <DialogDescription>
              {selectedUserForRole && (
                <span>
                  {selectedUserForRole.prenom} {selectedUserForRole.nom} ({selectedUserForRole.email})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              {t("admin_ui.role_dialog_label")}
            </Label>
            <div className="space-y-2.5">
              {(
                [
                  { role: "patient", title: t("admin_ui.role_patient_titre"), desc: t("admin_ui.role_patient_desc") },
                  { role: "soignant", title: t("admin_ui.role_soignant_titre"), desc: t("admin_ui.role_soignant_desc") },
                  { role: "admin", title: t("admin_ui.role_admin_titre"), desc: t("admin_ui.role_admin_desc") },
                ] as const
              ).map((item) => (
                <label
                  key={item.role}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    newSelectedRole === item.role
                      ? "border-primary bg-primary/5 text-foreground shadow-sm"
                      : "border-border/60 hover:border-primary/40 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="selectedRole"
                    value={item.role}
                    checked={newSelectedRole === item.role}
                    onChange={() => setNewSelectedRole(item.role)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-bold text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {newSelectedRole === "admin" && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{t("admin_ui.role_admin_attention")}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} className="rounded-full">
              {t("fiche.annuler")}
            </Button>
            <Button onClick={() => updateRole()} disabled={updatingRole} className="rounded-full font-semibold">
              {updatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin_ui.role_dialog_confirmer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================= DIALOGUE CRÉATION PATIENT (ADMIN) ======================= */}
      <Dialog open={newPatientOpen} onOpenChange={setNewPatientOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HeartPulse className="h-5 w-5 text-primary" />
              {t("admin_ui.np_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("admin_ui.np_desc")}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              creerPatient();
            }}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-prenom">{t("auth.first_name")} *</Label>
                <Input
                  id="np-prenom"
                  value={npPrenom}
                  onChange={(e) => setNpPrenom(e.target.value)}
                  required
                  placeholder={t("patients.ph_prenom")}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-nom">{t("auth.last_name")} *</Label>
                <Input
                  id="np-nom"
                  value={npNom}
                  onChange={(e) => setNpNom(e.target.value)}
                  required
                  placeholder={t("patients.ph_nom")}
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-email">{t("patients.email_label")} *</Label>
              <Input
                id="np-email"
                type="email"
                value={npEmail}
                onChange={(e) => setNpEmail(e.target.value)}
                required
                placeholder={t("patients.ph_email")}
                className="rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-pathologie">{t("auth.pathologie_label")} *</Label>
                <SearchableSelect
                  value={npPathologie}
                  onChange={setNpPathologie}
                  options={["vih", "vhb", "vhc", "vih_vhb", "vih_vhc", "vhb_vhc"].map((v) => ({
                    value: v,
                    label: t(`shared.pathologie.${v}`),
                  }))}
                  placeholder={t("patients.selectionner")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-sexe">{t("patients.sexe")}</Label>
                <SearchableSelect
                  value={npSexe}
                  onChange={setNpSexe}
                  options={[
                    { value: "F", label: t("patients.sexe_f") },
                    { value: "M", label: t("patients.sexe_m") },
                  ]}
                  placeholder={t("patients.non_specifie")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-telephone">{t("patients.telephone")}</Label>
              <Input
                id="np-telephone"
                value={npTelephone}
                onChange={(e) => setNpTelephone(e.target.value)}
                placeholder="+229 90 00 00 00"
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-soignant">{t("fiche.soignant_referent")}</Label>
              <SearchableSelect
                value={npSoignantId}
                onChange={setNpSoignantId}
                options={soignantsLookup ?? []}
                placeholder={t("fiche.soignant_referent_placeholder")}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("admin_ui.np_soignant_aide")}
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-3.5">
              <Checkbox
                id="np-consent"
                checked={npConsentement}
                onCheckedChange={(v) => setNpConsentement(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="np-consent" className="text-xs leading-relaxed font-normal cursor-pointer">
                {t("admin_ui.np_consentement")}
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setNewPatientOpen(false)} className="rounded-full">
                {t("fiche.annuler")}
              </Button>
              <Button type="submit" disabled={creatingPatient || !npConsentement} className="rounded-full font-semibold">
                {creatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("admin_ui.np_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL IDENTIFIANTS GÉNÉRÉS ======================= */}
      <Dialog open={!!generatedCredentials} onOpenChange={(o) => !o && setGeneratedCredentials(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              {t("admin_ui.cred_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("admin_ui.cred_desc")}
            </DialogDescription>
          </DialogHeader>

          {generatedCredentials && (
            <div className="space-y-4 py-3">
              <div className="rounded-2xl border border-border/80 bg-secondary/50 p-4 space-y-3 font-mono text-sm">
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-sans block">{t("patients.fiche_patient")}</span>
                  <span className="font-bold text-foreground">
                    {generatedCredentials.patient.user.prenom} {generatedCredentials.patient.user.nom}
                  </span>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-sans block">{t("patients.fiche_code")}</span>
                  <span className="text-base font-extrabold text-primary">
                    {generatedCredentials.patient.codePatient}
                  </span>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-sans block">{t("patients.fiche_identifiant")}</span>
                  <span className="font-bold text-foreground">{generatedCredentials.patient.user.email}</span>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-xs uppercase text-muted-foreground font-sans block">
                    {t("patients.fiche_mdp")}
                  </span>
                  <div className="flex items-center justify-between mt-1 bg-card p-2 rounded-xl border border-border">
                    <span className="text-base font-extrabold tracking-wider text-emerald-600 dark:text-emerald-400">
                      {generatedCredentials.motDePasseTemporaire}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${t("patients.copie_titre")}\n${t("auth.email")} : ${generatedCredentials.patient.user.email}\n${t("fiche.code_patient")} : ${generatedCredentials.patient.codePatient}\n${t("auth.password")} : ${generatedCredentials.motDePasseTemporaire}`
                        );
                        toast.success(t("patients.toast_copie"));
                      }}
                      className="h-8 gap-1 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" /> {t("patients.copier")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Actions PDF & Impression */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  onClick={() => {
                    const doc: PatientCredentialsDoc = {
                      patient: {
                        prenom: generatedCredentials.patient.user.prenom,
                        nom: generatedCredentials.patient.user.nom,
                        codePatient: generatedCredentials.patient.codePatient,
                        email: generatedCredentials.patient.user.email,
                        pathologie: generatedCredentials.patient.pathologie,
                      },
                      motDePasseTemporaire: generatedCredentials.motDePasseTemporaire,
                      structure: "Administration Centrale VIHEPAT",
                      emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
                    };
                    telechargerFichePatientPdf(doc);
                    toast.success(t("fiche.toast_pdf"));
                  }}
                  className="rounded-full gap-2 text-xs font-semibold shadow-sm"
                >
                  <FileDown className="h-4 w-4" />
                  {t("fiche.telecharger_pdf")}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    const doc: PatientCredentialsDoc = {
                      patient: {
                        prenom: generatedCredentials.patient.user.prenom,
                        nom: generatedCredentials.patient.user.nom,
                        codePatient: generatedCredentials.patient.codePatient,
                        email: generatedCredentials.patient.user.email,
                        pathologie: generatedCredentials.patient.pathologie,
                      },
                      motDePasseTemporaire: generatedCredentials.motDePasseTemporaire,
                      structure: "Administration Centrale VIHEPAT",
                      emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
                    };
                    imprimerFichePatient(doc);
                  }}
                  className="rounded-full gap-2 text-xs font-semibold"
                >
                  <Printer className="h-4 w-4" />
                  {t("fiche.imprimer_a4")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setGeneratedCredentials(null)} className="w-full rounded-full font-semibold">
              {t("admin_ui.terminer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL CRUD TABLE BRUTE ======================= */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? t("admin_ui.modifier_entree", { table: table?.label ?? "" }) : t("admin_ui.ajouter_entree", { table: table?.label ?? "" })}
            </DialogTitle>
            <DialogDescription>{table?.label}</DialogDescription>
          </DialogHeader>
          {table && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveRow();
              }}
              className="space-y-4"
            >
              {table.fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>
                    {f.label}
                    {f.required && !f.readOnly && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput
                    field={f}
                    value={values[f.key]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                    lookups={lookups ?? {}}
                  />
                </div>
              ))}
              <DialogFooter>
                <Button type="submit" disabled={saving} className="w-full rounded-full font-semibold">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRow ? t("patients.enregistrer") : t("admin_ui.creer_entree")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================= DIALOGUE CONFIRMATION SUPPRESSION ======================= */}
      <AlertDialog open={!!rowToDelete} onOpenChange={(o) => !o && setRowToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_ui.suppression_titre")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_ui.suppression_desc", { id: rowToDelete?.id ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t("fiche.annuler")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => rowToDelete && removeRow(rowToDelete)}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin_ui.supprimer_definitivement")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
