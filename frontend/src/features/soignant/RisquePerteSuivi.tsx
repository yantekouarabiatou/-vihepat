import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDownRight, ArrowUpRight, ClipboardList, Edit3, Loader2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import {
  soignantApi, type BilanInclusion, type FacteurRisque, type NiveauEtudes, type NiveauRisque, type PatientDetail,
  type SituationMatrimoniale, type VariableRisque,
} from "@/api/soignant.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * Score de risque de perte de suivi (modèle 1, ia/perte_de_suivi), calculé par l'API à partir
 * du bilan d'inclusion. Il aide à prioriser les relances ; il ne déclenche rien.
 */

/** Part de patients réellement perdus de vue par niveau, sur le jeu de test (README du modèle) */
const TAUX_COHORTE: Record<NiveauRisque, number> = { faible: 31, modere: 60, eleve: 88 };

export const NIVEAU_RISQUE_STYLES: Record<NiveauRisque, string> = {
  faible: "bg-primary/10 text-primary",
  modere: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  eleve: "bg-destructive/15 text-destructive",
};

/** Pastille de la liste des patients (rien tant que le score n'est pas calculé) */
export function BadgeRisquePerteSuivi({ risque, className = "" }: {
  risque?: { niveau: NiveauRisque; probabilite: number } | null | undefined; className?: string;
}) {
  const { t } = useTranslation();
  if (!risque) return null;
  const libelle = t("perte_suivi.badge", { niveau: t(`perte_suivi.niveau.${risque.niveau}`).toLowerCase() });
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${NIVEAU_RISQUE_STYLES[risque.niveau]} ${className}`}
      title={`${t("perte_suivi.titre")} : ${Math.round(risque.probabilite * 100)} %`}
    >
      <TrendingDown className="h-3 w-3" aria-hidden="true" />
      {libelle}
    </span>
  );
}

/** Examens du bilan, dans les unités de la cohorte d'entraînement, avec ses bornes de plausibilité */
const EXAMENS = [
  { champ: "cd4", unite: "cellules/µL", bornes: [1, 3000] },
  { champ: "chargeVirale", unite: "copies/mL", bornes: [0, 1e7] },
  { champ: "alat", unite: "U/L", bornes: [1, 5000] },
  { champ: "creatinine", unite: "µmol/L", bornes: [15, 2000] },
  { champ: "hemoglobine", unite: "g/dL", bornes: [2, 20] },
  { champ: "plaquettes", unite: "10⁹/L", bornes: [5, 1500] },
  { champ: "proteinesTotales", unite: "g/L", bornes: [30, 150] },
  { champ: "uree", unite: "mmol/L", bornes: [0.5, 100] },
  { champ: "leucocytes", unite: "10⁹/L", bornes: [0.5, 100] },
] as const;
type ChampExamen = (typeof EXAMENS)[number]["champ"];

/** Variable biologique du modèle -> champ du bilan */
const EXAMEN_DE_VARIABLE: Partial<Record<VariableRisque, ChampExamen>> = {
  sqrt_CD4: "cd4", log10_CV: "chargeVirale", log_ALT: "alat", log_Creatin: "creatinine", Hemoglob: "hemoglobine",
  log_Platelet: "plaquettes", TotProt: "proteinesTotales", log_Urea: "uree", log_WBC: "leucocytes",
};

const SITUATIONS: SituationMatrimoniale[] = ["marie", "celibataire", "divorce", "separe", "veuf"];
const NIVEAUX_ETUDES: NiveauEtudes[] = ["aucun", "primaire", "secondaire", "superieur"];

const nombre = (n: number) => n.toLocaleString(undefined, { maximumSignificantDigits: 3 });

function ageAu(dateNaissance: string | null, date: string | null) {
  if (!dateNaissance) return null;
  const ref = date ? new Date(date) : new Date();
  return Math.floor((ref.getTime() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

/** Valeur lisible de la variable pour ce patient, à côté du facteur expliqué */
function valeurFacteur(variable: VariableRisque, patient: PatientDetail, examensManquants: number, t: (k: string, o?: any) => string) {
  const bilan = patient.bilanInclusion;
  if (!bilan) return "";
  const examen = EXAMEN_DE_VARIABLE[variable];
  if (examen) {
    const v = bilan[examen];
    const def = EXAMENS.find((e) => e.champ === examen)!;
    return v === null ? t("perte_suivi.non_mesure") : `${nombre(v)} ${def.unite}`;
  }
  switch (variable) {
    case "Age": {
      const a = ageAu(patient.dateNaissance, bilan.dateBilan);
      return a === null ? t("perte_suivi.non_renseigne") : t("perte_suivi.ans", { n: a });
    }
    case "nb_examens_manquants":
      return t("perte_suivi.sur_10", { n: examensManquants });
    case "WHOStage":
      return bilan.stadeOms ? t("perte_suivi.form.stade_n", { n: bilan.stadeOms }) : t("perte_suivi.non_renseigne");
    case "MaritalStatus":
      return bilan.situationMatrimoniale ? t(`perte_suivi.form.situations.${bilan.situationMatrimoniale}`) : t("perte_suivi.non_renseigne");
    case "Education":
      return bilan.niveauEtudes ? t(`perte_suivi.form.niveaux_etudes.${bilan.niveauEtudes}`) : t("perte_suivi.non_renseigne");
    case "Sex":
      return patient.sexe ? (patient.sexe === "F" ? t("patient_detail.femme") : t("patient_detail.homme")) : t("perte_suivi.non_renseigne");
    case "cv_inf_1000":
      return bilan.chargeVirale === null ? t("perte_suivi.non_mesure") : bilan.chargeVirale < 1000 ? t("perte_suivi.oui") : t("perte_suivi.non");
    case "vih_avance": {
      if (bilan.stadeOms === null && bilan.cd4 === null) return t("perte_suivi.non_renseigne");
      const avance = (bilan.stadeOms ?? 0) >= 3 || (bilan.cd4 !== null && bilan.cd4 < 200);
      return avance ? t("perte_suivi.oui") : t("perte_suivi.non");
    }
    default:
      return "";
  }
}

export function RisquePerteSuiviCard({ patient, onSaved }: { patient: PatientDetail; onSaved: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const risque = patient.risquePerteSuivi;
  if (!risque || risque.statut === "non_concerne") return null;

  const bouton = (
    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
      {patient.bilanInclusion ? <Edit3 className="mr-1.5 h-4 w-4" /> : <ClipboardList className="mr-1.5 h-4 w-4" />}
      {patient.bilanInclusion ? t("perte_suivi.modifier_bilan") : t("perte_suivi.saisir_bilan")}
    </Button>
  );

  const ligneFacteur = (f: FacteurRisque, sens: "hausse" | "baisse") => {
    const Icone = sens === "hausse" ? ArrowUpRight : ArrowDownRight;
    const valeur = risque.statut === "calcule" ? valeurFacteur(f.variable, patient, risque.examensManquants, t) : "";
    return (
      <li key={f.variable} className="flex items-start gap-2 text-sm">
        <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${sens === "hausse" ? "text-destructive" : "text-primary"}`} aria-hidden="true" />
        <span className="text-foreground">
          {t(`perte_suivi.variables.${f.variable}`)}
          {valeur && <span className="text-muted-foreground"> : {valeur}</span>}
        </span>
      </li>
    );
  };

  return (
    <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{t("perte_suivi.titre")}</h2>
        </div>
        {bouton}
      </div>

      {risque.statut === "bilan_absent" && (
        <p className="mt-3 text-sm text-muted-foreground">{t("perte_suivi.bilan_absent")}</p>
      )}
      {risque.statut === "indisponible" && (
        <p className="mt-3 text-sm text-muted-foreground">{t("perte_suivi.indisponible")}</p>
      )}

      {risque.statut === "calcule" && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${NIVEAU_RISQUE_STYLES[risque.niveau]}`}>
              {t(`perte_suivi.niveau.${risque.niveau}`)}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {t("perte_suivi.probabilite", { p: Math.round(risque.probabilite * 100) })}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("perte_suivi.cohorte", { taux: TAUX_COHORTE[risque.niveau] })}
          </p>
          {risque.examensManquants > 0 && (
            <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-foreground">
              {t("perte_suivi.examens_manquants", { count: risque.examensManquants })}
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {risque.hausse.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("perte_suivi.hausse")}</h3>
                <ul className="mt-2 space-y-1.5">{risque.hausse.map((f) => ligneFacteur(f, "hausse"))}</ul>
              </div>
            )}
            {risque.baisse.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("perte_suivi.baisse")}</h3>
                <ul className="mt-2 space-y-1.5">{risque.baisse.map((f) => ligneFacteur(f, "baisse"))}</ul>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {t("perte_suivi.details_modele", { version: risque.modele.version })}
          </p>
        </>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("perte_suivi.avertissement")}</p>

      {/* Monté à l'ouverture seulement : le formulaire repart toujours du bilan enregistré */}
      {open && <BilanInclusionDialog open={open} onOpenChange={setOpen} patient={patient} onSaved={onSaved} />}
    </section>
  );
}

const versTexte = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function BilanInclusionDialog({ open, onOpenChange, patient, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; patient: PatientDetail; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const b = patient.bilanInclusion;
  const [dateBilan, setDateBilan] = useState(b?.dateBilan ?? patient.dateDiagnostic?.slice(0, 10) ?? "");
  const [situation, setSituation] = useState<string>(b?.situationMatrimoniale ?? "");
  const [etudes, setEtudes] = useState<string>(b?.niveauEtudes ?? "");
  const [stade, setStade] = useState(versTexte(b?.stadeOms));
  const [examens, setExamens] = useState<Record<ChampExamen, string>>(
    () => Object.fromEntries(EXAMENS.map((e) => [e.champ, versTexte(b?.[e.champ])])) as Record<ChampExamen, string>,
  );

  const lire = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const saisie: BilanInclusion = {
        dateBilan: dateBilan || null,
        situationMatrimoniale: (situation || null) as SituationMatrimoniale | null,
        niveauEtudes: (etudes || null) as NiveauEtudes | null,
        stadeOms: stade ? Number(stade) : null,
        cd4: lire(examens.cd4),
        chargeVirale: lire(examens.chargeVirale),
        alat: lire(examens.alat),
        creatinine: lire(examens.creatinine),
        hemoglobine: lire(examens.hemoglobine),
        plaquettes: lire(examens.plaquettes),
        proteinesTotales: lire(examens.proteinesTotales),
        uree: lire(examens.uree),
        leucocytes: lire(examens.leucocytes),
      };
      return soignantApi.enregistrerBilanInclusion(patient.id, saisie);
    },
    onSuccess: () => {
      toast.success(t("perte_suivi.form.toast_ok"));
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("perte_suivi.form.toast_erreur"))),
  });

  const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("perte_suivi.form.titre")}</DialogTitle>
          <DialogDescription>{t("perte_suivi.form.description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
          className="space-y-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bilan-date">{t("perte_suivi.form.date_bilan")}</Label>
              <Input
                id="bilan-date" type="date" value={dateBilan} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDateBilan(e.target.value)} className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bilan-stade">{t("perte_suivi.form.stade")}</Label>
              <select id="bilan-stade" value={stade} onChange={(e) => setStade(e.target.value)} className={selectClass}>
                <option value="">{t("perte_suivi.form.non_renseigne")}</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{t("perte_suivi.form.stade_n", { n })}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bilan-situation">{t("perte_suivi.form.situation")}</Label>
              <select id="bilan-situation" value={situation} onChange={(e) => setSituation(e.target.value)} className={selectClass}>
                <option value="">{t("perte_suivi.form.non_renseigne")}</option>
                {SITUATIONS.map((s) => (
                  <option key={s} value={s}>{t(`perte_suivi.form.situations.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bilan-etudes">{t("perte_suivi.form.etudes")}</Label>
              <select id="bilan-etudes" value={etudes} onChange={(e) => setEtudes(e.target.value)} className={selectClass}>
                <option value="">{t("perte_suivi.form.non_renseigne")}</option>
                {NIVEAUX_ETUDES.map((n) => (
                  <option key={n} value={n}>{t(`perte_suivi.form.niveaux_etudes.${n}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-foreground">{t("perte_suivi.form.examens")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {EXAMENS.map((e) => {
                const v = lire(examens[e.champ]);
                const horsBornes = v !== null && Number.isFinite(v) && (v < e.bornes[0] || v > e.bornes[1]);
                return (
                  <div key={e.champ} className="space-y-1.5">
                    <Label htmlFor={`bilan-${e.champ}`}>
                      {t(`perte_suivi.form.champs.${e.champ}`)} <span className="font-normal text-muted-foreground">({e.unite})</span>
                    </Label>
                    <Input
                      id={`bilan-${e.champ}`}
                      inputMode="decimal"
                      pattern="[0-9]+([.,][0-9]+)?"
                      value={examens[e.champ]}
                      onChange={(ev) => setExamens((x) => ({ ...x, [e.champ]: ev.target.value }))}
                      placeholder={t("perte_suivi.form.non_renseigne")}
                      className="h-11 rounded-xl"
                    />
                    {horsBornes && (
                      <p className="text-xs text-[hsl(var(--gold))]">{t("perte_suivi.form.hors_bornes", { unite: e.unite })}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
              {t("perte_suivi.form.annuler")}
            </Button>
            <Button type="submit" disabled={isPending} className="rounded-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("perte_suivi.form.enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
