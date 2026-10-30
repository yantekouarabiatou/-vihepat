import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, EyeOff, Loader2, MessagesSquare, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import {
  soignantApi, type CategorieAlerteGroupe, type MessageGroupeEquipe,
} from "@/api/soignant.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api-error";
import { localeAffichage } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

/**
 * Groupes de soutien vus par l'équipe soignante : lecture des discussions (sous les prénoms que
 * voient les membres) et veille des mots sensibles. Rien n'est bloqué automatiquement : le soignant
 * classe le signalement, masque le message ou contacte le patient depuis son dossier.
 */

export const ALERTE_STYLES: Record<CategorieAlerteGroupe, string> = {
  detresse: "bg-destructive/15 text-destructive",
  traitement: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  injure: "bg-destructive/10 text-destructive",
  stigmatisation: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  coordonnees: "bg-secondary text-foreground",
};

const CLE_ALERTES = ["soignant", "communautes", "alertes"] as const;

function dateHeure(iso: string) {
  return new Date(iso).toLocaleString(localeAffichage(), {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function BadgeAlerte({ categorie }: { categorie: CategorieAlerteGroupe }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${ALERTE_STYLES[categorie]}`}>
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      {t(`communautes.categories.${categorie}`)}
    </span>
  );
}

function useModeration() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; traitee?: boolean; masque?: boolean }) => soignantApi.modererMessage(id, input),
    onSuccess: (_m, v) => {
      toast.success(v.masque === true ? t("communautes.toast_masque") : v.masque === false ? t("communautes.toast_reaffiche") : t("communautes.toast_traite"));
      void queryClient.invalidateQueries({ queryKey: ["soignant", "communautes"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("communautes.toast_erreur"))),
  });
}

/** Actions de modération d'un message, communes à la liste des signalements et au fil */
function ActionsMessage({ m }: { m: MessageGroupeEquipe }) {
  const { t } = useTranslation();
  const { mutate, isPending, variables } = useModeration();
  const enCours = isPending && variables?.id === m.id;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {m.alerte?.statut === "a_traiter" && (
        <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" disabled={enCours} onClick={() => mutate({ id: m.id, traitee: true })}>
          <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-primary" />
          {t("communautes.marquer_traite")}
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" disabled={enCours} onClick={() => mutate({ id: m.id, masque: !m.masque })}>
        {m.masque ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}
        {m.masque ? t("communautes.reafficher") : t("communautes.masquer")}
      </Button>
      {m.patient && (
        <Link to={`/soignant/patients/${m.patient.id}`} className="inline-flex h-8 items-center rounded-full px-2 text-xs font-semibold text-primary hover:underline">
          {t("communautes.voir_dossier", { code: m.patient.codePatient })}
        </Link>
      )}
    </div>
  );
}

export function CommunautesPage() {
  const { t } = useTranslation();
  const [groupeId, setGroupeId] = useState<number | null>(null);

  const { data: groupes, isLoading } = useQuery({
    queryKey: ["soignant", "communautes", "groupes"],
    queryFn: soignantApi.getCommunautes,
    refetchInterval: 60_000,
  });
  const { data: alertes } = useQuery({
    queryKey: CLE_ALERTES,
    queryFn: soignantApi.getAlertesCommunautes,
    refetchInterval: 30_000,
  });

  const selection = groupeId ?? groupes?.[0]?.id ?? null;
  const groupe = groupes?.find((g) => g.id === selection);
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["soignant", "communautes", selection, "messages"],
    queryFn: () => soignantApi.getMessagesCommunaute(selection!),
    enabled: selection !== null,
    refetchInterval: 30_000,
  });

  return (
    <AppShell title={t("sidebar.role_soignant")}>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("communautes.titre")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("communautes.sous_titre")}</p>
      </div>

      {/* Signalements à traiter : les plus graves en tête */}
      <section className="mt-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{t("communautes.signalements_titre")}</h2>
          {alertes && alertes.aTraiter.length > 0 && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{alertes.aTraiter.length}</span>
          )}
        </div>
        {!alertes ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
        ) : alertes.aTraiter.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("communautes.signalements_vide")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/60">
            {alertes.aTraiter.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {m.alerte && <BadgeAlerte categorie={m.alerte.categorie} />}
                  <span className="font-semibold text-foreground">{m.auteur}</span>
                  <span>·</span>
                  <button type="button" className="hover:text-primary hover:underline" onClick={() => setGroupeId(m.groupeId)}>{m.groupe}</button>
                  <span>·</span>
                  <span>{dateHeure(m.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm text-foreground">{m.contenu}</p>
                {m.alerte && (
                  <p className="mt-1 text-xs text-muted-foreground">{t("communautes.mots_detectes", { mots: m.alerte.mots })}</p>
                )}
                {m.alerte?.categorie === "detresse" && (
                  <p className="mt-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{t("communautes.consigne_detresse")}</p>
                )}
                <div className="mt-2"><ActionsMessage m={m} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Liste des groupes */}
        <section className="min-w-0 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="px-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("communautes.groupes")}</h2>
          {isLoading ? (
            <Loader2 className="m-4 h-5 w-5 animate-spin text-primary" />
          ) : !groupes || groupes.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("communautes.aucun_groupe")}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {groupes.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setGroupeId(g.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                      g.id === selection ? "bg-primary/10" : "hover:bg-secondary/60",
                    )}
                  >
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{g.nom}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t("communautes.compteurs", { membres: g.nbMembres, messages: g.nbMessages })}
                      </span>
                    </span>
                    {g.alertesATraiter > 0 && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">{g.alertesATraiter}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Fil de discussion, en lecture */}
        <section className="min-w-0 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            <h2 className="truncate text-lg font-bold text-foreground">{groupe?.nom ?? t("communautes.discussion")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("communautes.lecture_seule")}</p>
          {messagesLoading ? (
            <Loader2 className="mt-6 h-6 w-6 animate-spin text-primary" />
          ) : !messages || messages.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">{t("communautes.aucun_message")}</p>
          ) : (
            <ul className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    m.alerte?.statut === "a_traiter" ? "border border-destructive/30 bg-destructive/5" : "bg-secondary/60",
                    m.masque && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">{m.auteur}</span>
                    <span>{dateHeure(m.createdAt)}</span>
                    {m.alerte && <BadgeAlerte categorie={m.alerte.categorie} />}
                    {m.alerte?.statut === "traitee" && <span className="text-[11px]">{t("communautes.traite")}</span>}
                    {m.masque && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{t("communautes.masque")}</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.contenu}</p>
                  <div className="mt-2"><ActionsMessage m={m} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
