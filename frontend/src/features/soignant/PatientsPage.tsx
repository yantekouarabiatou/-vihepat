import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  FileDown,
  Printer,
  Copy,
  CheckCircle2,
  AlertCircle,
  Activity,
  Edit3,
  Eye,
  Link2,
  Calendar,
  Phone,
  Mail,
  ShieldCheck,
  Loader2,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  FileSpreadsheet,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type SoignantPatient, type CreatePatientResult } from "@/api/soignant.api";
import { adminApi } from "@/api/admin.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth.store";
import { useProfilSoignant } from "@/hooks/use-profil-soignant";
import { apiErrorMessage } from "@/lib/api-error";
import { formatTaux, tauxStyle } from "@/lib/observance";
import { localeAffichage } from "@/lib/date-locale";
import {
  telechargerFichePatientPdf,
  imprimerFichePatient,
  type PatientCredentialsDoc,
} from "@/lib/patient-pdf";

const PATHOLOGIES = ["vih", "vhb", "vhc", "vih_vhb", "vih_vhc", "vhb_vhc"] as const;

const PATHOLOGIE_COLORS: Record<string, string> = {
  vih: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  vhb: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  vhc: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900",
  vih_vhb: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  vih_vhc: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
  vhb_vhc: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900",
};

export function PatientsPage() {
  const { t, i18n } = useTranslation();
  const locale = localeAffichage(i18n.resolvedLanguage);
  const PATHOLOGIE_OPTIONS = PATHOLOGIES.map((v) => ({ value: v, label: t(`shared.pathologie.${v}`) }));
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const estAdmin = user?.role === "admin";
  // Ouvrir un dossier ou rattacher un patient : réservé au médecin
  const { medecin } = useProfilSoignant();

  // Filtres
  const [search, setSearch] = useState("");
  const [filtrePathologie, setFiltrePathologie] = useState<string>("all");
  const [filtreObservance, setFiltreObservance] = useState<string>("all");

  // Modals
  const [modalNouveauOpen, setModalNouveauOpen] = useState(false);
  const [modalRattacherOpen, setModalRattacherOpen] = useState(false);
  const [patientEnModification, setPatientEnModification] = useState<SoignantPatient | null>(null);
  const [patientEnReinitialisation, setPatientEnReinitialisation] = useState<SoignantPatient | null>(null);
  const [fichePdfData, setFichePdfData] = useState<PatientCredentialsDoc | null>(null);

  // Formulaire Nouveau Patient
  const [npNom, setNpNom] = useState("");
  const [npPrenom, setNpPrenom] = useState("");
  const [npEmail, setNpEmail] = useState("");
  const [npPathologie, setNpPathologie] = useState("vih");
  const [npSexe, setNpSexe] = useState<string>("");
  const [npTelephone, setNpTelephone] = useState("");
  const [npRegion, setNpRegion] = useState("");
  const [npCommune, setNpCommune] = useState("");
  const [npLangue, setNpLangue] = useState("fr");
  const [npDateNaissance, setNpDateNaissance] = useState("");
  const [npDateDiagnostic, setNpDateDiagnostic] = useState("");
  const [npConsentement, setNpConsentement] = useState(false);
  const [npSoignantId, setNpSoignantId] = useState("");

  // Formulaire Modification Patient
  const [editNom, setEditNom] = useState("");
  const [editPrenom, setEditPrenom] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPathologie, setEditPathologie] = useState<any>("vih");
  const [editSexe, setEditSexe] = useState<string>("");
  const [editTelephone, setEditTelephone] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editCommune, setEditCommune] = useState("");
  const [editLangue, setEditLangue] = useState("fr");
  const [editDateNaissance, setEditDateNaissance] = useState("");
  const [editDateDiagnostic, setEditDateDiagnostic] = useState("");

  // Formulaire Rattachement
  const [codeRattacher, setCodeRattacher] = useState("");

  // Détection URL ?action=nouveau
  useEffect(() => {
    if (searchParams.get("action") === "nouveau") {
      if (medecin) setModalNouveauOpen(true);
      // Nettoyer le paramètre après ouverture
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, medecin]);

  // Requêtes
  const { data: patients = [], isLoading, isFetching } = useQuery({
    queryKey: ["soignant", "patients"],
    queryFn: () => soignantApi.getPatients(),
  });

  const { data: soignantsLookup } = useQuery({
    queryKey: ["admin", "lookup", "soignants"],
    queryFn: () => adminApi.getLookup("soignants"),
    enabled: estAdmin,
  });

  // KPI Calculations
  const stats = useMemo(() => {
    const total = patients.length;
    let bonneObservance = 0;
    let alertesExamens = 0;
    patients.forEach((p) => {
      if (p.observance?.taux30 && p.observance.taux30 >= 80) bonneObservance++;
      if (p.examensEnRetard && p.examensEnRetard > 0) alertesExamens++;
    });
    return {
      total,
      bonneObservance,
      tauxBonneObservance: total > 0 ? Math.round((bonneObservance / total) * 100) : 0,
      alertesExamens,
    };
  }, [patients]);

  // Filtrage des patients
  const patientsFiltres = useMemo(() => {
    return patients.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.codePatient.toLowerCase().includes(q) ||
        p.user.nom.toLowerCase().includes(q) ||
        p.user.prenom.toLowerCase().includes(q) ||
        p.user.email.toLowerCase().includes(q);

      const matchPatho = filtrePathologie === "all" || p.pathologie === filtrePathologie;

      let matchObs = true;
      const taux = p.observance?.taux30;
      if (filtreObservance === "good") {
        matchObs = typeof taux === "number" && taux >= 80;
      } else if (filtreObservance === "moderate") {
        matchObs = typeof taux === "number" && taux >= 50 && taux < 80;
      } else if (filtreObservance === "low") {
        matchObs = typeof taux === "number" && taux < 50;
      } else if (filtreObservance === "none") {
        matchObs = taux === null || taux === undefined;
      }

      return matchSearch && matchPatho && matchObs;
    });
  }, [patients, search, filtrePathologie, filtreObservance]);

  // Mutation Création Patient
  const { mutate: creerPatient, isPending: creatingPatient } = useMutation({
    mutationFn: () =>
      soignantApi.creerPatient({
        email: npEmail.trim(),
        nom: npNom.trim(),
        prenom: npPrenom.trim(),
        pathologie: npPathologie as any,
        consentementDonne: npConsentement,
        ...(npSexe ? { sexe: npSexe as "M" | "F" } : {}),
        ...(npTelephone ? { telephone: npTelephone.trim() } : {}),
        ...(npRegion ? { region: npRegion.trim() } : {}),
        ...(npCommune ? { commune: npCommune.trim() } : {}),
        ...(npLangue ? { languePreferee: npLangue } : {}),
        ...(npDateNaissance ? { dateNaissance: npDateNaissance } : {}),
        ...(npDateDiagnostic ? { dateDiagnostic: npDateDiagnostic } : {}),
        ...(estAdmin && npSoignantId ? { soignantId: Number(npSoignantId) } : {}),
      }),
    onSuccess: (res: CreatePatientResult) => {
      setModalNouveauOpen(false);
      resetNouveauForm();
      queryClient.invalidateQueries({ queryKey: ["soignant", "patients"] });
      toast.success(t("patients.toast_cree", { code: res.patient.codePatient }));

      // Préparation automatique de la fiche d'accès PDF téléchargeable
      const docData: PatientCredentialsDoc = {
        patient: {
          prenom: res.patient.user.prenom,
          nom: res.patient.user.nom,
          codePatient: res.patient.codePatient,
          email: res.patient.user.email,
          pathologie: res.patient.pathologie,
          telephone: npTelephone || null,
        },
        motDePasseTemporaire: res.motDePasseTemporaire,
        structure: estAdmin ? "Direction Nationale VIHEPAT" : "Centre de Santé Référent",
        emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
        dateCreation: new Date().toLocaleDateString("fr-FR"),
      };

      setFichePdfData(docData);
      // Déclencher le téléchargement immédiat du PDF
      telechargerFichePatientPdf(docData);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patients.erreur_creation"))),
  });

  // Mutation Modification Patient
  const { mutate: modifierPatient, isPending: updatingPatient } = useMutation({
    mutationFn: () => {
      if (!patientEnModification) throw new Error("Aucun patient sélectionné");
      return soignantApi.updatePatient(patientEnModification.id, {
        nom: editNom.trim(),
        prenom: editPrenom.trim(),
        email: editEmail.trim(),
        pathologie: editPathologie,
        sexe: editSexe ? (editSexe as "M" | "F") : null,
        telephone: editTelephone.trim() || null,
        region: editRegion.trim() || null,
        commune: editCommune.trim() || null,
        languePreferee: editLangue,
        dateNaissance: editDateNaissance || null,
        dateDiagnostic: editDateDiagnostic || null,
      });
    },
    onSuccess: () => {
      toast.success(t("patients.toast_modifie"));
      setPatientEnModification(null);
      queryClient.invalidateQueries({ queryKey: ["soignant", "patients"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patients.erreur_modification"))),
  });

  // Mutation Rattachement Patient
  const { mutate: rattacherPatient, isPending: attachingPatient } = useMutation({
    mutationFn: () => soignantApi.rattacherPatient(codeRattacher.trim()),
    onSuccess: (p) => {
      toast.success(t("patients.toast_rattache", { code: p.codePatient }));
      setModalRattacherOpen(false);
      setCodeRattacher("");
      queryClient.invalidateQueries({ queryKey: ["soignant", "patients"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patients.erreur_rattachement"))),
  });

  // Mutation Réinitialisation Accès & Nouveau mot de passe
  const { mutate: reinitialiserAcces, isPending: resettingAcces } = useMutation({
    mutationFn: (patientId: number) => soignantApi.reinitialiserAcces(patientId),
    onSuccess: (res: CreatePatientResult) => {
      setPatientEnReinitialisation(null);
      toast.success(t("patients.toast_reinit", { code: res.patient.codePatient }));
      queryClient.invalidateQueries({ queryKey: ["soignant", "patients"] });

      const docData: PatientCredentialsDoc = {
        patient: {
          prenom: res.patient.user.prenom,
          nom: res.patient.user.nom,
          codePatient: res.patient.codePatient,
          email: res.patient.user.email,
          pathologie: res.patient.pathologie,
        },
        motDePasseTemporaire: res.motDePasseTemporaire,
        structure: estAdmin ? "Direction Nationale VIHEPAT" : "Centre de Santé Référent",
        emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
        dateCreation: new Date().toLocaleDateString("fr-FR"),
      };
      setFichePdfData(docData);
      telechargerFichePatientPdf(docData);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("fiche.erreur_reinit"))),
  });

  // Export CSV / Excel du répertoire des patients
  function exporterPatientsCsv() {
    if (!patientsFiltres || patientsFiltres.length === 0) {
      toast.info(t("patients.export_vide"));
      return;
    }

    const headers = [
      t("patients.csv_code"),
      t("auth.last_name"),
      t("auth.first_name"),
      t("auth.email"),
      t("patients.col_pathologie"),
      t("patients.csv_observance30"),
      t("patients.csv_observance7"),
      t("patients.csv_examens_retard"),
      t("patients.col_admission"),
    ];

    const rows = patientsFiltres.map((p) => [
      p.codePatient,
      `"${(p.user.nom || "").replace(/"/g, '""')}"`,
      `"${(p.user.prenom || "").replace(/"/g, '""')}"`,
      p.user.email,
      p.pathologie.toUpperCase(),
      p.observance?.taux30 !== null && p.observance?.taux30 !== undefined ? `${p.observance.taux30}%` : "N/A",
      p.observance?.taux7 !== null && p.observance?.taux7 !== undefined ? `${p.observance.taux7}%` : "N/A",
      p.examensEnRetard ?? 0,
      new Date(p.createdAt).toLocaleDateString(locale),
    ]);

    const csvContent =
      "\uFEFF" + // UTF-8 BOM pour Excel Windows
      headers.join(";") +
      "\n" +
      rows.map((r) => r.join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `repertoire_patients_vihepat_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);

    toast.success(t("patients.toast_export", { count: patientsFiltres.length }));
  }

  function resetNouveauForm() {
    setNpNom("");
    setNpPrenom("");
    setNpEmail("");
    setNpPathologie("vih");
    setNpSexe("");
    setNpTelephone("");
    setNpRegion("");
    setNpCommune("");
    setNpLangue("fr");
    setNpDateNaissance("");
    setNpDateDiagnostic("");
    setNpConsentement(false);
    setNpSoignantId("");
  }

  function ouvrirModification(p: SoignantPatient) {
    setPatientEnModification(p);
    setEditNom(p.user.nom);
    setEditPrenom(p.user.prenom);
    setEditEmail(p.user.email);
    setEditPathologie(p.pathologie);
    setEditSexe("");
    setEditTelephone("");
    setEditRegion("");
    setEditCommune("");
    setEditLangue("fr");
    setEditDateNaissance("");
    setEditDateDiagnostic("");

    // Charger les détails complets pour préremplir les champs additionnels
    soignantApi.getPatient(p.id).then((details) => {
      if (details) {
        setEditSexe(details.sexe || "");
        setEditTelephone(details.telephone || "");
        setEditRegion(details.region || "");
        setEditCommune(details.commune || "");
        setEditLangue(details.languePreferee || "fr");
        if (details.dateNaissance) {
          setEditDateNaissance(details.dateNaissance.slice(0, 10));
        }
        if (details.dateDiagnostic) {
          setEditDateDiagnostic(details.dateDiagnostic.slice(0, 10));
        }
      }
    }).catch(() => {});
  }

  return (
    <AppShell title={t("sidebar.section_patients")}>
      {/* ===================== EN-TÊTE DE LA PAGE ===================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {t("patients.titre")}
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {t("patients.nb_dossiers", { count: patients.length })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("patients.sous_titre")}
          </p>
        </div>

        {/* Boutons d'action rapides */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Globe className="h-3.5 w-3.5" />
            {t("app_shell.site_public")}
          </Link>

          {!estAdmin && medecin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalRattacherOpen(true)}
              className="rounded-full gap-1.5 text-xs font-semibold"
            >
              <Link2 className="h-3.5 w-3.5" />
              {t("patients.rattacher")}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={exporterPatientsCsv}
            className="rounded-full gap-1.5 text-xs font-semibold"
            title={t("patients.exporter_tooltip")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {t("patients.exporter")}
          </Button>

          {medecin && (
            <Button
              size="sm"
              onClick={() => setModalNouveauOpen(true)}
              className="rounded-full gap-2 shadow-sm font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              {t("sidebar.patients_nouveau")}
            </Button>
          )}
        </div>
      </div>

      {/* ===================== CARTES DE SYNTHÈSE / KPIS ===================== */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("patients.kpi_total")}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">{stats.total}</span>
            <span className="text-xs text-muted-foreground">{t("patients.kpi_total_sub")}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("patients.kpi_observance")}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.bonneObservance}</span>
            <span className="text-xs font-semibold text-muted-foreground">({stats.tauxBonneObservance} % ≥ 80%)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("patients.kpi_examens")}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{stats.alertesExamens}</span>
            <span className="text-xs text-muted-foreground">{t("patients.kpi_examens_sub")}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("patients.kpi_securite")}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{t("patients.kpi_securite_valeur")}</span>
            <span className="text-xs text-muted-foreground">{t("patients.kpi_securite_sub")}</span>
          </div>
        </div>
      </div>

      {/* ===================== BARRE DE RECHERCHE ET FILTRES ===================== */}
      <div className="mt-6 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Champ recherche textuelle */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("patients.recherche")}
              aria-label={t("patients.recherche")}
              className="h-10 pl-10 rounded-xl"
            />
          </div>

          {/* Filtres sélecteurs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>{t("patients.filtres")}</span>
            </div>

            <select
              aria-label={t("patients.col_pathologie")}
              value={filtrePathologie}
              onChange={(e) => setFiltrePathologie(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">{t("patients.filtre_toutes_pathologies")}</option>
              {PATHOLOGIE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              aria-label={t("patients.col_observance")}
              value={filtreObservance}
              onChange={(e) => setFiltreObservance(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">{t("patients.filtre_obs_toutes")}</option>
              <option value="good">{t("patients.filtre_obs_bonne")}</option>
              <option value="moderate">{t("patients.filtre_obs_moderee")}</option>
              <option value="low">{t("patients.filtre_obs_risque")}</option>
              <option value="none">{t("patients.filtre_obs_aucune")}</option>
            </select>
          </div>
        </div>

        {/* Tags de filtre actifs */}
        {(search || filtrePathologie !== "all" || filtreObservance !== "all") && (
          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
            <span>
              {t("patients.resultats", { count: patientsFiltres.length })}
            </span>
            <button
              onClick={() => {
                setSearch("");
                setFiltrePathologie("all");
                setFiltreObservance("all");
              }}
              className="font-semibold text-primary hover:underline"
            >
              {t("patients.reinit_filtres")}
            </button>
          </div>
        )}
      </div>

      {/* ===================== TABLEAU / LISTE DES PATIENTS ===================== */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm">{t("patients.chargement")}</p>
          </div>
        ) : patientsFiltres.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold text-foreground">{t("patients.vide_titre")}</h3>
            <p className="mt-1 text-sm max-w-md">
              {search || filtrePathologie !== "all" || filtreObservance !== "all"
                ? t("patients.vide_filtres")
                : t("patients.vide_aucun")}
            </p>
            {medecin ? (
              <Button
                size="sm"
                onClick={() => setModalNouveauOpen(true)}
                className="mt-4 rounded-full gap-2 font-semibold"
              >
                <UserPlus className="h-4 w-4" />
                {t("patients.creer_premier")}
              </Button>
            ) : (
              <p className="mt-3 max-w-md text-xs">{t("equipe.attente_rattachement")}</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3.5 pl-6 pr-4">{t("patients.col_patient")}</th>
                  <th className="px-4 py-3.5">{t("patients.col_pathologie")}</th>
                  <th className="px-4 py-3.5">{t("patients.col_observance")}</th>
                  <th className="px-4 py-3.5">{t("patients.col_examens")}</th>
                  <th className="px-4 py-3.5">{t("patients.col_admission")}</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">{t("patients.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {patientsFiltres.map((p) => {
                  const initiales = `${p.user.prenom[0] || ""}${p.user.nom[0] || ""}`.toUpperCase();
                  const badgeColor = PATHOLOGIE_COLORS[p.pathologie] || "bg-secondary text-foreground";
                  const retard = p.examensEnRetard ?? 0;

                  return (
                    <tr
                      key={p.id}
                      className="group transition-colors hover:bg-secondary/40"
                    >
                      {/* Identité patient */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
                            {initiales}
                          </div>
                          <div>
                            <Link
                              to={`/soignant/patients/${p.id}`}
                              className="font-bold text-foreground hover:text-primary transition-colors hover:underline block"
                            >
                              {p.user.prenom} {p.user.nom}
                            </Link>
                            {p.rappelsARegarder && (
                              <span
                                className="mt-0.5 inline-flex items-center rounded-full bg-[hsl(var(--gold)/0.18)] px-2 py-0.5 text-[10px] font-semibold text-foreground"
                                title={t("rappels_soignant.badge_tooltip")}
                              >
                                {t("rappels_soignant.badge")}
                              </span>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-xs font-semibold text-primary">
                                {p.codePatient}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {p.user.email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Pathologie */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${badgeColor}`}
                        >
                          {t(`shared.pathologie.${p.pathologie}`, { defaultValue: p.pathologie.toUpperCase() })}
                        </span>
                      </td>

                      {/* Observance */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${tauxStyle(
                              p.observance?.taux30
                            )}`}
                          >
                            {formatTaux(p.observance?.taux30)}
                          </span>
                          {typeof p.observance?.taux30 === "number" && (
                            <span className="text-[11px] text-muted-foreground">
                              {p.observance.taux30 >= 80 ? t("patients.obs_optimale") : p.observance.taux30 >= 50 ? t("patients.obs_moderee") : t("patients.obs_irreguliere")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Examens */}
                      <td className="px-4 py-4">
                        {retard > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {t("patients.bilans_retard", { count: retard })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            {t("patients.a_jour")}
                          </span>
                        )}
                      </td>

                      {/* Date de création */}
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Boutons d'action */}
                      <td className="py-4 pl-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Voir le dossier */}
                          <Link
                            to={`/soignant/patients/${p.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                            title={t("patients.voir_dossier_tooltip")}
                            aria-label={t("patients.voir_dossier_tooltip")}
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden lg:inline">{t("patients.voir_dossier")}</span>
                          </Link>

                          {/* Modifier */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => ouvrirModification(p)}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg"
                            title={t("patients.modifier_tooltip")}
                            aria-label={t("patients.modifier_tooltip")}
                          >
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="hidden lg:inline">{t("patients.modifier")}</span>
                          </Button>

                          {/* Réinitialiser le mot de passe & fiche PDF */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPatientEnReinitialisation(p)}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            title={t("fiche.reinit_tooltip")}
                            aria-label={t("fiche.reinit_tooltip")}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">{t("patients.reinitialiser")}</span>
                          </Button>

                          {/* Télécharger la fiche PDF d'accès */}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const doc: PatientCredentialsDoc = {
                                patient: {
                                  prenom: p.user.prenom,
                                  nom: p.user.nom,
                                  codePatient: p.codePatient,
                                  email: p.user.email,
                                  pathologie: p.pathologie,
                                },
                                motDePasseTemporaire: "******** (Défini)",
                                structure: "Centre Hospitalier Référent VIHEPAT",
                                emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
                                dateCreation: new Date(p.createdAt).toLocaleDateString("fr-FR"),
                              };
                              telechargerFichePatientPdf(doc);
                              toast.success(t("fiche.toast_pdf_pour", { code: p.codePatient }));
                            }}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg"
                            title={t("patients.pdf_tooltip")}
                            aria-label={t("patients.pdf_tooltip")}
                          >
                            <FileDown className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden sm:inline">PDF</span>
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

      {/* ======================= MODAL NOUVEAU PATIENT ======================= */}
      <Dialog open={modalNouveauOpen} onOpenChange={setModalNouveauOpen}>
        <DialogContent className="rounded-3xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <UserPlus className="h-5 w-5 text-primary" />
              {t("patients.nouveau_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("patients.nouveau_desc")}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              creerPatient();
            }}
            className="space-y-4 pt-2"
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
                  className="rounded-xl h-10"
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
                  className="rounded-xl h-10"
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
                className="rounded-xl h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("patients.email_aide")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-patho">{t("auth.pathologie_label")} *</Label>
                <SearchableSelect
                  value={npPathologie}
                  onChange={setNpPathologie}
                  options={PATHOLOGIE_OPTIONS}
                  placeholder={t("patients.selectionner")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-sexe">{t("patients.sexe")}</Label>
                <SearchableSelect
                  value={npSexe}
                  onChange={setNpSexe}
                  options={[
                    { value: "M", label: t("patients.sexe_m") },
                    { value: "F", label: t("patients.sexe_f") },
                  ]}
                  placeholder={t("patients.non_specifie")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-tel">{t("patients.telephone")}</Label>
                <Input
                  id="np-tel"
                  value={npTelephone}
                  onChange={(e) => setNpTelephone(e.target.value)}
                  placeholder={t("patients.ph_telephone")}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-langue">{t("patients.langue")}</Label>
                <SearchableSelect
                  value={npLangue}
                  onChange={setNpLangue}
                  options={[
                    { value: "fr", label: t("language.fr") },
                    { value: "fon", label: t("language.fon") },
                  ]}
                  placeholder={t("language.fr")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-region">{t("patients.region")}</Label>
                <Input
                  id="np-region"
                  value={npRegion}
                  onChange={(e) => setNpRegion(e.target.value)}
                  placeholder={t("patients.ph_region")}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-commune">{t("patients.commune")}</Label>
                <Input
                  id="np-commune"
                  value={npCommune}
                  onChange={(e) => setNpCommune(e.target.value)}
                  placeholder={t("patients.ph_commune")}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-naissance">{t("patients.date_naissance")}</Label>
                <Input
                  id="np-naissance"
                  type="date"
                  value={npDateNaissance}
                  onChange={(e) => setNpDateNaissance(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-diagnostic">{t("patients.date_diagnostic")}</Label>
                <Input
                  id="np-diagnostic"
                  type="date"
                  value={npDateDiagnostic}
                  onChange={(e) => setNpDateDiagnostic(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            {estAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="np-soignant">{t("patients.soignant_admin")}</Label>
                <SearchableSelect
                  value={npSoignantId}
                  onChange={setNpSoignantId}
                  options={soignantsLookup ?? []}
                  placeholder={t("fiche.soignant_referent_placeholder")}
                />
              </div>
            )}

            {/* Consentement médical obligatoire */}
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <Checkbox
                id="np-consent"
                checked={npConsentement}
                onCheckedChange={(c) => setNpConsentement(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="np-consent" className="text-xs leading-relaxed font-normal cursor-pointer text-foreground">
                <strong>{t("patients.consentement_titre")}</strong> {t("patients.consentement_texte")}
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalNouveauOpen(false)} className="rounded-full">
                {t("fiche.annuler")}
              </Button>
              <Button
                type="submit"
                disabled={creatingPatient || !npEmail || !npNom || !npPrenom || !npConsentement}
                className="rounded-full font-semibold shadow-sm"
              >
                {creatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("patients.creer_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL MODIFICATION PATIENT ======================= */}
      <Dialog open={!!patientEnModification} onOpenChange={(o) => !o && setPatientEnModification(null)}>
        <DialogContent className="rounded-3xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Edit3 className="h-5 w-5 text-primary" />
              {t("patients.modifier_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("fiche.code_patient")} : <span className="font-mono font-bold text-primary">{patientEnModification?.codePatient}</span>
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              modifierPatient();
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-prenom">{t("auth.first_name")} *</Label>
                <Input
                  id="edit-prenom"
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  required
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-nom">{t("auth.last_name")} *</Label>
                <Input
                  id="edit-nom"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  required
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">{t("patients.email_label")} *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className="rounded-xl h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-patho">{t("auth.pathologie_label")} *</Label>
                <SearchableSelect
                  value={editPathologie}
                  onChange={setEditPathologie}
                  options={PATHOLOGIE_OPTIONS}
                  placeholder={t("patients.selectionner")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sexe">{t("patients.sexe")}</Label>
                <SearchableSelect
                  value={editSexe}
                  onChange={setEditSexe}
                  options={[
                    { value: "M", label: t("patients.sexe_m") },
                    { value: "F", label: t("patients.sexe_f") },
                  ]}
                  placeholder={t("patients.non_specifie")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tel">{t("patients.telephone")}</Label>
                <Input
                  id="edit-tel"
                  value={editTelephone}
                  onChange={(e) => setEditTelephone(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-langue">{t("patients.langue")}</Label>
                <SearchableSelect
                  value={editLangue}
                  onChange={setEditLangue}
                  options={[
                    { value: "fr", label: t("language.fr") },
                    { value: "fon", label: t("language.fon") },
                  ]}
                  placeholder={t("language.fr")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-region">{t("patients.region")}</Label>
                <Input
                  id="edit-region"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-commune">{t("patients.commune")}</Label>
                <Input
                  id="edit-commune"
                  value={editCommune}
                  onChange={(e) => setEditCommune(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-naissance">{t("patients.date_naissance")}</Label>
                <Input
                  id="edit-naissance"
                  type="date"
                  value={editDateNaissance}
                  onChange={(e) => setEditDateNaissance(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-diagnostic">{t("patients.date_diagnostic")}</Label>
                <Input
                  id="edit-diagnostic"
                  type="date"
                  value={editDateDiagnostic}
                  onChange={(e) => setEditDateDiagnostic(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPatientEnModification(null)} className="rounded-full">
                {t("fiche.annuler")}
              </Button>
              <Button
                type="submit"
                disabled={updatingPatient || !editEmail || !editNom || !editPrenom}
                className="rounded-full font-semibold shadow-sm"
              >
                {updatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("patients.enregistrer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL RATTACHER PATIENT ======================= */}
      <Dialog open={modalRattacherOpen} onOpenChange={setModalRattacherOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Link2 className="h-5 w-5 text-primary" />
              {t("patients.rattacher_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("patients.rattacher_desc")}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              rattacherPatient();
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="code-rattacher">{t("patients.rattacher_label")} *</Label>
              <Input
                id="code-rattacher"
                value={codeRattacher}
                onChange={(e) => setCodeRattacher(e.target.value.toUpperCase())}
                required
                placeholder="VHP-2026-..."
                className="rounded-xl h-11 font-mono uppercase"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalRattacherOpen(false)} className="rounded-full">
                {t("fiche.annuler")}
              </Button>
              <Button type="submit" disabled={attachingPatient || !codeRattacher.trim()} className="rounded-full font-semibold">
                {attachingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("patients.rattacher_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL FICHE D'ACCÈS / IDENTIFIANTS GÉNÉRÉS ======================= */}
      <Dialog open={!!fichePdfData} onOpenChange={(o) => !o && setFichePdfData(null)}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              {t("patients.fiche_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("patients.fiche_desc")}
            </DialogDescription>
          </DialogHeader>

          {fichePdfData && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4 space-y-2.5 font-mono text-sm">
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    {t("patients.fiche_patient")}
                  </span>
                  <span className="font-bold text-foreground">
                    {fichePdfData.patient.prenom} {fichePdfData.patient.nom}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    {t("patients.fiche_code")}
                  </span>
                  <span className="text-base font-extrabold text-primary">
                    {fichePdfData.patient.codePatient}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    {t("patients.fiche_identifiant")}
                  </span>
                  <span className="font-bold text-foreground">{fichePdfData.patient.email}</span>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    {t("patients.fiche_mdp")}
                  </span>
                  <div className="flex items-center justify-between mt-1 bg-card p-2 rounded-xl border border-emerald-500/30">
                    <span className="text-base font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400">
                      {fichePdfData.motDePasseTemporaire}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${t("patients.copie_titre")}\n${t("auth.email")} : ${fichePdfData.patient.email}\n${t("fiche.code_patient")} : ${fichePdfData.patient.codePatient}\n${t("auth.password")} : ${fichePdfData.motDePasseTemporaire}`
                        );
                        toast.success(t("patients.toast_copie"));
                      }}
                      className="h-7 gap-1 text-xs"
                    >
                      <Copy className="h-3 w-3" /> {t("patients.copier")}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Boutons d'action pour la fiche PDF */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  onClick={() => {
                    telechargerFichePatientPdf(fichePdfData);
                    toast.success(t("fiche.toast_pdf"));
                  }}
                  className="rounded-full gap-2 font-semibold shadow-sm"
                >
                  <FileDown className="h-4 w-4" />
                  {t("fiche.telecharger_pdf")}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    imprimerFichePatient(fichePdfData);
                  }}
                  className="rounded-full gap-2 font-semibold"
                >
                  <Printer className="h-4 w-4" />
                  {t("fiche.imprimer_a4")}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                {t("patients.fiche_note")}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setFichePdfData(null)}
              className="w-full rounded-full font-semibold"
            >
              {t("password.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================= MODAL CONFIRMATION RÉINITIALISATION ACCÈS ======================= */}
      <Dialog open={!!patientEnReinitialisation} onOpenChange={(o) => !o && setPatientEnReinitialisation(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600 dark:text-amber-400">
              <KeyRound className="h-5 w-5" />
              {t("fiche.reinit_titre")}
            </DialogTitle>
            <DialogDescription>
              {t("fiche.reinit_desc", {
                nom: `${patientEnReinitialisation?.user.prenom ?? ""} ${patientEnReinitialisation?.user.nom ?? ""}`,
                code: patientEnReinitialisation?.codePatient ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-2">
            <p>• {t("fiche.reinit_point1")}</p>
            <p>• {t("fiche.reinit_point2")}</p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPatientEnReinitialisation(null)}
              className="rounded-full"
            >
              {t("fiche.annuler")}
            </Button>
            <Button
              type="button"
              disabled={resettingAcces}
              onClick={() => {
                if (patientEnReinitialisation) {
                  reinitialiserAcces(patientEnReinitialisation.id);
                }
              }}
              className="rounded-full font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {resettingAcces && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("fiche.reinit_confirmer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
