import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BatteryLow,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CloudOff,
  Droplets,
  Eye,
  FileEdit,
  Frown,
  Gauge,
  HeartCrack,
  Loader2,
  Mic,
  MicOff,
  Pill,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Square,
  Thermometer,
  Trash2,
  TrendingDown,
  Volume2,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import { patientApi } from "@/api/patient.api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DUREES,
  INTENSITES,
  SIGNES_GRAVES,
  SYMPTOMES,
  evaluerTriage,
  resumeSignalement,
  type Duree,
  type Intensite,
  type ResultatTriage,
  type SigneGraveId,
  type SymptomeId,
} from "@/lib/triage";
import { estErreurReseau, mettreEnAttente } from "@/lib/offline-queue";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { ListenButton } from "@/components/listen-button";
import { cn } from "@/lib/utils";

type Etape = "symptomes" | "details" | "gravite" | "resultat";

const STYLE_NIVEAU = {
  banal: { bloc: "bg-secondary text-primary", icone: CheckCircle2 },
  a_surveiller: { bloc: "bg-[hsl(var(--gold)/0.18)] text-[hsl(var(--gold))]", icone: Eye },
  alerte: { bloc: "bg-destructive/15 text-destructive", icone: AlertTriangle },
} as const;

/** Vrais icônes représentatives et couleurs thématiques médicales pour chaque symptôme */
const SYMPTOME_ICONS: Record<
  SymptomeId,
  {
    icon: typeof Thermometer;
    color: string;
    bg: string;
    border: string;
    badgeActive: string;
  }
> = {
  fievre: {
    icon: Thermometer,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-900/40",
    badgeActive: "bg-rose-500 text-white",
  },
  toux: {
    icon: Wind,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-200 dark:border-sky-900/40",
    badgeActive: "bg-sky-500 text-white",
  },
  diarrhee: {
    icon: Activity,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-900/40",
    badgeActive: "bg-amber-600 text-white",
  },
  nausees: {
    icon: Frown,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-900/40",
    badgeActive: "bg-emerald-500 text-white",
  },
  eruption: {
    icon: Sparkles,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    border: "border-pink-200 dark:border-pink-900/40",
    badgeActive: "bg-pink-500 text-white",
  },
  jaunisse: {
    icon: Eye,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/15",
    border: "border-yellow-200 dark:border-yellow-900/40",
    badgeActive: "bg-yellow-500 text-white",
  },
  douleur_ventre: {
    icon: HeartCrack,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-900/40",
    badgeActive: "bg-orange-500 text-white",
  },
  fatigue: {
    icon: BatteryLow,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-900/40",
    badgeActive: "bg-violet-500 text-white",
  },
  maux_tete: {
    icon: Brain,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-200 dark:border-indigo-900/40",
    badgeActive: "bg-indigo-500 text-white",
  },
  amaigrissement: {
    icon: TrendingDown,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    border: "border-teal-200 dark:border-teal-900/40",
    badgeActive: "bg-teal-500 text-white",
  },
  urines_foncees: {
    icon: Droplets,
    color: "text-stone-700 dark:text-stone-300",
    bg: "bg-stone-500/15",
    border: "border-stone-200 dark:border-stone-700",
    badgeActive: "bg-stone-700 text-white",
  },
  autre: {
    icon: PlusCircle,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    badgeActive: "bg-primary text-primary-foreground",
  },
};

