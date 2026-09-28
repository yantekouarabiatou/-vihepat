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
import { apiErrorMessage } from "@/lib/api-error";
import { formatTaux, tauxStyle } from "@/lib/observance";
import {
  telechargerFichePatientPdf,
  imprimerFichePatient,
  type PatientCredentialsDoc,
} from "@/lib/patient-pdf";

const PATHOLOGIE_OPTIONS = [
  { value: "vih", label: "VIH" },
  { value: "vhb", label: "Hépatite B" },
  { value: "vhc", label: "Hépatite C" },
  { value: "vih_vhb", label: "VIH + Hépatite B" },
  { value: "vih_vhc", label: "VIH + Hépatite C" },
  { value: "vhb_vhc", label: "Hépatite B + C" },
];

const PATHOLOGIE_COLORS: Record<string, string> = {
  vih: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  vhb: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  vhc: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900",
  vih_vhb: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  vih_vhc: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
  vhb_vhc: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900",
};

export function PatientsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const estAdmin = user?.role === "admin";

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
      setModalNouveauOpen(true);
      // Nettoyer le paramètre après ouverture
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      toast.success(`Dossier patient créé avec succès : ${res.patient.codePatient}`);

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
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la création du patient")),
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
      toast.success("Dossier patient mis à jour avec succès !");
      setPatientEnModification(null);
      queryClient.invalidateQueries({ queryKey: ["soignant", "patients"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la mise à jour du patient")),
  });

  // Mutation Rattachement Patient
  const { mutate: rattacherPatient, isPending: attachingPatient } = useMutation({
    mutationFn: () => soignantApi.rattacherPatient(codeRattacher.trim()),
    onSuccess: (p) => {
      toast.success(`Patient ${p.codePatient} rattaché à votre file active !`);
      setModalRattacherOpen(false);
      setCodeRattacher("");
      queryClient.invalidateQueries({ queryKey: ["soignant", "patients"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors du rattachement du patient")),
  });

  // Mutation Réinitialisation Accès & Nouveau mot de passe
  const { mutate: reinitialiserAcces, isPending: resettingAcces } = useMutation({
    mutationFn: (patientId: number) => soignantApi.reinitialiserAcces(patientId),
    onSuccess: (res: CreatePatientResult) => {
      setPatientEnReinitialisation(null);
      toast.success(`Accès réinitialisés avec succès pour le patient ${res.patient.codePatient}`);
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
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la réinitialisation des accès")),
  });

  // Export CSV / Excel du répertoire des patients
  function exporterPatientsCsv() {
    if (!patientsFiltres || patientsFiltres.length === 0) {
      toast.info("Aucun patient à exporter avec les filtres actuels.");
      return;
    }

    const headers = [
      "Code Patient",
      "Nom",
      "Prenom",
      "Email",
      "Pathologie",
      "Observance 30j (%)",
      "Observance 7j (%)",
      "Examens en retard",
      "Date d admission",
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
      new Date(p.createdAt).toLocaleDateString("fr-FR"),
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

    toast.success(`Export CSV généré avec succès (${patientsFiltres.length} dossiers)`);
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
    <AppShell title="Gestion des Patients">
      {/* ===================== EN-TÊTE DE LA PAGE ===================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Répertoire & Gestion des Patients
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {patients.length} dossiers
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi des dossiers actifs, enregistrement de nouveaux patients et génération des fiches d'accès sécurisées.
          </p>
        </div>

        {/* Boutons d'action rapides */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Globe className="h-3.5 w-3.5" />
            Site public
          </Link>

          {!estAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalRattacherOpen(true)}
              className="rounded-full gap-1.5 text-xs font-semibold"
            >
              <Link2 className="h-3.5 w-3.5" />
              Rattacher un patient
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={exporterPatientsCsv}
            className="rounded-full gap-1.5 text-xs font-semibold"
            title="Exporter le répertoire des patients au format CSV / Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Exporter (CSV / Excel)
          </Button>

          <Button
            size="sm"
            onClick={() => setModalNouveauOpen(true)}
            className="rounded-full gap-2 shadow-sm font-semibold"
          >
            <UserPlus className="h-4 w-4" />
            Nouveau patient
          </Button>
        </div>
      </div>

      {/* ===================== CARTES DE SYNTHÈSE / KPIS ===================== */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Patients</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">{stats.total}</span>
            <span className="text-xs text-muted-foreground">inscrits dans la file</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bonne Observance</span>
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
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Examens Requis</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{stats.alertesExamens}</span>
            <span className="text-xs text-muted-foreground">bilans en retard</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sécurité & RGPD</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-sm font-bold text-sky-600 dark:text-sky-400">100 % Authentifiés</span>
            <span className="text-xs text-muted-foreground">Fiches sécurisées</span>
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
              placeholder="Rechercher par nom, prénom, code (VHP-...), email..."
              className="h-10 pl-10 rounded-xl"
            />
          </div>

          {/* Filtres sélecteurs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filtres :</span>
            </div>

            <select
              value={filtrePathologie}
              onChange={(e) => setFiltrePathologie(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Toutes pathologies</option>
              <option value="vih">VIH</option>
              <option value="vhb">Hépatite B</option>
              <option value="vhc">Hépatite C</option>
              <option value="vih_vhb">VIH + Hépatite B</option>
              <option value="vih_vhc">VIH + Hépatite C</option>
              <option value="vhb_vhc">Hépatite B + C</option>
            </select>

            <select
              value={filtreObservance}
              onChange={(e) => setFiltreObservance(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Toute observance</option>
              <option value="good">Bonne observance (≥ 80%)</option>
              <option value="moderate">Modérée (50-79%)</option>
              <option value="low">À risque (&lt; 50%)</option>
              <option value="none">Non renseignée</option>
            </select>
          </div>
        </div>

        {/* Tags de filtre actifs */}
        {(search || filtrePathologie !== "all" || filtreObservance !== "all") && (
          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
            <span>
              {patientsFiltres.length} résultat{patientsFiltres.length > 1 ? "s" : ""} trouvé{patientsFiltres.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => {
                setSearch("");
                setFiltrePathologie("all");
                setFiltreObservance("all");
              }}
              className="font-semibold text-primary hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* ===================== TABLEAU / LISTE DES PATIENTS ===================== */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm">Chargement du répertoire des patients...</p>
          </div>
        ) : patientsFiltres.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold text-foreground">Aucun patient correspondant</h3>
            <p className="mt-1 text-sm max-w-md">
              {search || filtrePathologie !== "all" || filtreObservance !== "all"
                ? "Modifiez vos filtres de recherche pour afficher les dossiers patients."
                : "Vous n'avez pas encore de patient dans votre file active. Enregistrez un nouveau patient pour commencer."}
            </p>
            <Button
              size="sm"
              onClick={() => setModalNouveauOpen(true)}
              className="mt-4 rounded-full gap-2 font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              Créer un premier patient
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3.5 pl-6 pr-4">Patient & Identifiant</th>
                  <th className="px-4 py-3.5">Pathologie</th>
                  <th className="px-4 py-3.5">Observance (30j)</th>
                  <th className="px-4 py-3.5">Examens de suivi</th>
                  <th className="px-4 py-3.5">Date d'admission</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
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
                              {p.observance.taux30 >= 80 ? "Optimale" : p.observance.taux30 >= 50 ? "Modérée" : "Irrégulière"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Examens */}
                      <td className="px-4 py-4">
                        {retard > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {retard} bilan{retard > 1 ? "s" : ""} en retard
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            À jour
                          </span>
                        )}
                      </td>

                      {/* Date de création */}
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("fr-FR", {
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
                            title="Consulter le dossier médical complet"
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden lg:inline">Dossier</span>
                          </Link>

                          {/* Modifier */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => ouvrirModification(p)}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg"
                            title="Modifier les informations du patient"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="hidden lg:inline">Modifier</span>
                          </Button>

                          {/* Réinitialiser le mot de passe & fiche PDF */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPatientEnReinitialisation(p)}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            title="Générer un nouveau mot de passe temporaire et une nouvelle fiche PDF"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">Réinitialiser</span>
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
                              toast.success(`Fiche PDF téléchargée pour ${p.codePatient}`);
                            }}
                            className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg"
                            title="Télécharger la fiche d'accès officielle en PDF"
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
              Créer un nouveau dossier patient
            </DialogTitle>
            <DialogDescription>
              Enregistrez le patient dans la file active VIHEPAT. Une fiche d'accès officielle en PDF avec mot de passe de connexion sera immédiatement générée.
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
                <Label htmlFor="np-prenom">Prénom *</Label>
                <Input
                  id="np-prenom"
                  value={npPrenom}
                  onChange={(e) => setNpPrenom(e.target.value)}
                  required
                  placeholder="Ex: Awa"
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-nom">Nom *</Label>
                <Input
                  id="np-nom"
                  value={npNom}
                  onChange={(e) => setNpNom(e.target.value)}
                  required
                  placeholder="Ex: Mensah"
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email de connexion sécurisé *</Label>
              <Input
                id="np-email"
                type="email"
                value={npEmail}
                onChange={(e) => setNpEmail(e.target.value)}
                required
                placeholder="Ex: patient@exemple.com"
                className="rounded-xl h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Sert d'identifiant de connexion pour le patient sur le portail VIHEPAT.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-patho">Pathologie suivie *</Label>
                <SearchableSelect
                  value={npPathologie}
                  onChange={setNpPathologie}
                  options={PATHOLOGIE_OPTIONS}
                  placeholder="Sélectionner"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-sexe">Sexe civil</Label>
                <SearchableSelect
                  value={npSexe}
                  onChange={setNpSexe}
                  options={[
                    { value: "M", label: "Masculin (M)" },
                    { value: "F", label: "Féminin (F)" },
                  ]}
                  placeholder="Non spécifié"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-tel">Téléphone</Label>
                <Input
                  id="np-tel"
                  value={npTelephone}
                  onChange={(e) => setNpTelephone(e.target.value)}
                  placeholder="Ex: +229 97 00 11 22"
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-langue">Langue d'accompagnement</Label>
                <SearchableSelect
                  value={npLangue}
                  onChange={setNpLangue}
                  options={[
                    { value: "fr", label: "Français" },
                    { value: "fon", label: "Fongbé" },
                  ]}
                  placeholder="Français"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-region">Région / Département</Label>
                <Input
                  id="np-region"
                  value={npRegion}
                  onChange={(e) => setNpRegion(e.target.value)}
                  placeholder="Ex: Littoral, Ouémé"
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-commune">Commune / Ville</Label>
                <Input
                  id="np-commune"
                  value={npCommune}
                  onChange={(e) => setNpCommune(e.target.value)}
                  placeholder="Ex: Cotonou, Porto-Novo"
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-naissance">Date de naissance</Label>
                <Input
                  id="np-naissance"
                  type="date"
                  value={npDateNaissance}
                  onChange={(e) => setNpDateNaissance(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-diagnostic">Date du diagnostic</Label>
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
                <Label htmlFor="np-soignant">Soignant référent affecté (Admin)</Label>
                <SearchableSelect
                  value={npSoignantId}
                  onChange={setNpSoignantId}
                  options={soignantsLookup ?? []}
                  placeholder="Affecter un soignant (optionnel)"
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
                <strong>Consentement médical explicite recueilli :</strong> Le patient a été informé et a donné son consentement libre pour le traitement confidentiel et le suivi sécurisé de ses données de santé sur la plateforme VIHEPAT.
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalNouveauOpen(false)} className="rounded-full">
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={creatingPatient || !npEmail || !npNom || !npPrenom || !npConsentement}
                className="rounded-full font-semibold shadow-sm"
              >
                {creatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer le dossier & Générer la fiche PDF
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
              Modifier le dossier patient
            </DialogTitle>
            <DialogDescription>
              Code patient : <span className="font-mono font-bold text-primary">{patientEnModification?.codePatient}</span>
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
                <Label htmlFor="edit-prenom">Prénom *</Label>
                <Input
                  id="edit-prenom"
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  required
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-nom">Nom *</Label>
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
              <Label htmlFor="edit-email">Email sécurisé *</Label>
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
                <Label htmlFor="edit-patho">Pathologie suivie *</Label>
                <SearchableSelect
                  value={editPathologie}
                  onChange={setEditPathologie}
                  options={PATHOLOGIE_OPTIONS}
                  placeholder="Sélectionner"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sexe">Sexe</Label>
                <SearchableSelect
                  value={editSexe}
                  onChange={setEditSexe}
                  options={[
                    { value: "M", label: "Masculin (M)" },
                    { value: "F", label: "Féminin (F)" },
                  ]}
                  placeholder="Non spécifié"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tel">Téléphone</Label>
                <Input
                  id="edit-tel"
                  value={editTelephone}
                  onChange={(e) => setEditTelephone(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-langue">Langue préférée</Label>
                <SearchableSelect
                  value={editLangue}
                  onChange={setEditLangue}
                  options={[
                    { value: "fr", label: "Français" },
                    { value: "fon", label: "Fongbé" },
                  ]}
                  placeholder="Français"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-region">Région</Label>
                <Input
                  id="edit-region"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-commune">Commune</Label>
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
                <Label htmlFor="edit-naissance">Date de naissance</Label>
                <Input
                  id="edit-naissance"
                  type="date"
                  value={editDateNaissance}
                  onChange={(e) => setEditDateNaissance(e.target.value)}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-diagnostic">Date du diagnostic</Label>
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
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updatingPatient || !editEmail || !editNom || !editPrenom}
                className="rounded-full font-semibold shadow-sm"
              >
                {updatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer les modifications
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
              Rattacher un patient existant
            </DialogTitle>
            <DialogDescription>
              Renseignez le code unique du patient pour l'ajouter à votre liste active de suivi.
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
              <Label htmlFor="code-rattacher">Code Patient Unique (ex: VHP-2026-XXXXXX) *</Label>
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
                Annuler
              </Button>
              <Button type="submit" disabled={attachingPatient || !codeRattacher.trim()} className="rounded-full font-semibold">
                {attachingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rattacher le patient
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
              Dossier & Fiche d'accès créés avec succès !
            </DialogTitle>
            <DialogDescription>
              Le téléchargement de la <strong>fiche d'accès PDF officielle</strong> a été déclenché. Vous pouvez également l'imprimer directement pour la remettre en main propre au patient.
            </DialogDescription>
          </DialogHeader>

          {fichePdfData && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4 space-y-2.5 font-mono text-sm">
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    Patient
                  </span>
                  <span className="font-bold text-foreground">
                    {fichePdfData.patient.prenom} {fichePdfData.patient.nom}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    Code Patient Unique
                  </span>
                  <span className="text-base font-extrabold text-primary">
                    {fichePdfData.patient.codePatient}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    Identifiant de connexion (Email)
                  </span>
                  <span className="font-bold text-foreground">{fichePdfData.patient.email}</span>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-muted-foreground block">
                    Mot de passe temporaire initial
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
                          `Identifiants VIHEPAT:\nEmail: ${fichePdfData.patient.email}\nCode: ${fichePdfData.patient.codePatient}\nMot de passe: ${fichePdfData.motDePasseTemporaire}`
                        );
                        toast.success("Identifiants copiés dans le presse-papier !");
                      }}
                      className="h-7 gap-1 text-xs"
                    >
                      <Copy className="h-3 w-3" /> Copier
                    </Button>
                  </div>
                </div>
              </div>

              {/* Boutons d'action pour la fiche PDF */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  onClick={() => {
                    telechargerFichePatientPdf(fichePdfData);
                    toast.success("Fiche d'accès PDF téléchargée !");
                  }}
                  className="rounded-full gap-2 font-semibold shadow-sm"
                >
                  <FileDown className="h-4 w-4" />
                  Télécharger le PDF
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    imprimerFichePatient(fichePdfData);
                  }}
                  className="rounded-full gap-2 font-semibold"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer la fiche (A4)
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                Ce document officiel contient toutes les instructions pour la première connexion du patient.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setFichePdfData(null)}
              className="w-full rounded-full font-semibold"
            >
              Fermer
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
              Réinitialiser les identifiants d'accès
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de générer un <strong>nouveau mot de passe temporaire</strong> pour le patient{" "}
              <strong>
                {patientEnReinitialisation?.user.prenom} {patientEnReinitialisation?.user.nom}
              </strong>{" "}
              ({patientEnReinitialisation?.codePatient}).
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-2">
            <p>• L'ancien mot de passe du patient ne sera plus valide.</p>
            <p>
              • Une nouvelle <strong>Fiche d'accès PDF officielle</strong> contenant ses nouveaux identifiants sera générée et téléchargée immédiatement.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPatientEnReinitialisation(null)}
              className="rounded-full"
            >
              Annuler
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
              Confirmer & Télécharger la nouvelle fiche PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
