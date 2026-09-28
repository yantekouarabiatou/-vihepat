import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, FlaskConical, Pill, Plus, Loader2, ShieldCheck, AlertCircle, CalendarDays, Square, Activity,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  NIVEAU_STYLES, OBSERVATION_LABELS, OBSERVATION_TYPES, repereObservation, type TypeObservation,
} from "@/lib/observations";
import { apiErrorMessage } from "@/lib/api-error";
import { ObservanceBars, formatTaux, libelleEcheance, tauxStyle } from "@/lib/observance";

const PATHOLOGIE_LABELS: Record<string, string> = {
  vih: "VIH", vhb: "Hépatite B", vhc: "Hépatite C",
  vih_vhb: "VIH + VHB", vih_vhc: "VIH + VHC", vhb_vhc: "VHB + VHC",
};
const GRAVITE_LABELS: Record<string, string> = { leger: "Léger", modere: "Modéré", severe: "Sévère" };
const GRAVITE_STYLES: Record<string, string> = {
  leger: "bg-secondary text-primary",
  modere: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  severe: "bg-destructive/15 text-destructive",
};
const STATUT_SIGNALEMENT: Record<string, string> = { nouveau: "Nouveau", vu: "Vu", traite: "Traité" };
const STATUT_RDV: Record<string, string> = {
  prevu: "Prévu", confirme: "Confirmé", effectue: "Effectué", manque: "Manqué", annule: "Annulé",
};

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
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
  const { id } = useParams();
  const patientId = Number(id);
  const queryClient = useQueryClient();

  const { data: patient, isLoading, isError, error } = useQuery({
    queryKey: ["soignant", "patient", patientId],
    queryFn: () => soignantApi.getPatient(patientId),
    enabled: Number.isInteger(patientId) && patientId > 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["soignant", "patient", patientId] });

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
          {apiErrorMessage(error, "Dossier patient introuvable.")}
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
            {" · "}{PATHOLOGIE_LABELS[patient.pathologie] ?? patient.pathologie}
            {a !== null && <> · {a} ans</>}
            {patient.sexe && <> · {patient.sexe === "F" ? "Femme" : "Homme"}</>}
            {patient.commune && <> · {patient.commune}</>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnostic : {formatDate(patient.dateDiagnostic)} · Langue : {patient.languePreferee.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-primary">
          <ShieldCheck className="h-4 w-4" />
          Consultation tracée dans le journal d'audit
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
    </AppShell>
  );
}