/** Vrais icônes représentatives pour les signes graves */
const SIGNE_GRAVE_ICONS: Record<SigneGraveId, typeof Wind> = {
  respiration: Wind,
  poitrine: HeartCrack,
  confusion: Brain,
  malaise: AlertTriangle,
  saignement: Droplets,
  vomit_traitement: Pill,
  idees_noires: ShieldAlert,
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function ChoixSymptome({
  id,
  actif,
  label,
  onClick,
}: {
  id: SymptomeId;
  actif: boolean;
  label: string;
  onClick: () => void;
}) {
  const meta = SYMPTOME_ICONS[id] ?? SYMPTOME_ICONS.autre;
  const IconComponent = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        actif
          ? "border-primary bg-primary/5 text-foreground shadow-xs ring-1 ring-primary/20"
          : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30 text-foreground"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
          actif ? meta.badgeActive : meta.bg
        )}
      >
        <IconComponent
          className={cn(
            "h-5 w-5 transition-colors",
            actif ? "text-inherit" : meta.color
          )}
        />
      </div>

      <span className="flex-1 text-xs sm:text-sm font-semibold leading-snug">
        {label}
      </span>

      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
          actif
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 group-hover:border-primary/50"
        )}
      >
        {actif && <Check className="h-3 w-3 stroke-[3]" />}
      </div>
    </button>
  );
}

function ChoixSimple({
  actif,
  onClick,
  icone: Icone,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  icone?: typeof Wind;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-all",
        actif
          ? "border-primary bg-primary/5 text-foreground shadow-xs ring-1 ring-primary/20"
          : "border-border/80 text-foreground hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      {Icone && (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            actif ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          )}
        >
          <Icone className="h-4 w-4" />
        </div>
      )}
      <span className="flex-1 font-semibold">{children}</span>
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
          actif
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30"
        )}
      >
        {actif && <Check className="h-3 w-3 stroke-[3]" />}
      </div>
    </button>
  );
}

