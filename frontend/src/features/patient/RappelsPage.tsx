import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock, BellRing, CalendarPlus, Check, Clock, Info, Pencil, Plus, Share2, Trash2, Vibrate, Volume2, VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ListenButton } from "@/components/listen-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { patientApi } from "@/api/patient.api";
import { estErreurReseau, retirerConfirmationsEnAttente } from "@/lib/offline-queue";
import { localeAffichage } from "@/lib/date-locale";
import {
  DELAIS_RELANCE, REPORTS_MINUTES, afficherAlerte, exporterIcs, notificationsSupportees, titreNotification,
  useRappelsStore, type ModeSonore, type Occurrence, type Rappel, type TypeRappel,
} from "@/lib/rappels";

/** Lundi en premier (usage au Bénin), valeurs = Date.getDay(). */
const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];

function nomJour(jour: number, locale: string, format: "short" | "long" = "short") {
  // 2024-01-07 est un dimanche : on décale à partir de là
  return new Intl.DateTimeFormat(locale, { weekday: format }).format(new Date(2024, 0, 7 + jour));
}

function heureLocale(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------

function FormulaireRappel({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (o: boolean) => void; initial: Rappel | null }) {
  const { t, i18n } = useTranslation();
  const locale = localeAffichage(i18n.resolvedLanguage);
  const { rappels, ajouter, modifier } = useRappelsStore();
  const [libelle, setLibelle] = useState("");
  const [heure, setHeure] = useState("08:00");
  const [jours, setJours] = useState<number[]>([]);
  const [type, setType] = useState<TypeRappel>("prise");

  useEffect(() => {
    if (!open) return;
    setLibelle(initial?.libelle ?? t("rappels.libelle_defaut", { n: rappels.length + 1 }));
    setHeure(initial?.heure ?? "08:00");
    setJours(initial?.jours ?? []);
    setType(initial?.type ?? "prise");
  }, [open, initial, rappels.length, t]);

  const suggestions = [
    t("rappels.libelle_defaut", { n: rappels.length + 1 }),
    t("rappels.suggestion_vitamines"),
    t("rappels.suggestion_pause"),
  ];

  function basculerJour(j: number) {
    setJours((js) => (js.includes(j) ? js.filter((x) => x !== j) : [...js, j]));
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) return;
    // Les 7 jours cochés équivalent à « tous les jours »
    const donnees = { libelle: libelle.trim() || suggestions[0]!, heure, jours: jours.length === 7 ? [] : jours, type };
    if (initial) modifier(initial.id, donnees);
    else ajouter(donnees);
    toast.success(t(initial ? "rappels.toast_modifie" : "rappels.toast_cree"));
    onOpenChange(false);
  }

  const tousLesJours = jours.length === 0 || jours.length === 7;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(initial ? "rappels.form_titre_modifier" : "rappels.form_titre_creer")}</DialogTitle>
          <DialogDescription>{t("rappels.form_aide")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={soumettre} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="rappel-libelle">{t("rappels.champ_libelle")}</Label>
            <Input
              id="rappel-libelle"
              value={libelle}
              maxLength={40}
              onChange={(e) => setLibelle(e.target.value)}
              className="h-12 rounded-xl"
            />
            <div className="flex flex-wrap gap-2" aria-label={t("rappels.exemples")}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLibelle(s)}
                  className="min-h-9 rounded-full border border-border bg-secondary/60 px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rappel-heure">{t("rappels.champ_heure")}</Label>
            <Input
              id="rappel-heure"
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t("rappels.champ_jours")}</legend>
            <button
              type="button"
              onClick={() => setJours([])}
              aria-pressed={tousLesJours}
              className={`min-h-10 w-full rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                tousLesJours ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-secondary"
              }`}
            >
              {t("rappels.tous_les_jours")}
            </button>
            <div className="grid grid-cols-7 gap-1">
              {ORDRE_JOURS.map((j) => {
                const actif = !tousLesJours && jours.includes(j);
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => basculerJour(j)}
                    aria-pressed={actif}
                    aria-label={nomJour(j, locale, "long")}
                    className={`min-h-11 rounded-xl border text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      actif ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {nomJour(j, locale)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t("rappels.champ_type")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["prise", "rdv"] as const).map((ty) => (
                <label
                  key={ty}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                    type === ty ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <input type="radio" name="rappel-type" value={ty} checked={type === ty} onChange={() => setType(ty)} className="sr-only" />
                  {t(`rappels.type_${ty}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" className="h-12 w-full rounded-full text-base font-semibold">
            {t("rappels.enregistrer")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function EcheancesDuJour() {
  const { t, i18n } = useTranslation();
  const locale = localeAffichage(i18n.resolvedLanguage);
  const { occurrences, rappels, confirmer, reporter } = useRappelsStore();
  const [reportOuvert, setReportOuvert] = useState<string | null>(null);

  const aujourdhui = new Date().toDateString();
  const liste = occurrences
    .filter((o) => new Date(o.prevuLe).toDateString() === aujourdhui)
    .sort((a, b) => b.prevuLe.localeCompare(a.prevuLe));

  if (liste.length === 0) return null;

  const libelleDe = (o: Occurrence) => rappels.find((r) => r.id === o.rappelId)?.libelle ?? t(`rappels.type_${o.type}`);

  return (
    <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="titre-echeances">
      <h2 id="titre-echeances" className="text-lg font-bold text-foreground">{t("rappels.aujourdhui_titre")}</h2>
      <ul className="mt-4 space-y-3">
        {liste.map((o) => (
          <li key={o.cle} className="rounded-2xl border border-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{libelleDe(o)}</p>
                <p className="text-sm text-muted-foreground">
                  {heureLocale(o.prevuLe, locale)}
                  {o.etat === "en_attente" && o.reports > 0 && ` · ${t("rappels.reporte_a", { heure: heureLocale(o.alerteA, locale) })}`}
                </p>
              </div>
              {o.etat === "confirmee" ? (
                <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("rappels.etat_confirmee")}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {o.etat === "non_confirmee" && (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {t("rappels.etat_non_confirmee")}
                    </span>
                  )}
                  <Button size="sm" className="h-10 rounded-full px-4" onClick={() => { confirmer(o.cle); toast.success(t("rappels.toast_fait")); }}>
                    <Check className="mr-1 h-4 w-4" aria-hidden="true" /> {t("rappels.action_fait")}
                  </Button>
                  {o.etat === "en_attente" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-full px-4"
                      aria-expanded={reportOuvert === o.cle}
                      onClick={() => setReportOuvert(reportOuvert === o.cle ? null : o.cle)}
                    >
                      <Clock className="mr-1 h-4 w-4" aria-hidden="true" /> {t("rappels.action_plus_tard")}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {reportOuvert === o.cle && o.etat === "en_attente" && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("rappels.action_plus_tard")}>
                {REPORTS_MINUTES.map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant="secondary"
                    className="h-10 rounded-full px-4"
                    onClick={() => {
                      reporter(o.cle, m);
                      setReportOuvert(null);
                      toast(t("rappels.toast_reporte", { count: m }));
                    }}
                  >
                    {t("rappels.dans_minutes", { count: m })}
                  </Button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Reglages() {
  const { t } = useTranslation();
  const { reglages, reglerAvec, rappels } = useRappelsStore();
  const [permission, setPermission] = useState<NotificationPermission | "indisponible">(
    notificationsSupportees() ? Notification.permission : "indisponible",
  );
  const { data: partageServeur } = useQuery({ queryKey: ["patient", "rappels-partage"], queryFn: patientApi.getPartageRappels });

  // Le serveur fait foi pour le consentement ; la copie locale sert hors ligne
  useEffect(() => {
    if (partageServeur && partageServeur.partageConfirmations !== reglages.partage) {
      reglerAvec({ partage: partageServeur.partageConfirmations });
    }
  }, [partageServeur, reglages.partage, reglerAvec]);

  const titresProposes = [t("rappels.notif_titre_defaut"), t("rappels.notif_titre_heure")];
  const titrePerso = reglages.titreNotification !== "" && !titresProposes.includes(reglages.titreNotification);
  const [saisieTitre, setSaisieTitre] = useState(titrePerso ? reglages.titreNotification : "");

  async function autoriser() {
    if (!notificationsSupportees()) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p !== "granted") toast.error(t("rappels.permission_refusee"));
  }

  async function changerPartage(partage: boolean) {
    try {
      await patientApi.setPartageRappels(partage);
      reglerAvec({ partage });
      if (!partage) retirerConfirmationsEnAttente();
      toast.success(t(partage ? "rappels.toast_partage_on" : "rappels.toast_partage_off"));
    } catch (err) {
      toast.error(t(estErreurReseau(err) ? "rappels.partage_hors_ligne" : "rappels.partage_erreur"));
    }
  }

  function tester() {
    const maintenant = new Date().toISOString();
    void afficherAlerte(
      { cle: "test", rappelId: "test", type: "prise", prevuLe: maintenant, etat: "en_attente", alerteA: maintenant, notifiee: true, relancee: false, limiteA: null, reports: 0, reponduLe: null },
      reglages,
    );
  }

  function telechargerAgenda() {
    const blob = new Blob([exporterIcs(rappels, reglages)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rappels.ics";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const MODES: { valeur: ModeSonore; icone: typeof Volume2 }[] = [
    { valeur: "son_vibration", icone: Volume2 },
    { valeur: "vibration", icone: Vibrate },
    { valeur: "silencieux", icone: VolumeX },
  ];

  return (
    <section className="space-y-6 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="titre-reglages">
      <h2 id="titre-reglages" className="text-lg font-bold text-foreground">{t("rappels.reglages_titre")}</h2>

      {/* Autorisation */}
      {permission === "indisponible" ? (
        <p className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">{t("rappels.notif_non_supportees")}</p>
      ) : permission !== "granted" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
          <p className="text-sm text-secondary-foreground">{t("rappels.permission_aide")}</p>
          <Button onClick={() => void autoriser()} className="h-11 rounded-full">
            <BellRing className="mr-2 h-4 w-4" aria-hidden="true" /> {t("rappels.permission_bouton")}
          </Button>
        </div>
      ) : null}

      {/* Texte de la notification */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">{t("rappels.notif_titre_label")}</legend>
        <p className="text-xs text-muted-foreground">{t("rappels.notif_titre_aide")}</p>
        <div className="flex flex-wrap gap-2">
          {titresProposes.map((titre, i) => {
            const actif = !titrePerso && (i === 0 ? reglages.titreNotification === "" || reglages.titreNotification === titre : reglages.titreNotification === titre);
            return (
              <button
                key={titre}
                type="button"
                aria-pressed={actif}
                onClick={() => reglerAvec({ titreNotification: i === 0 ? "" : titre })}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  actif ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-secondary"
                }`}
              >
                {titre}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label={t("rappels.notif_titre_perso")}
            placeholder={t("rappels.notif_titre_perso")}
            value={saisieTitre}
            maxLength={30}
            onChange={(e) => setSaisieTitre(e.target.value)}
            className="h-11 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full"
            disabled={!saisieTitre.trim()}
            onClick={() => reglerAvec({ titreNotification: saisieTitre.trim() })}
          >
            {t("rappels.appliquer")}
          </Button>
        </div>
      </fieldset>

      {/* Son */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">{t("rappels.son_label")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map(({ valeur, icone: Icone }) => (
            <label
              key={valeur}
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                reglages.modeSonore === valeur ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground hover:bg-secondary"
              }`}
            >
              <input
                type="radio"
                name="mode-sonore"
                className="sr-only"
                checked={reglages.modeSonore === valeur}
                onChange={() => reglerAvec({ modeSonore: valeur })}
              />
              <Icone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {t(`rappels.son_${valeur}`)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("rappels.son_aide")}</p>
      </fieldset>

      {/* Relance */}
      <div className="space-y-2">
        <Label htmlFor="delai-relance" className="text-sm font-semibold">{t("rappels.relance_label")}</Label>
        <select
          id="delai-relance"
          value={reglages.delaiRelanceMin}
          onChange={(e) => reglerAvec({ delaiRelanceMin: Number(e.target.value) })}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {DELAIS_RELANCE.map((m) => (
            <option key={m} value={m}>{t("rappels.dans_minutes", { count: m })}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t("rappels.relance_aide")}</p>
      </div>

      {/* Partage */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Share2 className="h-4 w-4 text-primary" aria-hidden="true" /> {t("rappels.partage_label")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(reglages.partage ? "rappels.partage_aide_on" : "rappels.partage_aide_off")}
          </p>
        </div>
        <Switch
          checked={reglages.partage}
          onCheckedChange={(v) => void changerPartage(v)}
          aria-label={t("rappels.partage_label")}
          className="mt-1"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {permission === "granted" && (
          <Button variant="outline" className="h-11 rounded-full" onClick={tester}>
            <AlarmClock className="mr-2 h-4 w-4" aria-hidden="true" /> {t("rappels.tester")}
          </Button>
        )}
        <Button variant="outline" className="h-11 rounded-full" onClick={telechargerAgenda} disabled={!rappels.some((r) => r.actif)}>
          <CalendarPlus className="mr-2 h-4 w-4" aria-hidden="true" /> {t("rappels.agenda_bouton")}
        </Button>
      </div>
      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t("rappels.limites_aide", { titre: titreNotification(reglages) })}</span>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function RappelsPage() {
  const { t, i18n } = useTranslation();
  const locale = localeAffichage(i18n.resolvedLanguage);
  const { rappels, basculer, supprimer } = useRappelsStore();
  const [formOuvert, setFormOuvert] = useState(false);
  const [edition, setEdition] = useState<Rappel | null>(null);
  const [aSupprimer, setASupprimer] = useState<Rappel | null>(null);

  const tries = useMemo(() => [...rappels].sort((a, b) => a.heure.localeCompare(b.heure)), [rappels]);

  function resumeJours(r: Rappel) {
    if (r.jours.length === 0 || r.jours.length === 7) return t("rappels.tous_les_jours");
    return ORDRE_JOURS.filter((j) => r.jours.includes(j)).map((j) => nomJour(j, locale)).join(", ");
  }

  return (
    <AppShell title={t("rappels.titre")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{t("rappels.titre")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("rappels.sous_titre")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ListenButton text={t("rappels.phrase_vocale")} />
          <Button className="h-11 rounded-full" onClick={() => { setEdition(null); setFormOuvert(true); }}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> {t("rappels.ajouter")}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <EcheancesDuJour />

        <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6" aria-labelledby="titre-liste">
          <h2 id="titre-liste" className="text-lg font-bold text-foreground">{t("rappels.liste_titre")}</h2>
          {tries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("rappels.vide")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {tries.map((r) => (
                <li key={r.id} className={`flex items-center gap-3 rounded-2xl border border-border p-3 sm:p-4 ${r.actif ? "" : "opacity-60"}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-sm font-bold text-secondary-foreground">
                    {r.heure}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{r.libelle}</p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {t(`rappels.type_${r.type}`)} · {resumeJours(r)}
                    </p>
                  </div>
                  <Switch
                    checked={r.actif}
                    onCheckedChange={() => basculer(r.id)}
                    aria-label={t(r.actif ? "rappels.desactiver" : "rappels.activer", { libelle: r.libelle })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 rounded-full text-muted-foreground"
                    onClick={() => { setEdition(r); setFormOuvert(true); }}
                    aria-label={t("rappels.modifier", { libelle: r.libelle })}
                    title={t("rappels.modifier", { libelle: r.libelle })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => setASupprimer(r)}
                    aria-label={t("rappels.supprimer", { libelle: r.libelle })}
                    title={t("rappels.supprimer", { libelle: r.libelle })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Reglages />
      </div>

      <FormulaireRappel open={formOuvert} onOpenChange={setFormOuvert} initial={edition} />

      <Dialog open={aSupprimer !== null} onOpenChange={(o) => !o && setASupprimer(null)}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("rappels.supprimer_titre")}</DialogTitle>
            <DialogDescription>{t("rappels.supprimer_confirmation", { libelle: aSupprimer?.libelle ?? "" })}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-11 rounded-full" onClick={() => setASupprimer(null)}>
              {t("rappels.annuler")}
            </Button>
            <Button
              variant="destructive"
              className="h-11 rounded-full"
              onClick={() => {
                if (aSupprimer) supprimer(aSupprimer.id);
                setASupprimer(null);
                toast(t("rappels.toast_supprime"));
              }}
            >
              {t("rappels.supprimer_bouton")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
