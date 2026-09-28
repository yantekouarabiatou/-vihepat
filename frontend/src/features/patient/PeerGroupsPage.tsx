import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { groupeApi } from "@/api/groupe.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PeerGroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [groupeSelectionne, setGroupeSelectionne] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const { data: groupes, isLoading } = useQuery({
    queryKey: ["patient", "groupes"],
    queryFn: groupeApi.getGroupes,
  });

  const { mutate: rejoindre, isPending: rejoindrePending } = useMutation({
    mutationFn: (groupeId: number) => groupeApi.rejoindre(groupeId),
    onSuccess: (_data, groupeId) => {
      queryClient.invalidateQueries({ queryKey: ["patient", "groupes"] });
      setGroupeSelectionne(groupeId);
    },
    onError: () => toast.error(t("groupes.toast_rejoindre_error")),
  });

  const groupe = groupes?.find((g) => g.id === groupeSelectionne);

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["patient", "groupes", groupeSelectionne, "messages"],
    queryFn: () => groupeApi.getMessages(groupeSelectionne!),
    enabled: !!groupeSelectionne && !!groupe?.estMembre,
    refetchInterval: 10_000,
  });

  const { mutate: envoyer, isPending: envoiPending } = useMutation({
    mutationFn: () => groupeApi.postMessage(groupeSelectionne!, message.trim()),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["patient", "groupes", groupeSelectionne, "messages"] });
    },
    onError: () => toast.error(t("groupes.toast_message_error")),
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

        <div className="mt-6 flex h-[55vh] flex-col rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
            {messagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !messages || messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("groupes.thread_empty")}
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.deMoi ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.deMoi ? "gradient-teal-coral text-white" : "bg-secondary text-foreground"
                    )}
                  >
                    {!m.deMoi && <p className="mb-0.5 text-xs font-semibold text-primary">{m.auteur}</p>}
                    {m.contenu}
                  </div>
                </div>
              ))
            )}
          </div>

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