export function TriageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: traitements } = useQuery({
    queryKey: ["patient", "traitements"],
    queryFn: patientApi.getTraitements,
  });

  const [etape, setEtape] = useState<Etape>("symptomes");
  const [symptomes, setSymptomes] = useState<SymptomeId[]>([]);
  const [precision, setPrecision] = useState("");
  const basePrecisionRef = useRef("");
  const [duree, setDuree] = useState<Duree>("aujourdhui");
  const [intensite, setIntensite] = useState<Intensite>("leger");
  const [signesGraves, setSignesGraves] = useState<SigneGraveId[]>([]);
  const [resultat, setResultat] = useState<ResultatTriage | null>(null);
  const [envoi, setEnvoi] = useState<"idle" | "envoi" | "envoye" | "en_attente">("idle");

  // Enregistrement vocal (MediaRecorder)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Reconnaissance vocale (Speech-To-Text)
  const lang = i18n.language === "en" ? "en-US" : "fr-FR";
  const {
    isSupported: micSupported,
    isListening,
    transcript,
    start: startSpeech,
    stop: stopSpeech,
  } = useSpeechRecognition(lang);

  // Synchronisation continue de la dictée dans la zone de texte
  useEffect(() => {
    if (transcript) {
      const base = basePrecisionRef.current.trim();
      setPrecision(base ? `${base} ${transcript}` : transcript);
    }
  }, [transcript]);

  // Nettoyage audio à la fermeture ou démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      stopSpeech();
    };
  }, [audioUrl, stopSpeech]);

  const traitementRecent = useMemo(
    () =>
      (traitements ?? []).some(
        (tr) => Date.now() - new Date(tr.dateDebut).getTime() < 60 * 86_400_000
      ),
    [traitements]
  );

  function resetAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingDuration(0);
    setIsRecordingAudio(false);
  }

  function reinitialiser() {
    setEtape("symptomes");
    setSymptomes([]);
    setPrecision("");
    basePrecisionRef.current = "";
    setDuree("aujourdhui");
    setIntensite("leger");
    setSignesGraves([]);
    setResultat(null);
    setEnvoi("idle");
    if (isListening) stopSpeech();
    if (isRecordingAudio) stopAudioRecording();
    resetAudio();
  }

  function basculer<T>(liste: T[], v: T): T[] {
    return liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];
  }

  // Basculer la dictée vocale (Speech-to-text)
  function toggleDictation() {
    if (!micSupported) {
      toast.info(t("triage.audio_non_supporte"));
      return;
    }
    if (isListening) {
      stopSpeech();
    } else {
      // S'assure que "autre" est coché pour afficher le conteneur
      setSymptomes((l) => (l.includes("autre") ? l : [...l, "autre"]));
      basePrecisionRef.current = precision;
      startSpeech();
    }
  }

  // Démarrer l'enregistrement audio direct (MediaRecorder)
  async function startAudioRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("L'enregistrement audio n'est pas supporté par ce navigateur.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start(250);
      setIsRecordingAudio(true);
      setRecordingDuration(0);
      setSymptomes((l) => (l.includes("autre") ? l : [...l, "autre"]));
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.warn("Audio recording error", err);
      toast.error("Impossible d'accéder au microphone. Veuillez autoriser l'accès.");
    }
  }

  // Arrêter l'enregistrement audio
  function stopAudioRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  }

  // Basculer l'enregistrement audio
  function toggleAudioRecording() {
    if (isRecordingAudio) {
      stopAudioRecording();
    } else {
      void startAudioRecording();
    }
  }

  async function terminer() {
    const noteVocale = audioBlob
      ? `Enregistrement vocal patient (${formatDuration(recordingDuration)})`
      : undefined;

    const entree = {
      symptomes,
      duree,
      intensite,
      signesGraves,
      precision: precision.trim() || undefined,
      noteVocale,
      traitementRecent,
    };
    const r = evaluerTriage(entree);
    setResultat(r);
    setEtape("resultat");

    // Envoi à l'équipe soignante, ou mise en attente si pas de réseau
    const signalement = resumeSignalement(entree, r);
    setEnvoi("envoi");
    try {
      if (!navigator.onLine) throw new Error("hors ligne");
      await patientApi.createSignalement(signalement);
      setEnvoi("envoye");
      queryClient.invalidateQueries({ queryKey: ["patient", "signalements"] });
    } catch (err) {
      if (estErreurReseau(err) || !navigator.onLine) {
        mettreEnAttente({ type: "signalement", payload: signalement });
        setEnvoi("en_attente");
      } else {
        setEnvoi("idle");
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) window.setTimeout(reinitialiser, 200);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-bold">
                {t("triage.title")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">
                {t("triage.subtitle")}
              </DialogDescription>
            </div>
            <ListenButton
              text={`${t("triage.title")}. ${t("triage.subtitle")}`}
              size="icon"
              className="mt-0.5"
            />
          </div>

          {/* Stepper visuel moderne */}
          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3 text-[11px] sm:text-xs font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  etape === "symptomes"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                )}
              >
                1
              </span>
              <span className={etape === "symptomes" ? "text-foreground font-bold" : ""}>
                Symptômes
              </span>
            </div>
            <span className="text-muted-foreground/40">›</span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  etape === "details"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                )}
              >
                2
              </span>
              <span className={etape === "details" ? "text-foreground font-bold" : ""}>
                Détails
              </span>
            </div>
            <span className="text-muted-foreground/40">›</span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  etape === "gravite"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                )}
              >
                3
              </span>
              <span className={etape === "gravite" ? "text-foreground font-bold" : ""}>
                Gravité
              </span>
            </div>
            <span className="text-muted-foreground/40">›</span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  etape === "resultat"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                )}
              >
                4
              </span>
              <span className={etape === "resultat" ? "text-foreground font-bold" : ""}>
                Résultat
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* ================= ÉTAPE 1 : SYMPTÔMES ================= */}
        {etape === "symptomes" && (
          <div className="space-y-4 pt-1">
            {/* Barre de titre et action rapide audio */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {t("triage.step1_question")}
                </p>
                <ListenButton text={t("triage.step1_question")} size="icon" />
              </div>

              {/* Bouton rapide dictée vocale */}
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="sm"
                onClick={toggleDictation}
                className={cn(
                  "h-8 rounded-full px-3 text-xs gap-1.5 font-semibold transition-all",
                  isListening
                    ? "animate-pulse"
                    : "border-primary/30 text-primary hover:bg-primary/10"
                )}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>{t("triage.arreter_dictation")}</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-primary" />
                    <span>{t("triage.dicter_vocal")}</span>
                  </>
                )}
              </Button>
            </div>

            {/* Grille avec les vrais icônes médicaux */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SYMPTOMES.map((s) => (
                <ChoixSymptome
                  key={s.id}
                  id={s.id}
                  actif={symptomes.includes(s.id)}
                  label={t(`triage.symptomes.${s.id}`)}
                  onClick={() => setSymptomes((l) => basculer(l, s.id))}
                />
              ))}
            </div>

            {/* SECTION OPTION « AUTRE » ET DESCRIPTION PERSONNELLE */}
            {symptomes.includes("autre") && (
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.03] p-4 space-y-3 transition-all animate-in fade-in-50 duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileEdit className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        {t("triage.autre_symptome_title")}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {t("triage.autre_symptome_desc")}
                      </p>
                    </div>
                  </div>
                  <ListenButton
                    text={`${t("triage.autre_symptome_title")}. ${t("triage.autre_symptome_desc")}`}
                    size="sm"
                  />
                </div>

                {/* Saisie textuelle libre pour décrire ses propres symptômes */}
                <Textarea
                  value={precision}
                  onChange={(e) => setPrecision(e.target.value)}
                  placeholder={t("triage.autre_placeholder")}
                  maxLength={300}
                  rows={3}
                  className="rounded-xl border-border/80 bg-background/90 text-sm focus-visible:ring-primary resize-none"
                />

                {/* Barre d'outils audio & enregistrement */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {/* Option Audio 1 : Dictée vocale directe */}
                  {micSupported && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isListening ? "destructive" : "outline"}
                      onClick={toggleDictation}
                      className={cn(
                        "rounded-full gap-1.5 font-medium transition-all text-xs h-9",
                        isListening
                          ? "animate-pulse shadow-sm"
                          : "border-primary/30 text-primary hover:bg-primary/10"
                      )}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="h-3.5 w-3.5" />
                          <span>{t("triage.arreter_dictation")}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5 text-primary" />
                          <span>{t("triage.dicter_vocal")}</span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* Option Audio 2 : Enregistrement d'une note vocale */}
                  <Button
                    type="button"
                    size="sm"
                    variant={isRecordingAudio ? "destructive" : "secondary"}
                    onClick={toggleAudioRecording}
                    className={cn(
                      "rounded-full gap-1.5 font-medium transition-all text-xs h-9",
                      isRecordingAudio && "animate-pulse"
                    )}
                  >
                    {isRecordingAudio ? (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        <span>
                          {formatDuration(recordingDuration)} · {t("triage.arreter_enregistrement")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>
                          {audioUrl ? t("triage.recommencer_audio") : t("triage.enregistrer_audio")}
                        </span>
                      </>
                    )}
                  </Button>

                  {precision.trim() && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {precision.trim().length}/300
                    </span>
                  )}
                </div>

                {/* Indicateur visuel d'écoute en direct */}
                {isListening && (
                  <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive animate-pulse">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                    </span>
                    <span>{t("triage.ecoute_en_cours")}</span>
                  </div>
                )}

                {/* Lecteur de note vocale enregistrée */}
                {audioUrl && !isRecordingAudio && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/80 p-2.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold truncate">
                        {t("triage.audio_enregistre")} ({formatDuration(recordingDuration)})
                      </span>
                      <audio src={audioUrl} controls className="h-7 flex-1 max-w-[200px]" />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={resetAudio}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                      title="Supprimer la note vocale"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full rounded-full font-bold h-11 shadow-xs"
              disabled={symptomes.length === 0}
              onClick={() => setEtape("details")}
            >
              {t("triage.continuer")}
            </Button>
          </div>
        )}

        {/* ================= ÉTAPE 2 : DÉTAILS ================= */}
        {etape === "details" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {t("triage.step2_depuis_quand")}
              </p>
              <ListenButton text={t("triage.step2_depuis_quand")} size="icon" />
            </div>
            <div className="grid gap-2">
              {DUREES.map((d) => (
                <ChoixSimple
                  key={d.id}
                  actif={duree === d.id}
                  icone={Clock}
                  onClick={() => setDuree(d.id)}
                >
                  {t(`triage.durees.${d.id}`)}
                </ChoixSimple>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm font-semibold text-foreground">
                {t("triage.step2_gene")}
              </p>
              <ListenButton text={t("triage.step2_gene")} size="icon" />
            </div>
            <div className="grid gap-2">
              {INTENSITES.map((i) => (
                <ChoixSimple
                  key={i.id}
                  actif={intensite === i.id}
                  icone={Gauge}
                  onClick={() => setIntensite(i.id)}
                >
                  {t(`triage.intensites.${i.id}`)}
                </ChoixSimple>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => setEtape("symptomes")}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> {t("triage.retour")}
              </Button>
              <Button
                className="flex-1 rounded-full font-bold h-11 shadow-xs"
                onClick={() => setEtape("gravite")}
              >
                {t("triage.continuer")}
              </Button>
            </div>
          </div>
        )}

        {/* ================= ÉTAPE 3 : GRAVITÉ ================= */}
        {etape === "gravite" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-2.5 rounded-2xl bg-destructive/10 p-3.5 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <span className="font-medium">{t("triage.step3_hint")}</span>
              </div>
              <ListenButton text={t("triage.step3_hint")} size="sm" />
            </div>

            <div className="grid gap-2">
              {SIGNES_GRAVES.map((s) => {
                const IconGrave = SIGNE_GRAVE_ICONS[s.id] ?? AlertTriangle;
                return (
                  <ChoixSimple
                    key={s.id}
                    actif={signesGraves.includes(s.id)}
                    icone={IconGrave}
                    onClick={() => setSignesGraves((l) => basculer(l, s.id))}
                  >
                    {t(`triage.signes_graves.${s.id}`)}
                  </ChoixSimple>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => setEtape("details")}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> {t("triage.retour")}
              </Button>
              <Button
                className="flex-1 rounded-full font-bold h-11 shadow-xs"
                onClick={() => void terminer()}
              >
                {signesGraves.length ? t("triage.voir_resultat") : t("triage.rien_voir_resultat")}
              </Button>
            </div>
          </div>
        )}

        {/* ================= ÉTAPE 4 : RÉSULTAT ================= */}
        {etape === "resultat" && resultat && (
          <div className="space-y-4 pt-1">
            {(() => {
              const style = STYLE_NIVEAU[resultat.niveau];
              const Icone = style.icone;
              return (
                <div className={cn("rounded-3xl p-5 shadow-xs", style.bloc)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Icone className="h-6 w-6 shrink-0" />
                      <p className="text-xl font-extrabold">
                        {t(`triage.niveaux.${resultat.niveau}`)}
                      </p>
                    </div>
                    <ListenButton
                      text={`${t(`triage.niveaux.${resultat.niveau}`)}. ${resultat.conseil}`}
                      size="sm"
                    />
                  </div>
                  <p className="mt-2.5 text-sm font-medium leading-relaxed text-foreground">
                    {resultat.conseil}
                  </p>
                </div>
              );
            })()}

            {resultat.raisons.length > 0 && (
              <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Motifs identifiés :</p>
                <ul className="list-inside list-disc text-sm text-foreground space-y-1">
                  {resultat.raisons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2.5 rounded-2xl bg-secondary p-3.5 text-sm text-foreground">
              {envoi === "envoi" && (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <span>{t("triage.envoi_en_cours")}</span>
                </>
              )}
              {envoi === "envoye" && (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <span>{t("triage.envoi_envoye")}</span>
                </>
              )}
              {envoi === "en_attente" && (
                <>
                  <CloudOff className="h-4 w-4 shrink-0 text-primary" />
                  <span>{t("triage.envoi_en_attente")}</span>
                </>
              )}
              {envoi === "idle" && <>{t("triage.envoi_idle")}</>}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("triage.disclaimer")}
            </p>

            <Button
              className="w-full rounded-full font-bold h-11"
              onClick={() => onOpenChange(false)}
            >
              {t("triage.fermer")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
