import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mic, Play, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { NouvelleReponse, ReponseSignalement } from "@/api/patient.api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { blobVersBase64, useAudioRecorder } from "@/hooks/use-audio-recorder";
import { apiErrorMessage } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

/**
 * Fil de messages d'un signalement entre l'équipe soignante et le patient : réponses écrites
 * et/ou vocales. Même composant des deux côtés ; `moi` place ses propres messages à droite.
 */

const DUREE_MAX_S = 120;

/** Note vocale chargée seulement à la demande (fichier servi avec contrôle d'accès) */
function LecteurAudio({ id, duree, charger }: { id: number; duree: number | null; charger: (id: number) => Promise<Blob> }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (url) return <audio src={url} controls autoPlay className="mt-1 h-9 w-full max-w-[260px]" />;
  return (
    <button
      type="button"
      disabled={chargement}
      onClick={async () => {
        setChargement(true);
        try {
          setUrl(URL.createObjectURL(await charger(id)));
        } catch {
          toast.error(t("reponses.audio_erreur"));
        } finally {
          setChargement(false);
        }
      }}
      className="mt-1 inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-background"
    >
      {chargement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-primary" />}
      {t("reponses.ecouter")} {duree ? `· ${Math.floor(duree / 60)}:${String(duree % 60).padStart(2, "0")}` : ""}
    </button>
  );
}

export function FilReponses({
  cle,
  moi,
  charger,
  envoyer,
  chargerAudio,
  placeholder,
}: {
  cle: readonly unknown[];
  moi: "soignant" | "patient";
  charger: () => Promise<ReponseSignalement[]>;
  envoyer: (r: NouvelleReponse) => Promise<unknown>;
  chargerAudio: (id: number) => Promise<Blob>;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: messages, isLoading } = useQuery({ queryKey: cle, queryFn: charger });
  const [texte, setTexte] = useState("");
  const [note, setNote] = useState<{ blob: Blob; duree: number; url: string } | null>(null);
  const enregistreur = useAudioRecorder(DUREE_MAX_S);
  const dureeRef = useRef(0);
  dureeRef.current = enregistreur.duration;
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);
  useEffect(() => () => {
    if (note) URL.revokeObjectURL(note.url);
  }, [note]);

  const { mutate: publier, isPending } = useMutation({
    mutationFn: async () => {
      const corps: NouvelleReponse = {};
      if (texte.trim()) corps.texte = texte.trim();
      if (note) corps.audio = { base64: await blobVersBase64(note.blob), type: note.blob.type || "audio/webm", duree: note.duree };
      return envoyer(corps);
    },
    onSuccess: () => {
      setTexte("");
      setNote(null);
      toast.success(t(moi === "soignant" ? "reponses.envoye_patient" : "reponses.envoye_equipe"));
      queryClient.invalidateQueries({ queryKey: cle });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("reponses.erreur"))),
  });

  async function enregistrer() {
    try {
      const blob = await enregistreur.start();
      if (blob) setNote({ blob, duree: dureeRef.current, url: URL.createObjectURL(blob) });
    } catch {
      toast.error(t("reponses.micro_refuse"));
    }
  }

  const quand = (iso: string) => new Date(iso).toLocaleString(localeAffichage(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const auteur = (m: ReponseSignalement) =>
    m.auteurRole === "patient"
      ? moi === "patient"
        ? t("reponses.vous")
        : t("reponses.le_patient")
      : `${m.auteur ? `${m.auteur.prenom} ${m.auteur.nom}` : t("reponses.equipe")}${m.auteur?.soignant?.fonction ? ` · ${t(`fonction.${m.auteur.soignant.fonction}`, { defaultValue: m.auteur.soignant.fonction })}` : ""}`;

  return (
    <div>
      <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        ) : !messages || messages.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">{t(moi === "soignant" ? "reponses.vide_soignant" : "reponses.vide_patient")}</p>
        ) : (
          messages.map((m) => {
            const mien = m.auteurRole === moi;
            return (
              <div key={m.id} className={cn("flex", mien ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", mien ? "rounded-br-sm bg-primary/10" : "rounded-bl-sm bg-secondary")}>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {auteur(m)} · {quand(m.createdAt)}
                  </p>
                  {m.texte && <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{m.texte}</p>}
                  {m.audioType && <LecteurAudio id={m.id} duree={m.audioDuree} charger={chargerAudio} />}
                </div>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>

      <div className="mt-3 space-y-2 rounded-2xl border border-border p-2">
        <Textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={placeholder ?? t("reponses.placeholder")}
          className="min-h-[60px] resize-none border-0 shadow-none focus-visible:ring-0"
        />
        {note && (
          <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-2 py-1.5">
            <audio src={note.url} controls className="h-8 min-w-0 flex-1" />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setNote(null)} aria-label={t("reponses.supprimer_note")}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {enregistreur.isSupported ? (
            enregistreur.isRecording ? (
              <Button type="button" size="sm" variant="destructive" className="h-9 rounded-full" onClick={enregistreur.stop}>
                <Square className="mr-1.5 h-3.5 w-3.5" /> {t("reponses.arreter")} · {enregistreur.duration}s / {DUREE_MAX_S}s
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-9 rounded-full" onClick={() => void enregistrer()} disabled={isPending}>
                <Mic className="mr-1.5 h-3.5 w-3.5 text-primary" /> {t(note ? "reponses.reenregistrer" : "reponses.note_vocale")}
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">{t("reponses.micro_indisponible")}</span>
          )}
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full"
            disabled={isPending || enregistreur.isRecording || (!texte.trim() && !note)}
            onClick={() => publier()}
          >
            {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            {t("reponses.envoyer")}
          </Button>
        </div>
      </div>
    </div>
  );
}
