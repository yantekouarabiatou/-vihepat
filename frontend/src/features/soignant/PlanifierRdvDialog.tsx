import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarRange, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type ApercuRendezVous } from "@/api/soignant.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { apiErrorMessage } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";

/**
 * Planification de rendez-vous sur une période : modèle de suivi (ou rythme libre), aperçu avec
 * les conflits (patient déjà attendu ce jour-là, créneau pris, charge du jour), puis création.
 * Chaque rendez-vous peut déclencher un rappel automatique du patient la veille.
 */

type Pas = { jours?: number; mois?: number };
type Modele = "vih" | "hepatite" | "debut" | "libre";

/** Décalages depuis la première date, par modèle de suivi (repères usuels, ajustables) */
const MODELES: Record<Exclude<Modele, "libre">, Pas[]> = {
  // VIH stable : tous les 3 mois sur un an
  vih: [{}, { mois: 3 }, { mois: 6 }, { mois: 9 }, { mois: 12 }],
  // Hépatite B ou C suivie : tous les 6 mois sur un an
  hepatite: [{}, { mois: 6 }, { mois: 12 }],
  // Mise sous traitement : J15, M1, M3, M6
  debut: [{}, { jours: 15 }, { mois: 1 }, { mois: 3 }, { mois: 6 }],
};
const RYTHMES: Record<string, Pas> = {
  semaine: { jours: 7 },
  "2semaines": { jours: 14 },
  mois: { mois: 1 },
  "3mois": { mois: 3 },
  "6mois": { mois: 6 },
};

