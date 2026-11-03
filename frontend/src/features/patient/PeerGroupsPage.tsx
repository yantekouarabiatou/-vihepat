import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Flag, Heart, HeartHandshake, Loader2, Reply, Send, ShieldCheck, ThumbsUp, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { groupeApi, type MessageGroupe, type MotifSignalementMessage, type TypeReaction } from "@/api/groupe.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MOTIFS: MotifSignalementMessage[] = ["propos_blessants", "mauvais_conseil", "coordonnees", "autre"];

/** Signalement d'un message par un membre : il part à l'équipe soignante, jamais à l'auteur. */
function SignalerDialog({ message, onClose }: { message: MessageGroupe; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [motif, setMotif] = useState<MotifSignalementMessage>("mauvais_conseil");
  const [commentaire, setCommentaire] = useState("");
  const { mutate, isPending } = useMutation({
    mutationFn: () => groupeApi.signaler(message.id, motif, commentaire.trim() || undefined),
    onSuccess: () => {
      toast.success(t("groupes.signaler_ok"));
      void queryClient.invalidateQueries({ queryKey: ["patient", "groupes"] });
      onClose();
    },
    onError: () => toast.error(t("groupes.signaler_erreur")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupes.signaler_titre")}</DialogTitle>
          <DialogDescription>{t("groupes.signaler_desc")}</DialogDescription>
        </DialogHeader>
        <blockquote className="rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground">{message.contenu}</blockquote>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">{t("groupes.signaler_motif")}</legend>
          {MOTIFS.map((m) => (
            <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="motif" value={m} checked={motif === m} onChange={() => setMotif(m)} className="accent-[hsl(var(--primary))]" />
              {t(`groupes.motifs.${m}`)}
            </label>
          ))}
        </fieldset>
        <Textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value.slice(0, 300))}
          placeholder={t("groupes.signaler_commentaire")}
          rows={2}
          className="rounded-xl"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-full" onClick={onClose}>{t("groupes.annuler")}</Button>
          <Button className="rounded-full" disabled={isPending} onClick={() => mutate()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("groupes.signaler_envoyer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PeerGroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [groupeSelectionne, setGroupeSelectionne] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [reponseA, setReponseA] = useState<MessageGroupe | null>(null);
  const [aSignaler, setASignaler] = useState<MessageGroupe | null>(null);
  // Affiché après un message qui laisse penser à une détresse : les numéros d'aide, tout de suite
  const [soutien, setSoutien] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["patient", "groupes"],
    queryFn: groupeApi.getGroupes,
  });
  const groupes = data?.groupes;

  const { mutate: rejoindre, isPending: rejoindrePending } = useMutation({
    mutationFn: (groupeId: number) => groupeApi.rejoindre(groupeId),
    onSuccess: (_data, groupeId) => {
      queryClient.invalidateQueries({ queryKey: ["patient", "groupes"] });
      setGroupeSelectionne(groupeId);
    },
    onError: () => toast.error(t("groupes.toast_rejoindre_error")),
  });

  const groupe = groupes?.find((g) => g.id === groupeSelectionne);
  const cleMessages = ["patient", "groupes", groupeSelectionne, "messages"];

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: cleMessages,
    queryFn: () => groupeApi.getMessages(groupeSelectionne!),
    enabled: !!groupeSelectionne && !!groupe?.estMembre,
    refetchInterval: 10_000,
  });

  const { mutate: envoyer, isPending: envoiPending } = useMutation({
    mutationFn: () => groupeApi.postMessage(groupeSelectionne!, message.trim(), reponseA?.id),
    onSuccess: (envoye) => {
      setMessage("");
      setReponseA(null);
      if (envoye.soutien) setSoutien(true);
      queryClient.invalidateQueries({ queryKey: cleMessages });
    },
    onError: () => toast.error(t("groupes.toast_message_error")),
  });

  const { mutate: reagir } = useMutation({
    mutationFn: ({ id, type }: { id: number; type: TypeReaction }) => groupeApi.reagir(id, type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cleMessages }),
  });

  if (groupeSelectionne && groupe) {
    return (
      <AppShell title={t("groupes.title")}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setGroupeSelectionne(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{groupe.nom}</h1>
            <p className="text-sm text-muted-foreground">{t("groupes.membres_count", { count: groupe.nbMembres })}</p>
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {data?.monPseudo && <strong className="block text-foreground">{t("groupes.mon_pseudo", { pseudo: data.monPseudo })}</strong>}
            {t("groupes.veille_info")}
          </span>
        </p>

        {soutien && (
          <div role="alert" className="mt-3 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold">{t("groupes.soutien_titre")}</p>
              <p className="mt-1 text-muted-foreground">{t("groupes.soutien_texte")}</p>
            </div>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setSoutien(false)}>{t("groupes.soutien_fermer")}</Button>
          </div>
        )}

        <div className="mt-4 flex h-[60vh] flex-col rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
            {messagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !messages || messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("groupes.thread_empty")}</p>
            ) : (
              messages.map((m) => {
                const miennes = m.reactions?.miennes ?? [];
                return (
                  <div key={m.id} className={cn("flex flex-col", m.deMoi ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        m.deMoi ? "gradient-teal-coral text-white" : "bg-secondary text-foreground",
                      )}
                    >
                      {!m.deMoi && <p className="mb-0.5 text-xs font-semibold text-primary">{m.auteur}</p>}
                      {m.reponseA && (
                        <p className={cn("mb-1.5 border-l-2 pl-2 text-xs", m.deMoi ? "border-white/60 text-white/85" : "border-primary/50 text-muted-foreground")}>
                          <span className="font-semibold">{m.reponseA.auteur}</span>{" : "}
                          {m.reponseA.extrait ?? t("groupes.message_retire")}
                        </p>
                      )}
                      <span className="whitespace-pre-wrap">{m.contenu}</span>
                      {m.masque && <p className="mt-1 text-[11px] font-medium opacity-80">{t("groupes.masque_par_equipe")}</p>}
                    </div>
                    {/* Interactions : soutien, merci, répondre, signaler */}
                    <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
                      {(["soutien", "merci"] as TypeReaction[]).map((type) => {
                        const Icone = type === "soutien" ? Heart : ThumbsUp;
                        const nombre = m.reactions?.[type] ?? 0;
                        const actif = miennes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={m.masque}
                            onClick={() => reagir({ id: m.id, type })}
                            aria-pressed={actif}
                            aria-label={t(`groupes.reaction_${type}`)}
                            title={t(`groupes.reaction_${type}`)}
                            className={cn(
                              "inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs transition-colors disabled:opacity-40",
                              actif ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            <Icone className={cn("h-3.5 w-3.5", actif && type === "soutien" && "fill-current")} />
                            {nombre > 0 && <span>{nombre}</span>}
                          </button>
                        );
                      })}
                      {!m.masque && (
                        <button
                          type="button"
                          onClick={() => setReponseA(m)}
                          className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-secondary"
                        >
                          <Reply className="h-3.5 w-3.5" /> {t("groupes.repondre")}
                        </button>
                      )}
                      {!m.deMoi && !m.masque && (
                        <button
                          type="button"
                          disabled={m.signaleParMoi}
                          onClick={() => setASignaler(m)}
                          className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-60"
                        >
                          <Flag className="h-3.5 w-3.5" /> {m.signaleParMoi ? t("groupes.deja_signale") : t("groupes.signaler")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {reponseA && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
              <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="line-clamp-2 flex-1">
                <span className="font-semibold text-foreground">{t("groupes.reponse_a", { auteur: reponseA.deMoi ? t("groupes.vous") : reponseA.auteur })}</span>{" "}
                {reponseA.contenu}
              </p>
              <button type="button" onClick={() => setReponseA(null)} aria-label={t("groupes.annuler")} className="rounded-full p-0.5 hover:bg-background">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) envoyer();
            }}
            className="mt-2 flex items-center gap-2 border-t border-border pt-3"
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("groupes.message_placeholder")}
              className="h-10 flex-1 rounded-full"
              disabled={envoiPending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={envoiPending || !message.trim()}
              className="h-10 w-10 shrink-0 rounded-full"
              aria-label={t("dashboard_patient.rdv_dialog_submit")}
            >
              {envoiPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>

        {aSignaler && <SignalerDialog message={aSignaler} onClose={() => setASignaler(null)} />}
      </AppShell>
    );
  }

  return (
    <AppShell title={t("groupes.title")}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t("groupes.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("groupes.subtitle")}</p>
        </div>
      </div>

      {data?.monPseudo && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("groupes.mon_pseudo", { pseudo: data.monPseudo })}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !groupes || groupes.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("groupes.empty")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {groupes.map((g) => (
            <div key={g.id} className="flex flex-col rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                  {g.pathologie ? t(`shared.pathologie.${g.pathologie}`) : t("groupes.ouvert_a_tous")}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">{g.nom}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{g.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("groupes.membres_count", { count: g.nbMembres })}
                </span>
                {g.estMembre ? (
                  <Button size="sm" className="rounded-full" onClick={() => setGroupeSelectionne(g.id)}>
                    {t("groupes.voir_messages")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={rejoindrePending}
                    onClick={() => rejoindre(g.id)}
                  >
                    {t("groupes.rejoindre")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
