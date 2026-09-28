import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, Eye, Loader2, ShieldAlert } from "lucide-react";
import { patientApi } from "@/api/patient.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DUREES, INTENSITES, NIVEAU_LIBELLES, SIGNES_GRAVES, SYMPTOMES, evaluerTriage, resumeSignalement,
  type Duree, type Intensite, type ResultatTriage, type SigneGraveId, type SymptomeId,
} from "@/lib/triage";
import { estErreurReseau, mettreEnAttente } from "@/lib/offline-queue";

type Etape = "symptomes" | "details" | "gravite" | "resultat";

const STYLE_NIVEAU = {
  banal: { bloc: "bg-secondary text-primary", icone: CheckCircle2 },
  a_surveiller: { bloc: "bg-[hsl(var(--gold)/0.18)] text-[hsl(var(--gold))]", icone: Eye },
  alerte: { bloc: "bg-destructive/15 text-destructive", icone: AlertTriangle },
} as const;

function Choix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
        actif ? "border-primary bg-secondary text-foreground" : "border-border text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

export function TriageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: traitements } = useQuery({ queryKey: ["patient", "traitements"], queryFn: patientApi.getTraitements });

  const [etape, setEtape] = useState<Etape>("symptomes");
  const [symptomes, setSymptomes] = useState<SymptomeId[]>([]);
  const [precision, setPrecision] = useState("");
  const [duree, setDuree] = useState<Duree>("aujourdhui");
  const [intensite, setIntensite] = useState<Intensite>("leger");
  const [signesGraves, setSignesGraves] = useState<SigneGraveId[]>([]);
  const [resultat, setResultat] = useState<ResultatTriage | null>(null);
  const [envoi, setEnvoi] = useState<"idle" | "envoi" | "envoye" | "en_attente">("idle");

  const traitementRecent = useMemo(
    () => (traitements ?? []).some((t) => Date.now() - new Date(t.dateDebut).getTime() < 60 * 86_400_000),
    [traitements],
  );

  function reinitialiser() {
    setEtape("symptomes");
    setSymptomes([]);
    setPrecision("");
    setDuree("aujourdhui");
    setIntensite("leger");
    setSignesGraves([]);
    setResultat(null);
    setEnvoi("idle");
  }

  function basculer<T>(liste: T[], v: T): T[] {
    return liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];
  }

  async function terminer() {
    const entree = { symptomes, duree, intensite, signesGraves, precision: precision.trim() || undefined, traitementRecent };
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
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comment vous sentez-vous ?</DialogTitle>
          <DialogDescription>
            Fonctionne même sans internet. Ceci ne remplace pas un avis médical.
          </DialogDescription>
        </DialogHeader>

        {etape === "symptomes" && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">Qu'est-ce que vous ressentez ? (plusieurs choix possibles)</p>
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOMES.map((s) => (
                <Choix key={s.id} actif={symptomes.includes(s.id)} onClick={() => setSymptomes((l) => basculer(l, s.id))}>
                  <span className="mr-1">{s.emoji}</span> {s.libelle}
                </Choix>
              ))}
            </div>
            {symptomes.includes("autre") && (
              <Input
                value={precision}
                onChange={(e) => setPrecision(e.target.value)}
                placeholder="Décrivez en quelques mots"
                maxLength={120}
                className="h-11 rounded-xl"
              />
            )}
            <Button className="w-full rounded-full" disabled={symptomes.length === 0} onClick={() => setEtape("details")}>
              Continuer
            </Button>
          </div>
        )}

        {etape === "details" && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">Depuis quand ?</p>
            <div className="grid gap-2">
              {DUREES.map((d) => (
                <Choix key={d.id} actif={duree === d.id} onClick={() => setDuree(d.id)}>{d.libelle}</Choix>
              ))}
            </div>
            <p className="text-sm font-semibold text-foreground">À quel point est-ce gênant ?</p>
            <div className="grid gap-2">
              {INTENSITES.map((i) => (
                <Choix key={i.id} actif={intensite === i.id} onClick={() => setIntensite(i.id)}>{i.libelle}</Choix>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => setEtape("symptomes")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Retour
              </Button>
              <Button className="flex-1 rounded-full" onClick={() => setEtape("gravite")}>Continuer</Button>
            </div>
          </div>
        )}

        {etape === "gravite" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Cochez ce qui vous arrive en ce moment. Si rien ne correspond, continuez.</span>
            </div>
            <div className="grid gap-2">
              {SIGNES_GRAVES.map((s) => (
                <Choix key={s.id} actif={signesGraves.includes(s.id)} onClick={() => setSignesGraves((l) => basculer(l, s.id))}>
                  {s.libelle}
                </Choix>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => setEtape("details")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Retour
              </Button>
              <Button className="flex-1 rounded-full" onClick={() => void terminer()}>
                {signesGraves.length ? "Voir le résultat" : "Rien de tout ça, voir le résultat"}
              </Button>
            </div>
          </div>
        )}

        {etape === "resultat" && resultat && (
          <div className="space-y-4">
            {(() => {
              const style = STYLE_NIVEAU[resultat.niveau];
              const Icone = style.icone;
              return (
                <div className={`rounded-3xl p-5 ${style.bloc}`}>
                  <div className="flex items-center gap-2">
                    <Icone className="h-6 w-6" />
                    <p className="text-xl font-extrabold">{NIVEAU_LIBELLES[resultat.niveau]}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{resultat.conseil}</p>
                </div>
              );
            })()}
            {resultat.raisons.length > 0 && (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {resultat.raisons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
            <div className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-sm text-foreground">
              {envoi === "envoi" && <><Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /> Envoi à votre équipe…</>}
              {envoi === "envoye" && <><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Votre équipe soignante a reçu votre signalement.</>}
              {envoi === "en_attente" && <><CloudOff className="h-4 w-4 shrink-0 text-primary" /> Pas de réseau : votre signalement est gardé sur le téléphone et sera envoyé dès le retour de la connexion.</>}
              {envoi === "idle" && <>Le signalement n'a pas pu être envoyé. Réessayez plus tard.</>}
            </div>
            <p className="text-xs text-muted-foreground">
              Ne modifiez pas votre traitement sans l'avis de votre soignant.
            </p>
            <Button className="w-full rounded-full" onClick={() => onOpenChange(false)}>Fermer</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
