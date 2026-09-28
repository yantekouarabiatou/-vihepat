import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, FlaskConical, Pill, Plus, Loader2, ShieldCheck, AlertCircle, CalendarDays, Square, Activity,
  FileDown, Printer, Edit3, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { soignantApi, type PatientDetail } from "@/api/soignant.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DataTable } from "@/components/ui/data-table";
import {
  NIVEAU_STYLES, OBSERVATION_TYPES, repereObservation, type TypeObservation,
} from "@/lib/observations";
import { apiErrorMessage } from "@/lib/api-error";
import { ObservanceBars, formatTaux, libelleEcheance, tauxStyle } from "@/lib/observance";
import { telechargerFichePatientPdf, imprimerFichePatient, type PatientCredentialsDoc } from "@/lib/patient-pdf";

const useT = useTranslation;

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function age(dateNaissance: string | null) {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] ${className}`}>{children}</section>;
}

function SectionTitle({ icon: Icon, title, action }: {
  icon: typeof Pill; title: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PatientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const patientId = Number(id);
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);

  const { data: patient, isLoading, isError, error } = useQuery({
    queryKey: ["soignant", "patient", patientId],
    queryFn: () => soignantApi.getPatient(patientId),
    enabled: Number.isInteger(patientId) && patientId > 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["soignant", "patient", patientId] });

  const { mutate: reinitialiserAcces, isPending: resetting } = useMutation({
    mutationFn: () => soignantApi.reinitialiserAcces(patientId),
    onSuccess: (res) => {
      setResetOpen(false);
      toast.success("Nouveaux identifiants générés !");
      invalidate();
      const doc: PatientCredentialsDoc = {
        patient: {
          prenom: res.patient.user.prenom,
          nom: res.patient.user.nom,
          codePatient: res.patient.codePatient,
          email: res.patient.user.email,
          pathologie: res.patient.pathologie,
          telephone: res.patient.telephone,
          sexe: res.patient.sexe,
        },
        motDePasseTemporaire: res.motDePasseTemporaire,
        structure: "Centre Hospitalier Référent VIHEPAT",
        dateCreation: new Date().toLocaleDateString("fr-FR"),
      };
      telechargerFichePatientPdf(doc);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Erreur lors de la réinitialisation des identifiants")),
  });

  if (isLoading) {
    return (
      <AppShell title="Espace soignant">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (isError || !patient) {
    return (
      <AppShell title="Espace soignant">
        <BackLink />
        <p className="mt-10 text-center text-muted-foreground">
          {apiErrorMessage(error, t("patient_detail.dossier_introuvable"))}
        </p>
      </AppShell>
    );
  }

  const a = age(patient.dateNaissance);

  return (
    <AppShell title="Espace soignant">
      <BackLink />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {patient.user.prenom} {patient.user.nom}
          </h1>
          <p className="mt-1 text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{patient.codePatient}</span>
            {" · "}{t(`shared.pathologie.${patient.pathologie}`, { defaultValue: patient.pathologie })}
            {a !== null && <> · {t("patient_detail.age", { age: a })}</>}
            {patient.sexe && <> · {patient.sexe === "F" ? t("patient_detail.femme") : t("patient_detail.homme")}</>}
            {patient.commune && <> · {patient.commune}</>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("patient_detail.diagnostic_label")} : {formatDate(patient.dateDiagnostic)} · {t("patient_detail.langue_label")} : {patient.languePreferee.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const doc: PatientCredentialsDoc = {
                patient: {
                  prenom: patient.user.prenom,
                  nom: patient.user.nom,
                  codePatient: patient.codePatient,
                  email: patient.user.email,
                  pathologie: patient.pathologie,
                  telephone: patient.telephone,
                  sexe: patient.sexe,
                },
                motDePasseTemporaire: "******** (Initialisé)",
                structure: "Centre Hospitalier Référent VIHEPAT",
                dateCreation: new Date(patient.createdAt).toLocaleDateString("fr-FR"),
              };
              telechargerFichePatientPdf(doc);
              toast.success(`Fiche PDF téléchargée pour ${patient.codePatient}`);
            }}
            className="rounded-full gap-1.5 text-xs font-semibold"
          >
            <FileDown className="h-3.5 w-3.5 text-primary" />
            Fiche PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const doc: PatientCredentialsDoc = {
                patient: {
                  prenom: patient.user.prenom,
                  nom: patient.user.nom,
                  codePatient: patient.codePatient,
                  email: patient.user.email,
                  pathologie: patient.pathologie,
                  telephone: patient.telephone,
                  sexe: patient.sexe,
                },
                motDePasseTemporaire: "******** (Initialisé)",
                structure: "Centre Hospitalier Référent VIHEPAT",
                dateCreation: new Date(patient.createdAt).toLocaleDateString("fr-FR"),
              };
              imprimerFichePatient(doc);
            }}
            className="rounded-full gap-1.5 text-xs font-semibold"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setResetOpen(true)}
            className="rounded-full gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            title="Générer un nouveau mot de passe temporaire et ré-émettre la fiche d'accès PDF"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Réinitialiser accès
          </Button>

          <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            {t("patient_detail.tracked_banner")}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <BilanSection patient={patient} onSaved={invalidate} />
        </div>
        <div className="min-w-0 space-y-6 lg:col-span-2">

          <ObservanceCard patient={patient} />
          <TraitementsSection patient={patient} onSaved={invalidate} />
          <SignalementsSection patient={patient} />
          <RendezVousSection patient={patient} />
        </div>
      </div>

      {/* Modal confirmation réinitialisation accès */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600 dark:text-amber-400">
              <KeyRound className="h-5 w-5" />
              Réinitialiser les identifiants
            </DialogTitle>
            <DialogDescription>
              Générer un <strong>nouveau mot de passe temporaire</strong> pour {patient.user.prenom} {patient.user.nom} ({patient.codePatient}).
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-2">
            <p>• L'ancien mot de passe du patient deviendra immédiatement caduc.</p>
            <p>• Une nouvelle <strong>Fiche d'accès PDF officielle</strong> sera générée et téléchargée immédiatement.</p>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setResetOpen(false)} className="rounded-full">
              Annuler
            </Button>
            <Button
              disabled={resetting}
              onClick={() => reinitialiserAcces()}
              className="rounded-full font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer & Télécharger la fiche PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ObservanceCard({ patient }: { patient: PatientDetail }) {
  const { t } = useT();
  const { observance, alertesExamens } = patient;
  return (
    <Card>
      <SectionTitle icon={Activity} title={t("patient_detail.observance_title")} />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-2xl p-3 ${tauxStyle(observance.taux7)}`}>
          <p className="text-xl font-extrabold">{formatTaux(observance.taux7)}</p>
          <p className="text-xs font-medium">{t("patient_detail.jours7")}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tauxStyle(observance.taux30)}`}>
          <p className="text-xl font-extrabold">{formatTaux(observance.taux30)}</p>
          <p className="text-xs font-medium">{t("patient_detail.jours30")}</p>
        </div>
        <div className="rounded-2xl bg-secondary p-3 text-primary">
          <p className="text-xl font-extrabold">{observance.serie}</p>
          <p className="text-xs font-medium">{t("patient_detail.jours_sans_oubli")}</p>
        </div>
      </div>
      <div className="mt-4">
        <ObservanceBars jours={observance.jours} />
      </div>
      {observance.nonRenseignees30 > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("patient_detail.non_renseignees", { count: observance.nonRenseignees30 })}
        </p>
      )}
      {alertesExamens.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground">{t("patient_detail.examens_programmer")}</h3>
          {alertesExamens.map((al) => (
            <div key={al.type} className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2">
              <span className="text-sm text-foreground">{t(`observations.types.${al.type}`, { defaultValue: al.libelle })}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  al.statut === "en_retard" ? "bg-destructive/15 text-destructive" : "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]"
                }`}
              >
                {libelleEcheance(al, t)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BackLink() {
  const { t } = useT();
  return (
    <Link to="/soignant/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary">
      <ArrowLeft className="mr-1 h-4 w-4" /> {t("patient_detail.back_link")}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Bilan biologique                                                    */
/* ------------------------------------------------------------------ */

function BilanSection({ patient, onSaved }: { patient: PatientDetail; onSaved: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const derniers = useMemo(() => {
    const map = new Map<string, PatientDetail["observations"][number]>();
    for (const o of patient.observations) if (!map.has(o.type)) map.set(o.type, o);
    return Array.from(map.values());
  }, [patient.observations]);

  const typesAvecHistorique = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of patient.observations) counts.set(o.type, (counts.get(o.type) ?? 0) + 1);
    return Array.from(counts.entries()).filter(([, n]) => n >= 2).map(([tp]) => tp);
  }, [patient.observations]);

  const [typeCourbe, setTypeCourbe] = useState<string | null>(null);
  const courbe = typeCourbe && typesAvecHistorique.includes(typeCourbe) ? typeCourbe : typesAvecHistorique[0] ?? null;

  const donneesCourbe = useMemo(
    () =>
      courbe
        ? patient.observations
            .filter((o) => o.type === courbe)
            .slice()
            .reverse()
            .map((o) => ({ date: formatDate(o.datePrelevement), valeur: o.valeur, unite: o.unite }))
        : [],
    [courbe, patient.observations],
  );

  const labelObs = (type: string) => t(`observations.types.${type}`, { defaultValue: type });

  return (
    <>
      <Card>
        <SectionTitle
          icon={FlaskConical}
          title={t("patient_detail.bilan_title")}
          action={
            <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("patient_detail.saisir_resultat")}
            </Button>
          }
        />

        {derniers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("patient_detail.aucun_resultat")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {derniers.map((o) => {
              const repere = repereObservation(o.type, o.valeur);
              return (
                <div key={o.id} className="rounded-2xl bg-secondary p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {labelObs(o.type)}
                    </span>
                    {repere && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${NIVEAU_STYLES[repere.niveau]}`}>
                        {t(`observations.reperes.${repere.label}`, { defaultValue: repere.label })}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-foreground">
                    {o.valeur.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">{o.unite}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("patient_detail.preleve_le", { date: formatDate(o.datePrelevement) })}</p>
                </div>
              );
            })}
          </div>
        )}

        {courbe && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">{t("patient_detail.evolution_title")}</h3>
              <div className="flex flex-wrap gap-1">
                {typesAvecHistorique.map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTypeCourbe(tp)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      tp === courbe ? "bg-primary text-primary-foreground" : "bg-secondary text-primary hover:bg-secondary/70"
                    }`}
                  >
                    {labelObs(tp)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={donneesCourbe} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} width={56} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(v, _n, item) => [
                      `${Number(v).toLocaleString()} ${String(item.payload?.unite ?? "")}`,
                      labelObs(courbe),
                    ]}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="valeur" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {patient.observations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-foreground">{t("patient_detail.historique_title")}</h3>
            <div className="mt-2">
              <DataTable
                data={patient.observations}
                getRowKey={(o) => o.id}
                searchPlaceholder={t("patient_detail.historique_search")}
                emptyText={t("patient_detail.historique_aucun_resultat")}
                searchText={(o) =>
                  `${labelObs(o.type)} ${o.soignant ? `${o.soignant.user.prenom} ${o.soignant.user.nom}` : ""} ${formatDate(o.datePrelevement)}`
                }
                columns={[
                  {
                    key: "date",
                    header: t("patient_detail.th_date"),
                    sortValue: (o) => o.datePrelevement ?? "",
                    render: (o) => <span className="whitespace-nowrap">{formatDate(o.datePrelevement)}</span>,
                  },
                  {
                    key: "examen",
                    header: t("patient_detail.th_examen"),
                    sortValue: (o) => labelObs(o.type),
                    render: (o) => labelObs(o.type),
                  },
                  {
                    key: "resultat",
                    header: t("patient_detail.th_resultat"),
                    sortValue: (o) => o.valeur,
                    render: (o) => (
                      <span className="whitespace-nowrap font-semibold">
                        {o.valeur.toLocaleString()} {o.unite}
                      </span>
                    ),
                  },
                  {
                    key: "saisi_par",
                    header: t("patient_detail.th_saisi_par"),
                    sortValue: (o) => (o.soignant ? `${o.soignant.user.prenom} ${o.soignant.user.nom}` : ""),
                    render: (o) => (
                      <span className="text-muted-foreground">
                        {o.soignant ? `${o.soignant.user.prenom} ${o.soignant.user.nom}` : "-"}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Card>

      <ObservationDialog open={open} onOpenChange={setOpen} patientId={patient.id} onSaved={onSaved} />
    </>
  );
}

function ObservationDialog({ open, onOpenChange, patientId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; patientId: number; onSaved: () => void;
}) {
  const { t } = useT();
  const [type, setType] = useState<TypeObservation>("charge_virale");
  const [valeur, setValeur] = useState("");
  const [unite, setUnite] = useState("copies/mL");
  const [datePrelevement, setDatePrelevement] = useState(today());
  const [commentaire, setCommentaire] = useState("");

  function reset() {
    setType("charge_virale");
    setValeur("");
    setUnite("copies/mL");
    setDatePrelevement(today());
    setCommentaire("");
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      soignantApi.createObservation(patientId, {
        type,
        valeur: Number(valeur.replace(",", ".")),
        unite,
        datePrelevement,
        commentaire: commentaire.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("patient_detail.toast_obs_success"));
      reset();
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patient_detail.toast_obs_error"))),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("patient_detail.obs_dialog_title")}</DialogTitle>
          <DialogDescription>
            {t("patient_detail.obs_dialog_desc")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="obs-type">{t("patient_detail.obs_dialog_examen")}</Label>
            <SearchableSelect
              id="obs-type"
              value={type}
              onChange={(v) => {
                const tp = v as TypeObservation;
                setType(tp);
                setUnite(OBSERVATION_TYPES.find((o) => o.value === tp)?.unite ?? "");
              }}
              options={OBSERVATION_TYPES.map((o) => ({
                value: o.value, label: t(`observations.types.${o.value}`, { defaultValue: o.label }),
              }))}
              placeholder={t("patient_detail.obs_dialog_examen")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="obs-valeur">{t("patient_detail.obs_dialog_valeur")}</Label>
              <Input
                id="obs-valeur"
                inputMode="decimal"
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                placeholder={type === "ag_hbs" ? t("patient_detail.obs_dialog_valeur_placeholder_hbs") : t("patient_detail.obs_dialog_valeur_placeholder")}
                required
                pattern="[0-9]+([.,][0-9]+)?"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-unite">{t("patient_detail.obs_dialog_unite")}</Label>
              <Input id="obs-unite" value={unite} onChange={(e) => setUnite(e.target.value)} required className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs-date">{t("patient_detail.obs_dialog_date")}</Label>
            <Input
              id="obs-date"
              type="date"
              value={datePrelevement}
              max={today()}
              onChange={(e) => setDatePrelevement(e.target.value)}
              required
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs-commentaire">{t("patient_detail.obs_dialog_commentaire")}</Label>
            <Textarea id="obs-commentaire" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full rounded-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("patient_detail.enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Traitements                                                         */
/* ------------------------------------------------------------------ */

function TraitementsSection({ patient, onSaved }: { patient: PatientDetail; onSaved: () => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const { mutate: arreter, isPending: arretEnCours, variables: arretId } = useMutation({
    mutationFn: (id: number) => soignantApi.updateTraitement(id, { actif: false }),
    onSuccess: () => {
      toast.success(t("patient_detail.toast_traitement_arrete"));
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patient_detail.toast_traitement_error"))),
  });

  return (
    <>
      <Card>
        <SectionTitle
          icon={Pill}
          title={t("patient_detail.traitements_title")}
          action={
            <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("patient_detail.prescrire")}
            </Button>
          }
        />
        {patient.traitements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("patient_detail.aucun_traitement")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {patient.traitements.map((tr) => (
              <li
                key={tr.id}
                className={`rounded-2xl border-2 p-4 ${tr.actif ? "border-border" : "border-dashed border-border opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold text-foreground">{tr.molecule}</p>
                  {tr.actif ? (
                    tr.heurePrise && (
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{tr.heurePrise}</span>
                    )
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{t("patient_detail.arrete_badge")}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[tr.dosage, tr.frequence].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t("patient_detail.depuis_le", { date: formatDate(tr.dateDebut) })}
                    {tr.dateFin && <> · {t("patient_detail.fin_le", { date: formatDate(tr.dateFin) })}</>}
                  </span>
                  {tr.actif && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full text-destructive"
                      disabled={arretEnCours && arretId === tr.id}
                      onClick={() => arreter(tr.id)}
                    >
                      <Square className="mr-1 h-3 w-3" /> {t("patient_detail.arreter_btn")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <TraitementDialog open={open} onOpenChange={setOpen} patientId={patient.id} onSaved={onSaved} />
    </>
  );
}

function TraitementDialog({ open, onOpenChange, patientId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; patientId: number; onSaved: () => void;
}) {
  const { t } = useT();
  const [molecule, setMolecule] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequence, setFrequence] = useState("1x/jour");
  const [heurePrise, setHeurePrise] = useState("08:00");
  const [dateDebut, setDateDebut] = useState(today());
  const [notes, setNotes] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      soignantApi.createTraitement(patientId, {
        molecule: molecule.trim(),
        dosage: dosage.trim() || undefined,
        frequence: frequence.trim(),
        heurePrise: heurePrise || undefined,
        dateDebut,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("patient_detail.toast_traitement_ajoute"));
      setMolecule("");
      setDosage("");
      setNotes("");
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("patient_detail.toast_traitement_ajoute_error"))),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("patient_detail.trait_dialog_title")}</DialogTitle>
          <DialogDescription>{t("patient_detail.trait_dialog_desc")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="t-molecule">{t("patient_detail.molecule")}</Label>
            <Input
              id="t-molecule"
              value={molecule}
              onChange={(e) => setMolecule(e.target.value)}
              placeholder={t("patient_detail.molecule_placeholder")}
              required
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-dosage">{t("patient_detail.dosage")}</Label>
              <Input id="t-dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="300/300/50 mg" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-frequence">{t("patient_detail.frequence")}</Label>
              <Input id="t-frequence" value={frequence} onChange={(e) => setFrequence(e.target.value)} required className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-heure">{t("patient_detail.heure_prise")}</Label>
              <Input id="t-heure" type="time" value={heurePrise} onChange={(e) => setHeurePrise(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-debut">{t("patient_detail.debut")}</Label>
              <Input id="t-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-notes">{t("patient_detail.consignes")}</Label>
            <Textarea id="t-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full rounded-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("patient_detail.ajouter_traitement")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Signalements & rendez-vous (lecture)                                */
/* ------------------------------------------------------------------ */

function SignalementsSection({ patient }: { patient: PatientDetail }) {
  const { t } = useT();
  return (
    <Card>
      <SectionTitle icon={AlertCircle} title={t("patient_detail.signalements_title")} />
      {patient.signalements.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("patient_detail.aucun_signalement")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {patient.signalements.map((s) => (
            <li key={s.id} className="rounded-2xl bg-secondary p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{s.symptome}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  s.gravite === "leger" ? "bg-secondary text-primary" : s.gravite === "modere" ? "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]" : "bg-destructive/15 text-destructive"
                }`}>
                  {t(`shared.gravite.${s.gravite}`, { defaultValue: s.gravite })}
                </span>
              </div>
              {s.notes && <p className="mt-1 text-sm text-muted-foreground">{s.notes}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(s.createdAt, true)} · {t(`shared.statut_signalement.${s.statut}`, { defaultValue: s.statut })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RendezVousSection({ patient }: { patient: PatientDetail }) {
  const { t } = useT();
  return (
    <Card>
      <SectionTitle icon={CalendarDays} title={t("patient_detail.rdv_title")} />
      {patient.rendezVous.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("patient_detail.aucun_rdv")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {patient.rendezVous.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-secondary p-4">
              <div>
                <p className="font-semibold text-foreground">{r.motif || t("shared.consultation")}</p>
                <p className="text-sm text-muted-foreground">{formatDate(r.dateHeure, true)}</p>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                {t(`shared.statut_rdv.${r.statut}`, { defaultValue: r.statut })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
