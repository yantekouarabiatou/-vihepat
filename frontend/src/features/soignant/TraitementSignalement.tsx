import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CalendarPlus, CheckCircle2, ExternalLink, Eye, FlaskConical, Loader2, Phone, Pill, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type SoignantSignalement } from "@/api/soignant.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiErrorMessage } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";
import { formatTaux, tauxStyle } from "@/lib/observance";
import { cn } from "@/lib/utils";
import { NIVEAU_RISQUE_STYLES } from "./RisquePerteSuivi";

/**
 * Traitement d'un signalement de symptôme : le signalement, un résumé du dossier du patient pour
 * décider sans changer d'écran, et les actions (vu, traité, rendez-vous, dossier complet).
 * Ouvrir ce panneau charge le dossier : la consultation est tracée dans le journal d'audit.
 */

const GRAVITE_STYLES: Record<string, string> = {
  leger: "bg-secondary text-primary",
  modere: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  severe: "bg-destructive/15 text-destructive",
};

function dateCourte(iso: string, heure = false) {
  return new Date(iso).toLocaleString(localeAffichage(), {
    day: "numeric", month: "short", year: "numeric", ...(heure ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Demain 9 h, au format attendu par <input type="datetime-local"> */
function demainNeufHeures() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T09:00`;
}

function Bloc({ icone: Icone, titre, children }: { icone: typeof Pill; titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Icone className="h-4 w-4 text-primary" /> {titre}
      </h3>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

export function TraitementSignalement({ signalement, onClose }: { signalement: SoignantSignalement | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const patientId = signalement?.patient.id;
  const [rdvOuvert, setRdvOuvert] = useState(false);
  const [dateRdv, setDateRdv] = useState(demainNeufHeures());
  const [motif, setMotif] = useState("");

  const { data: dossier, isLoading } = useQuery({
    queryKey: ["soignant", "patient", patientId],
    queryFn: () => soignantApi.getPatient(patientId!),
    enabled: !!patientId,
  });

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["soignant", "signalements"] });
    void queryClient.invalidateQueries({ queryKey: ["soignant", "patient", patientId] });
  };

  const { mutate: changerStatut, isPending: statutEnCours } = useMutation({
    mutationFn: (statut: "vu" | "traite") => soignantApi.updateSignalement(signalement!.id, statut),
    onSuccess: (_r, statut) => {
      toast.success(t("traitement_signalement.toast_statut"));
      rafraichir();
      if (statut === "traite") onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("signalements_page.toast_erreur"))),
  });

  const { mutate: programmer, isPending: rdvEnCours } = useMutation({
    mutationFn: () => soignantApi.createRendezVous({
      patientId: patientId!,
      dateHeure: new Date(dateRdv).toISOString(),
      motif: motif.trim() || t("traitement_signalement.motif_defaut", { symptome: signalement!.symptome }),
    }),
    onSuccess: () => {
      toast.success(t("traitement_signalement.toast_rdv"));
      setRdvOuvert(false);
      setMotif("");
      rafraichir();
      void queryClient.invalidateQueries({ queryKey: ["soignant", "rendez-vous"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("traitement_signalement.toast_rdv_erreur"))),
  });

  if (!signalement) return null;
  const s = signalement;
  const traitementsActifs = dossier?.traitements.filter((x) => x.actif) ?? [];
  const derniersExamens = dossier?.observations.slice(0, 4) ?? [];
  const autresSignalements = dossier?.signalements.filter((x) => x.id !== s.id).slice(0, 3) ?? [];
  const prochainsRdv = dossier?.rendezVous.filter((r) => new Date(r.dateHeure) > new Date() && r.statut !== "annule").slice(0, 2) ?? [];
  const risque = dossier?.risquePerteSuivi?.statut === "calcule" ? dossier.risquePerteSuivi : null;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Stethoscope className="h-5 w-5 text-primary" /> {t("traitement_signalement.titre")}
          </SheetTitle>
          <SheetDescription>{t("traitement_signalement.sous_titre")}</SheetDescription>
        </SheetHeader>

        {/* Le signalement */}
        <section className="mt-5 rounded-2xl bg-secondary/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", GRAVITE_STYLES[s.gravite])}>{t(`shared.gravite.${s.gravite}`)}</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">{t(`shared.statut_signalement.${s.statut}`)}</span>
            <span className="text-xs text-muted-foreground">{dateCourte(s.createdAt, true)}</span>
          </div>
          <p className="mt-2 text-base font-bold text-foreground">{s.symptome}</p>
          {s.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.notes}</p>}
        </section>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {s.statut === "nouveau" && (
            <Button variant="outline" className="rounded-full" disabled={statutEnCours} onClick={() => changerStatut("vu")}>
              <Eye className="mr-1.5 h-4 w-4" /> {t("signalements_page.marquer_vu")}
            </Button>
          )}
          {s.statut !== "traite" && (
            <Button className="rounded-full" disabled={statutEnCours} onClick={() => changerStatut("traite")}>
              {statutEnCours ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              {t("traitement_signalement.marquer_traite")}
            </Button>
          )}
          <Button variant="outline" className="rounded-full" onClick={() => setRdvOuvert((o) => !o)}>
            <CalendarPlus className="mr-1.5 h-4 w-4" /> {t("traitement_signalement.programmer_rdv")}
          </Button>
          <Link
            to={`/soignant/patients/${s.patient.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> {t("traitement_signalement.dossier_complet")}
          </Link>
        </div>

        {rdvOuvert && (
          <form
            className="mt-3 space-y-3 rounded-2xl border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              programmer();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rdv-date">{t("traitement_signalement.date_rdv")}</Label>
              <Input id="rdv-date" type="datetime-local" required value={dateRdv} onChange={(e) => setDateRdv(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rdv-motif">{t("traitement_signalement.motif")}</Label>
              <Input
                id="rdv-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={t("traitement_signalement.motif_defaut", { symptome: s.symptome })}
                className="h-10 rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={rdvEnCours}>
              {rdvEnCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("traitement_signalement.confirmer_rdv")}
            </Button>
          </form>
        )}

        {/* Résumé du dossier associé */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("traitement_signalement.dossier")}</h3>
        {isLoading || !dossier ? (
          <Loader2 className="mt-3 h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="mt-2 space-y-3">
            <section className="rounded-2xl border border-border/70 p-4">
              <p className="text-base font-bold text-foreground">{dossier.user.prenom} {dossier.user.nom}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-primary">{dossier.codePatient}</span>
                {" · "}{t(`shared.pathologie.${dossier.pathologie}`)}
                {dossier.sexe && <> · {dossier.sexe === "F" ? t("patient_detail.femme") : t("patient_detail.homme")}</>}
              </p>
              {dossier.telephone && (
                <a href={`tel:${dossier.telephone.replace(/\s/g, "")}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  <Phone className="h-4 w-4" /> {dossier.telephone}
                </a>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", tauxStyle(dossier.observance.taux30))}>
                  {t("dashboard_soignant.obs_label", { taux: formatTaux(dossier.observance.taux30) })}
                </span>
                {risque && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", NIVEAU_RISQUE_STYLES[risque.niveau])}>
                    {t("perte_suivi.badge", { niveau: t(`perte_suivi.niveau.${risque.niveau}`).toLowerCase() })}
                  </span>
                )}
              </div>
            </section>

            <Bloc icone={Pill} titre={t("traitement_signalement.traitements")}>
              {traitementsActifs.length === 0 ? (
                <p className="text-muted-foreground">{t("traitement_signalement.aucun_traitement")}</p>
              ) : (
                <ul className="space-y-1">
                  {traitementsActifs.map((x) => (
                    <li key={x.id} className="text-foreground">
                      <span className="font-semibold">{x.molecule}</span>
                      {x.dosage && <> {x.dosage}</>} <span className="text-muted-foreground">· {x.frequence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>

            <Bloc icone={FlaskConical} titre={t("traitement_signalement.examens")}>
              {derniersExamens.length === 0 ? (
                <p className="text-muted-foreground">{t("traitement_signalement.aucun_examen")}</p>
              ) : (
                <ul className="space-y-1">
                  {derniersExamens.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2 text-foreground">
                      <span>{t(`observations.types.${o.type}`, { defaultValue: o.type })}</span>
                      <span className="text-muted-foreground">{o.valeur} {o.unite} · {dateCourte(o.datePrelevement)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>

            <Bloc icone={Stethoscope} titre={t("traitement_signalement.autres_signalements")}>
              {autresSignalements.length === 0 ? (
                <p className="text-muted-foreground">{t("traitement_signalement.aucun_autre")}</p>
              ) : (
                <ul className="space-y-1">
                  {autresSignalements.map((x) => (
                    <li key={x.id} className="flex justify-between gap-2 text-foreground">
                      <span className="truncate">{x.symptome}</span>
                      <span className="shrink-0 text-muted-foreground">{t(`shared.gravite.${x.gravite}`)} · {dateCourte(x.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>

            <Bloc icone={CalendarPlus} titre={t("traitement_signalement.prochains_rdv")}>
              {prochainsRdv.length === 0 ? (
                <p className="text-muted-foreground">{t("traitement_signalement.aucun_rdv")}</p>
              ) : (
                <ul className="space-y-1">
                  {prochainsRdv.map((r) => (
                    <li key={r.id} className="text-foreground">
                      {dateCourte(r.dateHeure, true)} {r.motif && <span className="text-muted-foreground">· {r.motif}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Bloc>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