function ajouter(base: Date, pas: Pas) {
  const d = new Date(base);
  if (pas.mois) {
    const jour = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + pas.mois);
    // 31 janvier + 1 mois : dernier jour de février
    d.setDate(Math.min(jour, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  if (pas.jours) d.setDate(d.getDate() + pas.jours);
  return d;
}

/** Samedi ou dimanche : reporté au lundi suivant */
function horsWeekEnd(d: Date) {
  const r = new Date(d);
  if (r.getDay() === 6) r.setDate(r.getDate() + 2);
  else if (r.getDay() === 0) r.setDate(r.getDate() + 1);
  return r;
}

const modeleSuggere = (pathologie?: string): Modele => (!pathologie ? "vih" : pathologie.includes("vih") ? "vih" : "hepatite");

export function PlanifierRdvDialog({
  open,
  onOpenChange,
  patientInitial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientInitial?: number | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: patients } = useQuery({ queryKey: ["soignant", "patients"], queryFn: () => soignantApi.getPatients(), enabled: open });

  const demain = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const [patientId, setPatientId] = useState("");
  const [modele, setModele] = useState<Modele>("vih");
  const [debut, setDebut] = useState(demain);
  const [heure, setHeure] = useState("09:00");
  const [rythme, setRythme] = useState("3mois");
  const [nombre, setNombre] = useState(4);
  const [eviterWeekEnd, setEviterWeekEnd] = useState(true);
  const [motif, setMotif] = useState("");
  const [rappelAuto, setRappelAuto] = useState(true);
  const [apercu, setApercu] = useState<(ApercuRendezVous & { garder: boolean })[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setPatientId(patientInitial ? String(patientInitial) : "");
    setApercu(null);
  }, [open, patientInitial]);

  const patient = patients?.find((p) => String(p.id) === patientId);
  // Modèle proposé selon la pathologie du patient choisi
  useEffect(() => {
    if (patient) setModele(modeleSuggere(patient.pathologie));
  }, [patient]);

  const dates = useMemo(() => {
    const [h, m] = heure.split(":").map(Number);
    const premiere = new Date(`${debut}T00:00:00`);
    if (Number.isNaN(premiere.getTime())) return [];
    premiere.setHours(h ?? 9, m ?? 0, 0, 0);
    const pas = modele === "libre" ? Array.from({ length: Math.min(Math.max(nombre, 1), 24) }, (_, i) => i) : MODELES[modele];
    const liste = pas.map((p, i) => {
      if (typeof p === "number") {
        const r = RYTHMES[rythme] ?? { mois: 1 };
        return ajouter(premiere, { ...(r.jours ? { jours: r.jours * i } : {}), ...(r.mois ? { mois: r.mois * i } : {}) });
      }
      return ajouter(premiere, p);
    });
    return liste.map((d) => (eviterWeekEnd ? horsWeekEnd(d) : d));
  }, [debut, heure, modele, rythme, nombre, eviterWeekEnd]);

  // Tout changement de réglage invalide l'aperçu
  useEffect(() => setApercu(null), [dates, patientId]);

  const { mutate: voirApercu, isPending: calcul } = useMutation({
    mutationFn: () => soignantApi.apercuSerie(Number(patientId), dates.map((d) => d.toISOString())),
    onSuccess: (r) => setApercu(r.map((x) => ({ ...x, garder: !x.conflitPatient }))),
    onError: (err) => toast.error(apiErrorMessage(err, t("agenda.erreur"))),
  });

  const retenues = apercu?.filter((a) => a.garder) ?? [];
  const { mutate: creer, isPending: creation } = useMutation({
    mutationFn: () =>
      soignantApi.creerSerie({
        patientId: Number(patientId),
        dates: retenues.map((a) => a.dateHeure),
        ...(motif.trim() ? { motif: motif.trim() } : {}),
        rappelAuto,
      }),
    onSuccess: (r) => {
      toast.success(t("agenda.toast_crees", { count: r.crees }));
      queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
      queryClient.invalidateQueries({ queryKey: ["soignant", "agenda"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("agenda.erreur"))),
  });

  const format = (iso: string) =>
    new Date(iso).toLocaleString(localeAffichage(), { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" aria-hidden="true" /> {t("agenda.planifier_titre")}
          </DialogTitle>
          <DialogDescription>{t("agenda.planifier_aide")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-patient">{t("agenda.patient")}</Label>
            <SearchableSelect
              id="plan-patient"
              value={patientId}
              onChange={setPatientId}
              placeholder={t("agenda.patient_choisir")}
              options={(patients ?? []).map((p) => ({ value: String(p.id), label: `${p.user.prenom} ${p.user.nom} (${p.codePatient})` }))}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("agenda.modele")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["vih", "hepatite", "debut", "libre"] as Modele[]).map((m) => (
                <label
                  key={m}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                    modele === m ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                  }`}
                >
                  <input type="radio" name="modele" className="sr-only" checked={modele === m} onChange={() => setModele(m)} />
                  <span className="font-semibold text-foreground">{t(`agenda.modele_${m}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`agenda.modele_${m}_aide`)}</span>
                </label>
              ))}
            </div>
            {patient && modele === modeleSuggere(patient.pathologie) && (
              <p className="text-xs text-muted-foreground">{t("agenda.modele_suggere")}</p>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-debut">{t("agenda.premier")}</Label>
              <Input id="plan-debut" type="date" min={demain} value={debut} onChange={(e) => setDebut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-heure">{t("agenda.heure")}</Label>
              <Input id="plan-heure" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
            </div>
            {modele === "libre" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-rythme">{t("agenda.rythme")}</Label>
                  <select
                    id="plan-rythme"
                    value={rythme}
                    onChange={(e) => setRythme(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.keys(RYTHMES).map((r) => (
                      <option key={r} value={r}>{t(`agenda.rythme_${r}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-nombre">{t("agenda.nombre")}</Label>
                  <Input id="plan-nombre" type="number" min={1} max={24} value={nombre} onChange={(e) => setNombre(Number(e.target.value))} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-motif">{t("agenda.motif")}</Label>
            <Input id="plan-motif" maxLength={200} value={motif} placeholder={t("agenda.motif_exemple")} onChange={(e) => setMotif(e.target.value)} />
          </div>

          <div className="space-y-3 rounded-2xl border border-border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("agenda.eviter_weekend")}</span>
              <Switch checked={eviterWeekEnd} onCheckedChange={setEviterWeekEnd} aria-label={t("agenda.eviter_weekend")} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                {t("agenda.rappel_auto")}
                <span className="block text-xs text-muted-foreground">{t("agenda.rappel_auto_aide")}</span>
              </span>
              <Switch checked={rappelAuto} onCheckedChange={setRappelAuto} aria-label={t("agenda.rappel_auto")} />
            </label>
          </div>

          {apercu && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t("agenda.apercu_titre", { count: retenues.length })}</p>
              <ul className="space-y-2">
                {apercu.map((a, i) => (
                  <li key={a.dateHeure} className="flex items-start gap-3 rounded-xl bg-secondary px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={a.garder}
                      aria-label={format(a.dateHeure)}
                      onChange={(e) => setApercu(apercu.map((x, j) => (j === i ? { ...x, garder: e.target.checked } : x)))}
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium capitalize text-foreground">{format(a.dateHeure)}</p>
                      {a.conflitPatient && (
                        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {t("agenda.conflit_patient")}
                        </p>
                      )}
                      {a.creneauOccupe && (
                        <p className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--gold))]">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {t("agenda.creneau_occupe")}
                        </p>
                      )}
                      {a.chargeJour > 0 && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t("agenda.charge_jour", { count: a.chargeJour })}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!apercu ? (
            <Button className="rounded-full" disabled={!patientId || dates.length === 0 || calcul} onClick={() => voirApercu()}>
              {calcul && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("agenda.voir_apercu", { count: dates.length })}
            </Button>
          ) : (
            <Button className="rounded-full" disabled={retenues.length === 0 || creation} onClick={() => creer()}>
              {creation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("agenda.creer", { count: retenues.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
