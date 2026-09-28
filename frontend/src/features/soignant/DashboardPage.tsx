import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Users, CalendarDays, AlertCircle, Loader2, Search, Check, UserPlus, ChevronRight, Plus, BellRing, BellOff,
  Activity, Copy, Globe, FileDown, Printer, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type CreatePatientResult } from "@/api/soignant.api";
import { adminApi } from "@/api/admin.api";
import type { Pathologie } from "@/api/patient.api";
import { useAuthStore } from "@/store/auth.store";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api-error";
import { formatTaux, tauxStyle } from "@/lib/observance";
import { telechargerFichePatientPdf, imprimerFichePatient, type PatientCredentialsDoc } from "@/lib/patient-pdf";

const PATHOLOGIE_VALUES: Pathologie[] = ["vih", "vhb", "vhc", "vih_vhb", "vih_vhc", "vhb_vhc"];

function initials(nom: string, prenom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

const KPI_TINTS = {
  brand: { chip: "bg-secondary", icon: "text-primary", blob: "from-primary/10" },
  success: { chip: "bg-success/10", icon: "text-success", blob: "from-success/10" },
  gold: { chip: "bg-gold/15", icon: "text-gold", blob: "from-gold/10" },
  violet: { chip: "bg-violet/10", icon: "text-violet", blob: "from-violet/10" },
} as const;

function KpiCard({
  icon: Icon, label, value, tint,
}: { icon: LucideIcon; label: string; value: string | number; tint: keyof typeof KPI_TINTS }) {
  const c = KPI_TINTS[tint];
  return (
    <div className="relative overflow-hidden rounded-card bg-card p-5 shadow-dash">
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${c.icon} opacity-[0.07]`} />
      <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ${c.chip}`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <p className="relative mt-4 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="relative mt-1 text-3xl font-extrabold text-foreground">{value}</p>
      <div className={`absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t ${c.blob} to-transparent`} />
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const estAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [rattacherOpen, setRattacherOpen] = useState(false);
  const [codePatient, setCodePatient] = useState("");
  const [rdvOpen, setRdvOpen] = useState(false);
  const [rdvPatientId, setRdvPatientId] = useState("");
  const [rdvDateHeure, setRdvDateHeure] = useState("");
  const [rdvMotif, setRdvMotif] = useState("");
  const [nouveauPatientOpen, setNouveauPatientOpen] = useState(false);
  const [npEmail, setNpEmail] = useState("");
  const [npNom, setNpNom] = useState("");
  const [npPrenom, setNpPrenom] = useState("");
  const [npPathologie, setNpPathologie] = useState<Pathologie>("vih");
  const [npSexe, setNpSexe] = useState<"" | "M" | "F">("");
  const [npTelephone, setNpTelephone] = useState("");
  const [npSoignantId, setNpSoignantId] = useState("");
  const [npConsentement, setNpConsentement] = useState(false);
  const [identifiantsGeneres, setIdentifiantsGeneres] = useState<CreatePatientResult | null>(null);

  const { data: soignantsLookup } = useQuery({
    queryKey: ["admin", "lookup", "soignants"],
    queryFn: () => adminApi.getLookup("soignants"),
    enabled: estAdmin,
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
  }

  const { mutate: rattacher, isPending: rattachement } = useMutation({
    mutationFn: () => soignantApi.rattacherPatient(codePatient),
    onSuccess: (patient) => {
      toast.success(t("dashboard_soignant.toast_rattacher_success"));
      setRattacherOpen(false);
      setCodePatient("");
      queryClient.invalidateQueries({ queryKey: ["soignant"] });
      navigate(`/soignant/patients/${patient.id}`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("dashboard_soignant.toast_rattacher_error"))),
  });

  function resetNouveauPatientForm() {
    setNpEmail("");
    setNpNom("");
    setNpPrenom("");
    setNpPathologie("vih");
    setNpSexe("");
    setNpTelephone("");
    setNpSoignantId("");
    setNpConsentement(false);
  }

  const { mutate: creerNouveauPatient, isPending: creationPatient } = useMutation({
    mutationFn: () =>
      soignantApi.creerPatient({
        email: npEmail,
        nom: npNom,
        prenom: npPrenom,
        pathologie: npPathologie,
        consentementDonne: npConsentement,
        ...(npSexe ? { sexe: npSexe } : {}),
        ...(npTelephone ? { telephone: npTelephone } : {}),
        ...(estAdmin && npSoignantId ? { soignantId: Number(npSoignantId) } : {}),
      }),
    onSuccess: (result) => {
      setNouveauPatientOpen(false);
      resetNouveauPatientForm();
      setIdentifiantsGeneres(result);
      queryClient.invalidateQueries({ queryKey: ["soignant"] });

      const doc: PatientCredentialsDoc = {
        patient: {
          prenom: result.patient.user.prenom,
          nom: result.patient.user.nom,
          codePatient: result.patient.codePatient,
          email: result.patient.user.email,
          pathologie: result.patient.pathologie,
          telephone: npTelephone || null,
        },
        motDePasseTemporaire: result.motDePasseTemporaire,
        structure: estAdmin ? "Direction Nationale VIHEPAT" : "Centre Hospitalier Référent",
        emetteurNom: user ? `${user.prenom} ${user.nom}` : undefined,
        dateCreation: new Date().toLocaleDateString("fr-FR"),
      };
      telechargerFichePatientPdf(doc);
      toast.success("Dossier créé & Fiche d'accès PDF téléchargée !");
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("dashboard_soignant.toast_creer_patient_error"))),
  });

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

  const observanceMoyenne = useMemo(() => {
    if (!patients || patients.length === 0) return null;
    const valeurs = patients
      .map((p) => p.observance?.taux30)
      .filter((v): v is number => typeof v === "number");
    if (valeurs.length === 0) return null;
    return Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
  }, [patients]);

  const { mutate: confirmRdv } = useMutation({
    mutationFn: (id: number) => soignantApi.updateRendezVous(id, { statut: "confirme" }),
    onSuccess: () => {
      toast.success(t("dashboard_soignant.toast_rdv_confirme"));
      queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
    },
    onError: () => toast.error(t("dashboard_soignant.toast_rdv_error")),
  });

  const { mutate: creerRdv, isPending: creationRdv } = useMutation({
    mutationFn: () =>
      soignantApi.createRendezVous({
        patientId: Number(rdvPatientId), dateHeure: rdvDateHeure, ...(rdvMotif ? { motif: rdvMotif } : {}),
      }),
    onSuccess: () => {
      toast.success(t("dashboard_soignant.toast_rdv_cree"));
      setRdvOpen(false);
      setRdvPatientId("");
      setRdvDateHeure("");
      setRdvMotif("");
      queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("dashboard_soignant.toast_rdv_error"))),
  });

  const { mutate: envoyerRappel, isPending: rappelEnCours, variables: rappelId } = useMutation({
    mutationFn: (id: number) => soignantApi.envoyerRappelRdv(id),
    onSuccess: () => {
      toast.success(t("dashboard_soignant.toast_rappel_envoye"));
      queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
    },
    onError: () => toast.error(t("dashboard_soignant.toast_rappel_error")),
  });

  const { mutate: markSignalement } = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: "vu" | "traite" }) =>
      soignantApi.updateSignalement(id, statut),
    onSuccess: () => {
      toast.success(t("dashboard_soignant.toast_signalement_maj"));
      queryClient.invalidateQueries({ queryKey: ["soignant", "signalements"] });
    },
    onError: () => toast.error(t("dashboard_soignant.toast_signalement_error")),
  });

  return (
    <AppShell title="Espace soignant">
      {/* Bannière d'accueil */}
      <section className="relative overflow-hidden rounded-card bg-[linear-gradient(135deg,hsl(var(--brand))_0%,hsl(var(--brand-light))_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-28 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-extrabold text-primary-foreground sm:text-3xl">
              {t("dashboard_soignant.greeting", { prenom: user?.prenom })}
            </h1>
            <p className="mt-2 max-w-md text-primary-foreground/85">{t("dashboard_soignant.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-full border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20 gap-2 font-semibold",
              )}
            >
              <Globe className="h-4 w-4" /> Site public
            </Link>
            <Button
              className="h-11 rounded-full bg-white px-5 text-primary hover:bg-white/90 font-semibold"
              onClick={() => setNouveauPatientOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" /> {t("dashboard_soignant.hero_nouveau_patient")}
            </Button>
            <a
              href="#patients-section"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-full border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20",
              )}
            >
              {t("dashboard_soignant.hero_liste_complete")}
            </a>
          </div>
        </div>
      </section>

      {/* KPI */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} label={t("dashboard_soignant.stat_patients")} value={patients?.length ?? 0} tint="brand" />
        <KpiCard icon={CalendarDays} label={t("dashboard_soignant.stat_rdv")} value={rendezVous?.length ?? 0} tint="success" />
        <KpiCard
          icon={AlertCircle}
          label={t("dashboard_soignant.stat_signalements")}
          value={signalements?.filter((s) => s.statut === "nouveau").length ?? 0}
          tint="gold"
        />
        <KpiCard
          icon={Activity}
          label={t("dashboard_soignant.stat_observance")}
          value={observanceMoyenne === null ? "—" : `${observanceMoyenne} %`}
          tint="violet"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Patients */}
        <section id="patients-section" className="min-w-0 rounded-card bg-card p-6 shadow-dash lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">{t("dashboard_soignant.patients_title")}</h2>
            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-48">

                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("dashboard_soignant.patients_search_placeholder")}
                  className="h-10 rounded-full pl-9"
                />
              </div>
              <Button size="sm" className="h-10 rounded-full" onClick={() => setRattacherOpen(true)}>
                <UserPlus className="mr-1 h-4 w-4" /> {t("dashboard_soignant.patients_ajouter")}
              </Button>
            </div>
          </div>
          {patientsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !patients || patients.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("dashboard_soignant.patients_empty")}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {patients.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/soignant/patients/${p.id}`}
                    className="flex items-center gap-4 rounded-input border-2 border-border p-4 transition-colors duration-150 hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                      {initials(p.user.nom, p.user.prenom)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{p.user.prenom} {p.user.nom}</p>
                      <p className="text-sm text-muted-foreground">{p.codePatient}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                        {t(`shared.pathologie.${p.pathologie}`, { defaultValue: p.pathologie })}
                      </span>
                      <div className="flex gap-1">
                        {!!p.examensEnRetard && (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive" title={t("dashboard_soignant.examens_retard", { count: p.examensEnRetard })}>
                            {t("dashboard_soignant.examens_retard", { count: p.examensEnRetard })}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tauxStyle(p.observance?.taux30)}`}
                          title={t("dashboard_soignant.obs_label", { taux: formatTaux(p.observance?.taux30) })}
                        >
                          {t("dashboard_soignant.obs_label", { taux: formatTaux(p.observance?.taux30) })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />

                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-6 lg:col-span-2">

          {/* Rendez-vous */}
          <section className="rounded-card bg-card p-6 shadow-dash">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{t("dashboard_soignant.rdv_title")}</h2>
              <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => setRdvOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> {t("dashboard_soignant.rdv_ajouter")}
              </Button>
            </div>
            {rdvLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !rendezVous || rendezVous.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("dashboard_soignant.rdv_empty")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rendezVous.map((rdv) => (
                  <li key={rdv.id} className="rounded-input bg-secondary p-4">
                    <p className="font-semibold text-foreground">
                      {rdv.patient.user.prenom} {rdv.patient.user.nom}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(rdv.dateHeure)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                        {t(`shared.statut_rdv.${rdv.statut}`, { defaultValue: rdv.statut })}
                      </span>
                      <div className="flex items-center gap-1">
                        {rdv.rappelEnvoyeLe ? (
                          <span className="flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            <BellOff className="h-3.5 w-3.5" /> {t("dashboard_soignant.rappel_envoye")}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-full text-muted-foreground"
                            disabled={rappelEnCours && rappelId === rdv.id}
                            onClick={() => envoyerRappel(rdv.id)}
                          >
                            {rappelEnCours && rappelId === rdv.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <BellRing className="mr-1 h-3.5 w-3.5" />
                            )}
                            {t("dashboard_soignant.rappel_envoyer")}
                          </Button>
                        )}
                        {rdv.statut === "prevu" && (
                          <Button size="sm" variant="ghost" className="h-7 rounded-full text-primary" onClick={() => confirmRdv(rdv.id)}>
                            <Check className="mr-1 h-3.5 w-3.5" /> {t("dashboard_soignant.rdv_confirmer")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Signalements */}
          <section className="rounded-card bg-card p-6 shadow-dash">
            <h2 className="text-lg font-bold text-foreground">{t("dashboard_soignant.signalements_title")}</h2>
            {signalementsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !signalements || signalements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("dashboard_soignant.signalements_empty")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {signalements.map((s) => (
                  <li key={s.id} className="rounded-input bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{s.patient.user.prenom} {s.patient.user.nom}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.gravite === "leger" ? "bg-secondary text-primary" : s.gravite === "modere" ? "bg-gold/15 text-gold" : "bg-destructive/15 text-destructive"
                      }`}>
                        {t(`shared.gravite.${s.gravite}`, { defaultValue: s.gravite })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{s.symptome}</p>
                    {s.notes && <p className="mt-1 text-sm text-muted-foreground">{s.notes}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                      {s.statut !== "traite" && (
                        <div className="flex gap-2">
                          {s.statut === "nouveau" && (
                            <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => markSignalement({ id: s.id, statut: "vu" })}>
                              {t("dashboard_soignant.marquer_vu")}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 rounded-full text-primary" onClick={() => markSignalement({ id: s.id, statut: "traite" })}>
                            {t("dashboard_soignant.marquer_traite")}
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

      <Dialog open={rattacherOpen} onOpenChange={setRattacherOpen}>
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard_soignant.rattacher_dialog_title")}</DialogTitle>
            <DialogDescription>
              {t("dashboard_soignant.rattacher_dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rattacher();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="codePatient">{t("dashboard_soignant.rattacher_code_label")}</Label>
              <Input
                id="codePatient"
                value={codePatient}
                onChange={(e) => setCodePatient(e.target.value.toUpperCase())}
                placeholder="VHP-2026-123456"
                required
                autoFocus
                className="h-11 rounded-input font-mono tracking-wide"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={rattachement || codePatient.trim().length < 3} className="w-full rounded-full">
                {rattachement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("dashboard_soignant.rattacher_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rdvOpen} onOpenChange={setRdvOpen}>
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard_soignant.rdv_dialog_title")}</DialogTitle>
            <DialogDescription>{t("dashboard_soignant.rdv_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              creerRdv();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="rdvPatient">{t("dashboard_soignant.rdv_dialog_patient")}</Label>
              <SearchableSelect
                id="rdvPatient"
                value={rdvPatientId}
                onChange={setRdvPatientId}
                options={(patients ?? []).map((p) => ({ value: String(p.id), label: `${p.user.prenom} ${p.user.nom}` }))}
                placeholder={t("dashboard_soignant.rdv_dialog_patient")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rdvDateHeure">{t("dashboard_patient.rdv_dialog_date")}</Label>
              <Input
                id="rdvDateHeure"
                type="datetime-local"
                value={rdvDateHeure}
                onChange={(e) => setRdvDateHeure(e.target.value)}
                required
                className="h-11 rounded-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rdvMotif">{t("dashboard_patient.rdv_dialog_motif")}</Label>
              <Input
                id="rdvMotif"
                value={rdvMotif}
                onChange={(e) => setRdvMotif(e.target.value)}
                placeholder={t("dashboard_patient.rdv_dialog_motif_placeholder")}
                className="h-11 rounded-input"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creationRdv || !rdvPatientId || !rdvDateHeure} className="w-full rounded-full">
                {creationRdv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("dashboard_soignant.rdv_dialog_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={nouveauPatientOpen} onOpenChange={(o) => { setNouveauPatientOpen(o); if (!o) resetNouveauPatientForm(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard_soignant.np_dialog_title")}</DialogTitle>
            <DialogDescription>{t("dashboard_soignant.np_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              creerNouveauPatient();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="npPrenom">{t("auth.first_name")}</Label>
                <Input id="npPrenom" value={npPrenom} onChange={(e) => setNpPrenom(e.target.value)} required className="h-11 rounded-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npNom">{t("auth.last_name")}</Label>
                <Input id="npNom" value={npNom} onChange={(e) => setNpNom(e.target.value)} required className="h-11 rounded-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="npEmail">{t("auth.email")}</Label>
              <Input
                id="npEmail"
                type="email"
                value={npEmail}
                onChange={(e) => setNpEmail(e.target.value)}
                required
                className="h-11 rounded-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npPathologie">{t("auth.pathologie_label")}</Label>
              <SearchableSelect
                id="npPathologie"
                value={npPathologie}
                onChange={(v) => setNpPathologie(v as Pathologie)}
                options={PATHOLOGIE_VALUES.map((p) => ({ value: p, label: t(`shared.pathologie.${p}`) }))}
                placeholder={t("auth.pathologie_label")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="npSexe">{t("dashboard_soignant.np_sexe")}</Label>
                <SearchableSelect
                  id="npSexe"
                  value={npSexe}
                  onChange={(v) => setNpSexe(v as "M" | "F")}
                  options={[{ value: "F", label: t("patient_detail.femme") }, { value: "M", label: t("patient_detail.homme") }]}
                  placeholder={t("dashboard_soignant.np_sexe")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npTelephone">{t("dashboard_soignant.np_telephone")}</Label>
                <Input id="npTelephone" value={npTelephone} onChange={(e) => setNpTelephone(e.target.value)} className="h-11 rounded-input" />
              </div>
            </div>
            {estAdmin && (
              <div className="space-y-2">
                <Label htmlFor="npSoignant">Soignant référent assigné</Label>
                <SearchableSelect
                  id="npSoignant"
                  value={npSoignantId}
                  onChange={setNpSoignantId}
                  options={soignantsLookup ?? []}
                  placeholder="Choisir un soignant référent (optionnel)"
                />
              </div>
            )}
            <div className="flex items-start gap-3 rounded-input bg-secondary/60 p-4">
              <Checkbox
                id="npConsentement"
                checked={npConsentement}
                onCheckedChange={(v) => setNpConsentement(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="npConsentement" className="text-sm font-normal leading-relaxed text-foreground">
                {t("dashboard_soignant.np_consentement")}
              </Label>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={creationPatient || !npEmail || !npNom || !npPrenom || !npConsentement}
                className="w-full rounded-full"
              >
                {creationPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("dashboard_soignant.np_submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!identifiantsGeneres} onOpenChange={(o) => !o && setIdentifiantsGeneres(null)}>
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard_soignant.np_success_title")}</DialogTitle>
            <DialogDescription>{t("dashboard_soignant.np_success_desc")}</DialogDescription>
          </DialogHeader>
          {identifiantsGeneres && (
            <div className="space-y-3">
              <div className="rounded-input bg-secondary p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dashboard_soignant.np_code_patient")}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-foreground">{identifiantsGeneres.patient.codePatient}</p>
              </div>
              <div className="rounded-input bg-secondary p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dashboard_soignant.np_mot_de_passe")}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-foreground">{identifiantsGeneres.motDePasseTemporaire}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => {
                    const doc: PatientCredentialsDoc = {
                      patient: {
                        prenom: identifiantsGeneres.patient.user.prenom,
                        nom: identifiantsGeneres.patient.user.nom,
                        codePatient: identifiantsGeneres.patient.codePatient,
                        email: identifiantsGeneres.patient.user.email,
                        pathologie: identifiantsGeneres.patient.pathologie,
                      },
                      motDePasseTemporaire: identifiantsGeneres.motDePasseTemporaire,
                      structure: estAdmin ? "Direction Nationale VIHEPAT" : "Centre Hospitalier Référent",
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
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const doc: PatientCredentialsDoc = {
                      patient: {
                        prenom: identifiantsGeneres.patient.user.prenom,
                        nom: identifiantsGeneres.patient.user.nom,
                        codePatient: identifiantsGeneres.patient.codePatient,
                        email: identifiantsGeneres.patient.user.email,
                        pathologie: identifiantsGeneres.patient.pathologie,
                      },
                      motDePasseTemporaire: identifiantsGeneres.motDePasseTemporaire,
                      structure: estAdmin ? "Direction Nationale VIHEPAT" : "Centre Hospitalier Référent",
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

              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-full"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(
                      `Code patient : ${identifiantsGeneres.patient.codePatient}\nMot de passe : ${identifiantsGeneres.motDePasseTemporaire}`,
                    )
                    .then(() => toast.success(t("dashboard_soignant.np_copie")))
                    .catch(() => {});
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> {t("dashboard_soignant.np_copier")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("dashboard_soignant.np_success_hint")}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" className="w-full rounded-full" onClick={() => setIdentifiantsGeneres(null)}>
              {t("dashboard_soignant.np_fermer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
