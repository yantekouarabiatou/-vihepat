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
import type { Role } from "@/store/auth.store";
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

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as any;
  return e?.response?.data?.error || e?.response?.data?.message || fallback;
}

function formatCellValue(row: AdminRow, f: AdminField): string {
  if (f.type === "fk") return row._labels?.[f.key] ?? (row[f.key] != null ? `#${row[f.key]}` : "—");
  const val = row[f.key];
  if (val == null) return "—";
  if (f.type === "boolean") return val ? "Oui" : "Non";
  if (f.type === "date" || f.type === "datetime") {
    const d = new Date(val as string);
    return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString();
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
        <Input
          type="password"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Laisser vide pour ne pas changer"
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
  const { t } = useTranslation();
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
      toast.success(`Rôle mis à jour pour ${res.user.nom} ${res.user.prenom} (${res.newRole})`);
      setRoleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "rows"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la modification du rôle")),
  });

  const { mutate: toggleStatus } = useMutation({
    mutationFn: (id: number) => adminApi.toggleUserStatus(id),
    onSuccess: (res) => {
      toast.success(res.actif ? "Compte réactivé avec succès" : "Compte suspendu");
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "rows"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors du changement de statut")),
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
      toast.success("Dossier patient créé avec succès !");
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
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la création du patient")),
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
      toast.success(editingRow ? "Ligne mise à jour" : "Ligne créée");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "rows", tableKey] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de l'enregistrement")),
  });

  const { mutate: removeRow, isPending: deleting } = useMutation({
    mutationFn: (row: AdminRow) => adminApi.deleteRow(table!.key, row.id),
    onSuccess: () => {
      toast.success("Ligne supprimée");
      setRowToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "rows", tableKey] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users-overview"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la suppression")),
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
        header: "ID",
        accessor: (r) => <span className="font-mono text-xs text-muted-foreground">{r.id}</span>,
        className: "w-16",
      },
    ];
    for (const f of table.fields) {
      if (f.type === "password") continue;
      cols.push({
        header: f.label,
        accessor: (r) => formatCellValue(r, f),
        className: f.type === "textarea" ? "max-w-xs truncate" : undefined,
      });
    }
    cols.push({
      header: "Actions",
      accessor: (r) => (
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
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: "w-24 text-right",
    });
    return cols;
  }, [table]);

  return (
    <AppShell title="Administration & Habilitations">
      <div className="space-y-6">
        {/* Entête héroïque */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary text-xs font-semibold px-3 py-0.5">
                <Shield className="h-3 w-3 mr-1" /> Gouvernance & Sécurité
              </Badge>
              <span className="text-xs text-muted-foreground">VIHEPAT Core Platform</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Gestion des Rôles & Permissions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Les dossiers patients sont créés exclusivement par les soignants et administrateurs. Supervisez les privilèges, gérez les habilitations et explorez le registre des données.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/">
              <Button
                variant="outline"
                className="rounded-full border-border/80 bg-background hover:bg-secondary font-semibold text-xs h-10 px-4 gap-1.5 shadow-xs"
              >
                <Globe className="h-4 w-4 text-primary" />
                Site public
              </Button>
            </Link>
            <Button
              onClick={() => setNewPatientOpen(true)}
              className="rounded-full shadow-md bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-deep))] text-white font-semibold text-xs h-10 px-4 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Créer un dossier patient
            </Button>
          </div>
        </div>

        {/* Métriques / KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Utilisateurs</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.total}
            </div>
            <span className="text-[11px] text-muted-foreground">Inscrits sur la plateforme</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Patients Suivis</span>
              <HeartPulse className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-600 dark:text-sky-400">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.patients}
            </div>
            <span className="text-[11px] text-muted-foreground">Créés en centre de santé</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Soignants Habilités</span>
              <Stethoscope className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.soignants}
            </div>
            <span className="text-[11px] text-muted-foreground">Avec code structure vérifié</span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Administrateurs</span>
              <Shield className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats.admins}
            </div>
            <span className="text-[11px] text-muted-foreground">Accès de supervision complet</span>
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
              Contrôle d'Accès & Matrice des Permissions
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
              Registre & Base de Données Globale
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
                        {rCfg.badge}
                      </span>
                      <span className="text-xs font-mono font-semibold opacity-75">
                        {rCfg.permissions.length} privilèges
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-extrabold text-foreground">{rCfg.name}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {rCfg.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-border/40 text-[11px] font-medium text-foreground/80 flex items-center justify-between">
                      <span>Création de patient :</span>
                      {rKey === "patient" ? (
                        <span className="inline-flex items-center gap-1 text-destructive font-bold">
                          <XCircle className="h-3.5 w-3.5" /> Interdit (en centre)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Autorisé
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
                    Utilisateurs & Attribution des Rôles
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Modifiez les rôles des utilisateurs, activez ou suspendez leurs accès en temps réel.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Rechercher nom, email, rôle..."
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
                  Aucun utilisateur trouvé pour cette recherche.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-3">Utilisateur</th>
                        <th className="py-3 px-3">Rôle Actuel</th>
                        <th className="py-3 px-3">Entité / Profil</th>
                        <th className="py-3 px-3">Statut</th>
                        <th className="py-3 px-3">Dernière Connexion</th>
                        <th className="py-3 px-3 text-right">Actions</th>
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
                                {rCfg?.badge ?? u.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-xs">
                              {u.patient ? (
                                <span className="font-mono bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-md font-semibold border border-sky-200 dark:border-sky-800">
                                  {u.patient.codePatient} ({u.patient.pathologie.toUpperCase()})
                                </span>
                              ) : u.soignant ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                                  {u.soignant.structure} ({u.soignant.matricule})
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">Administration Centrale</span>
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
                                {u.actif ? "Actif" : "Suspendu"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground">
                              {u.derniereConnexion ? new Date(u.derniereConnexion).toLocaleDateString() : "Jamais"}
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
                                  Modifier rôle
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
                                  title={u.actif ? "Suspendre l'utilisateur" : "Réactiver l'utilisateur"}
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
                    Matrice des Permissions par Rôle
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Visualisez les règles d'accès précises appliquées sur toute la plateforme.
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
                    Toutes ({PERMISSIONS_CATALOG.length})
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
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tableau de la matrice */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-4 w-2/5">Capacité & Action</th>
                      <th className="py-3 px-4 text-center w-1/5">
                        <span className="text-amber-600 dark:text-amber-400">Administrateur</span>
                      </th>
                      <th className="py-3 px-4 text-center w-1/5">
                        <span className="text-emerald-600 dark:text-emerald-400">Soignant</span>
                      </th>
                      <th className="py-3 px-4 text-center w-1/5">
                        <span className="text-sky-600 dark:text-sky-400">Patient</span>
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
                              {perm.label}
                              {isPatientCreation && (
                                <Badge className="bg-amber-600 text-white text-[10px] py-0 px-2 rounded-full">
                                  Règle Clé
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                              {perm.description}
                            </div>
                          </td>

                          {/* Admin */}
                          <td className="py-3 px-4 text-center">
                            {adminHas ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4" /> Autorisé
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
                                <CheckCircle2 className="h-4 w-4" /> Autorisé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                <XCircle className="h-4 w-4 text-muted-foreground/60" /> Interdit
                              </span>
                            )}
                          </td>

                          {/* Patient */}
                          <td className="py-3 px-4 text-center">
                            {patientHas ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="h-4 w-4" /> Son dossier
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive/80 bg-destructive/10 px-2.5 py-1 rounded-full">
                                <XCircle className="h-4 w-4 text-destructive" /> Interdit
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
                    placeholder="Choisir une table"
                    searchPlaceholder="Rechercher une table..."
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
                  <Plus className="h-4 w-4" /> Nouveau {table.label}
                </Button>
              )}
            </div>

            <div className="rounded-3xl bg-card border border-border/70 p-6 shadow-sm">
              {tablesLoading || rowsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !table ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sélectionnez une table</p>
              ) : (
                <DataTable
                  data={rows ?? []}
                  columns={tableColumns}
                  getRowKey={(r) => r.id}
                  searchPlaceholder="Rechercher dans les données..."
                  emptyText="Aucune donnée enregistrée dans cette table."
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
              Modifier le rôle de l'utilisateur
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
              Sélectionnez le nouveau rôle :
            </Label>
            <div className="space-y-2.5">
              {(
                [
                  {
                    role: "patient",
                    title: "Patient·e",
                    desc: "Accès personnel à son propre suivi et aux groupes de soutien. Ne peut pas créer de dossier.",
                  },
                  {
                    role: "soignant",
                    title: "Soignant·e (Professionnel de santé)",
                    desc: "Habilité à ouvrir des dossiers patients, prescrire, suivre la biologie et planifier des rdv.",
                  },
                  {
                    role: "admin",
                    title: "Administrateur & Coordinateur",
                    desc: "Supervision globale, gestion de tous les utilisateurs, configuration et audit de sécurité.",
                  },
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
                <span>Attention : le rôle Administrateur confère un contrôle total sur l'ensemble de la plateforme.</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} className="rounded-full">
              Annuler
            </Button>
            <Button onClick={() => updateRole()} disabled={updatingRole} className="rounded-full font-semibold">
              {updatingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer la mise à jour
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
              Ouverture de dossier patient
            </DialogTitle>
            <DialogDescription>
              En tant qu'administrateur, vous initialisez le compte patient. Un mot de passe temporaire sera généré pour remise en main propre.
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
                <Label htmlFor="np-prenom">Prénom *</Label>
                <Input
                  id="np-prenom"
                  value={npPrenom}
                  onChange={(e) => setNpPrenom(e.target.value)}
                  required
                  placeholder="Awa"
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-nom">Nom *</Label>
                <Input
                  id="np-nom"
                  value={npNom}
                  onChange={(e) => setNpNom(e.target.value)}
                  required
                  placeholder="Mensah"
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email sécurisé *</Label>
              <Input
                id="np-email"
                type="email"
                value={npEmail}
                onChange={(e) => setNpEmail(e.target.value)}
                required
                placeholder="patient@exemple.com"
                className="rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-pathologie">Pathologie suivie *</Label>
                <SearchableSelect
                  value={npPathologie}
                  onChange={setNpPathologie}
                  options={[
                    { value: "vih", label: "VIH" },
                    { value: "vhb", label: "Hépatite B" },
                    { value: "vhc", label: "Hépatite C" },
                    { value: "vih_vhb", label: "VIH + Hépatite B" },
                    { value: "vih_vhc", label: "VIH + Hépatite C" },
                    { value: "vhb_vhc", label: "Hépatite B + C" },
                  ]}
                  placeholder="Choisir pathologie"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-sexe">Sexe</Label>
                <SearchableSelect
                  value={npSexe}
                  onChange={setNpSexe}
                  options={[
                    { value: "F", label: "Femme" },
                    { value: "M", label: "Homme" },
                  ]}
                  placeholder="Non précisé"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-telephone">Téléphone</Label>
              <Input
                id="np-telephone"
                value={npTelephone}
                onChange={(e) => setNpTelephone(e.target.value)}
                placeholder="+229 90 00 00 00"
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-soignant">Soignant référent affecté</Label>
              <SearchableSelect
                value={npSoignantId}
                onChange={setNpSoignantId}
                options={soignantsLookup ?? []}
                placeholder="Assigner un soignant (optionnel)"
              />
              <p className="text-[11px] text-muted-foreground">
                Si non spécifié, le patient sera assigné au premier soignant actif disponible.
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
                Consentement médical recueilli pour le traitement sécurisé et chiffré des données de santé.
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setNewPatientOpen(false)} className="rounded-full">
                Annuler
              </Button>
              <Button type="submit" disabled={creatingPatient || !npConsentement} className="rounded-full font-semibold">
                {creatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer le compte patient
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
              Dossier patient initialisé
            </DialogTitle>
            <DialogDescription>
              Transmettez ces identifiants de première connexion au patient en main propre.
            </DialogDescription>
          </DialogHeader>

          {generatedCredentials && (
            <div className="space-y-4 py-3">
              <div className="rounded-2xl border border-border/80 bg-secondary/50 p-4 space-y-3 font-mono text-sm">
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-sans block">Nom du patient</span>
                  <span className="font-bold text-foreground">
                    {generatedCredentials.patient.user.prenom} {generatedCredentials.patient.user.nom}
                  </span>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-sans block">Code Patient Unique</span>
                  <span className="text-base font-extrabold text-primary">
                    {generatedCredentials.patient.codePatient}
                  </span>
                </div>
                <div>
                  <span className="text-xs uppercase text-muted-foreground font-sans block">Email de connexion</span>
                  <span className="font-bold text-foreground">{generatedCredentials.patient.user.email}</span>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-xs uppercase text-muted-foreground font-sans block">
                    Mot de passe temporaire
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
                          `Identifiants VIHEPAT:\nEmail: ${generatedCredentials.patient.user.email}\nCode: ${generatedCredentials.patient.codePatient}\nMot de passe: ${generatedCredentials.motDePasseTemporaire}`
                        );
                        toast.success("Identifiants copiés dans le presse-papier !");
                      }}
                      className="h-8 gap-1 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copier
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
                    toast.success("Fiche d'accès PDF téléchargée !");
                  }}
                  className="rounded-full gap-2 text-xs font-semibold shadow-sm"
                >
                  <FileDown className="h-4 w-4" />
                  Télécharger PDF
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
                  Imprimer (A4)
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setGeneratedCredentials(null)} className="w-full rounded-full font-semibold">
              Terminer & fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL CRUD TABLE BRUTE ======================= */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRow ? `Modifier : ${table?.label}` : `Ajouter : ${table?.label}`}
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
                  {editingRow ? "Enregistrer les modifications" : "Créer l'entrée"}
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
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet élément (#{rowToDelete?.id}) ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => rowToDelete && removeRow(rowToDelete)}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