function ObservanceCard({ patient }: { patient: PatientDetail }) {
  const { observance, alertesExamens } = patient;
  return (
    <Card>
      <SectionTitle icon={Activity} title="Observance" />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-2xl p-3 ${tauxStyle(observance.taux7)}`}>
          <p className="text-xl font-extrabold">{formatTaux(observance.taux7)}</p>
          <p className="text-xs font-medium">7 jours</p>
        </div>
        <div className={`rounded-2xl p-3 ${tauxStyle(observance.taux30)}`}>
          <p className="text-xl font-extrabold">{formatTaux(observance.taux30)}</p>
          <p className="text-xs font-medium">30 jours</p>
        </div>
        <div className="rounded-2xl bg-secondary p-3 text-primary">
          <p className="text-xl font-extrabold">{observance.serie}</p>
          <p className="text-xs font-medium">jours sans oubli</p>
        </div>
      </div>
      <div className="mt-4">
        <ObservanceBars jours={observance.jours} />
      </div>
      {observance.nonRenseignees30 > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {observance.nonRenseignees30} prise{observance.nonRenseignees30 > 1 ? "s" : ""} non renseignée{observance.nonRenseignees30 > 1 ? "s" : ""} sur 30 jours (comptée{observance.nonRenseignees30 > 1 ? "s" : ""} comme non prise{observance.nonRenseignees30 > 1 ? "s" : ""}).
        </p>
      )}
      {alertesExamens.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground">Examens à programmer</h3>
          {alertesExamens.map((a) => (
            <div key={a.type} className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2">
              <span className="text-sm text-foreground">{a.libelle}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  a.statut === "en_retard" ? "bg-destructive/15 text-destructive" : "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]"
                }`}
              >
                {libelleEcheance(a)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BackLink() {

  return (
    <Link to="/soignant/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary">
      <ArrowLeft className="mr-1 h-4 w-4" /> Retour à la file active
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Bilan biologique                                                    */
/* ------------------------------------------------------------------ */

function BilanSection({ patient, onSaved }: { patient: PatientDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);

  const derniers = useMemo(() => {
    const map = new Map<string, PatientDetail["observations"][number]>();
    for (const o of patient.observations) if (!map.has(o.type)) map.set(o.type, o);
    return Array.from(map.values());
  }, [patient.observations]);

  const typesAvecHistorique = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of patient.observations) counts.set(o.type, (counts.get(o.type) ?? 0) + 1);
    return Array.from(counts.entries()).filter(([, n]) => n >= 2).map(([t]) => t);
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

  return (
    <>
      <Card>
        <SectionTitle
          icon={FlaskConical}
          title="Bilan biologique"
          action={
            <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Saisir un résultat
            </Button>
          }
        />

        {derniers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun résultat biologique enregistré.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {derniers.map((o) => {
              const repere = repereObservation(o.type, o.valeur);
              return (
                <div key={o.id} className="rounded-2xl bg-secondary p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {OBSERVATION_LABELS[o.type] ?? o.type}
                    </span>
                    {repere && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${NIVEAU_STYLES[repere.niveau]}`}>
                        {repere.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-foreground">
                    {o.valeur.toLocaleString("fr-FR")} <span className="text-sm font-semibold text-muted-foreground">{o.unite}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Prélevé le {formatDate(o.datePrelevement)}</p>
                </div>
              );
            })}
          </div>
        )}

        {courbe && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">Évolution</h3>
              <div className="flex flex-wrap gap-1">
                {typesAvecHistorique.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeCourbe(t)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      t === courbe ? "bg-primary text-primary-foreground" : "bg-secondary text-primary hover:bg-secondary/70"
                    }`}
                  >
                    {OBSERVATION_LABELS[t] ?? t}
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
                      `${Number(v).toLocaleString("fr-FR")} ${String(item.payload?.unite ?? "")}`,
                      OBSERVATION_LABELS[courbe] ?? courbe,
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
            <h3 className="text-sm font-bold text-foreground">Historique des saisies</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Examen</th>
                    <th className="py-2 pr-3 font-semibold">Résultat</th>
                    <th className="py-2 font-semibold">Saisi par</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.observations.map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(o.datePrelevement)}</td>
                      <td className="py-2 pr-3">{OBSERVATION_LABELS[o.type] ?? o.type}</td>
                      <td className="py-2 pr-3 whitespace-nowrap font-semibold">
                        {o.valeur.toLocaleString("fr-FR")} {o.unite}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {o.soignant ? `${o.soignant.user.prenom} ${o.soignant.user.nom}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      toast.success("Résultat enregistré");
      reset();
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Impossible d'enregistrer le résultat")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saisir un résultat biologique</DialogTitle>
          <DialogDescription>
            Réservé aux professionnels habilités. La saisie est signée à votre nom et tracée.
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
            <Label htmlFor="obs-type">Examen</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                const t = v as TypeObservation;
                setType(t);
                setUnite(OBSERVATION_TYPES.find((o) => o.value === t)?.unite ?? "");
              }}
            >
              <SelectTrigger id="obs-type" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBSERVATION_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="obs-valeur">Valeur</Label>
              <Input
                id="obs-valeur"
                inputMode="decimal"
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                placeholder={type === "ag_hbs" ? "1 = positif, 0 = négatif" : "Ex. 450"}
                required
                pattern="[0-9]+([.,][0-9]+)?"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-unite">Unité</Label>
              <Input id="obs-unite" value={unite} onChange={(e) => setUnite(e.target.value)} required className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs-date">Date du prélèvement</Label>
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
            <Label htmlFor="obs-commentaire">Commentaire (optionnel)</Label>
            <Textarea id="obs-commentaire" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full rounded-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
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
  const [open, setOpen] = useState(false);

  const { mutate: arreter, isPending: arretEnCours, variables: arretId } = useMutation({
    mutationFn: (id: number) => soignantApi.updateTraitement(id, { actif: false }),
    onSuccess: () => {
      toast.success("Traitement arrêté");
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Impossible de modifier le traitement")),
  });

  return (
    <>
      <Card>
        <SectionTitle
          icon={Pill}
          title="Traitements"
          action={
            <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Prescrire
            </Button>
          }
        />
        {patient.traitements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun traitement enregistré.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {patient.traitements.map((t) => (
              <li
                key={t.id}
                className={`rounded-2xl border-2 p-4 ${t.actif ? "border-border" : "border-dashed border-border opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold text-foreground">{t.molecule}</p>
                  {t.actif ? (
                    t.heurePrise && (
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">{t.heurePrise}</span>
                    )
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Arrêté</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[t.dosage, t.frequence].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Depuis le {formatDate(t.dateDebut)}
                    {t.dateFin && <> · fin {formatDate(t.dateFin)}</>}
                  </span>
                  {t.actif && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full text-destructive"
                      disabled={arretEnCours && arretId === t.id}
                      onClick={() => arreter(t.id)}
                    >
                      <Square className="mr-1 h-3 w-3" /> Arrêter
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
      toast.success("Traitement ajouté");
      setMolecule("");
      setDosage("");
      setNotes("");
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Impossible d'ajouter le traitement")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prescrire un traitement</DialogTitle>
          <DialogDescription>Le traitement apparaîtra immédiatement dans l'espace du patient.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="t-molecule">Molécule(s)</Label>
            <Input
              id="t-molecule"
              value={molecule}
              onChange={(e) => setMolecule(e.target.value)}
              placeholder="Ex. Ténofovir/Lamivudine/Dolutégravir"
              required
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-dosage">Dosage</Label>
              <Input id="t-dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="300/300/50 mg" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-frequence">Fréquence</Label>
              <Input id="t-frequence" value={frequence} onChange={(e) => setFrequence(e.target.value)} required className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-heure">Heure de prise</Label>
              <Input id="t-heure" type="time" value={heurePrise} onChange={(e) => setHeurePrise(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-debut">Début</Label>
              <Input id="t-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-notes">Consignes (optionnel)</Label>
            <Textarea id="t-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full rounded-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajouter le traitement
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
  return (
    <Card>
      <SectionTitle icon={AlertCircle} title="Signalements" />
      {patient.signalements.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun signalement.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {patient.signalements.map((s) => (
            <li key={s.id} className="rounded-2xl bg-secondary p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{s.symptome}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${GRAVITE_STYLES[s.gravite] ?? ""}`}>
                  {GRAVITE_LABELS[s.gravite] ?? s.gravite}
                </span>
              </div>
              {s.notes && <p className="mt-1 text-sm text-muted-foreground">{s.notes}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(s.createdAt, true)} · {STATUT_SIGNALEMENT[s.statut] ?? s.statut}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RendezVousSection({ patient }: { patient: PatientDetail }) {
  return (
    <Card>
      <SectionTitle icon={CalendarDays} title="Rendez-vous" />
      {patient.rendezVous.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun rendez-vous.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {patient.rendezVous.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-secondary p-4">
              <div>
                <p className="font-semibold text-foreground">{r.motif || "Consultation"}</p>
                <p className="text-sm text-muted-foreground">{formatDate(r.dateHeure, true)}</p>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary">
                {STATUT_RDV[r.statut] ?? r.statut}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
