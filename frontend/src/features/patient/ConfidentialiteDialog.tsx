import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { patientApi } from "@/api/patient.api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LONGUEUR_PIN, PaveNumerique, Points } from "@/components/ecran-verrou";
import { useDiscretionStore } from "@/store/discretion.store";

const ACTIONS: Record<string, string> = {
  VIEW_PATIENT: "a consulté votre dossier",
  RATTACHER_PATIENT: "vous a ajouté(e) à sa file active",
  CREATE_OBSERVATION: "a enregistré un résultat d'examen",
  CREATE_TRAITEMENT: "a ajouté un traitement",
  UPDATE_TRAITEMENT: "a modifié un traitement",
};

type EtapePin = "repos" | "saisie" | "confirmation";

function CreationPin({ onFini }: { onFini: () => void }) {
  const definirPin = useDiscretionStore((s) => s.definirPin);
  const [etape, setEtape] = useState<EtapePin>("saisie");
  const [premier, setPremier] = useState("");
  const [second, setSecond] = useState("");
  const [erreur, setErreur] = useState(false);

  function surSaisie(v: string) {
    if (etape === "saisie") {
      setPremier(v);
      if (v.length === LONGUEUR_PIN) window.setTimeout(() => setEtape("confirmation"), 150);
      return;
    }
    setSecond(v);
    if (v.length !== LONGUEUR_PIN) return;
    if (v === premier) {
      void definirPin(v).then(() => {
        toast.success("Code enregistré sur ce téléphone");
        onFini();
      });
    } else {
      setErreur(true);
      window.setTimeout(() => {
        setErreur(false);
        setPremier("");
        setSecond("");
        setEtape("saisie");
      }, 700);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-border p-4">
      <p className="text-center text-sm font-semibold text-foreground">
        {erreur ? "Les codes ne correspondent pas, recommencez" : etape === "saisie" ? "Choisissez un code à 4 chiffres" : "Confirmez votre code"}
      </p>
      <Points n={etape === "saisie" ? premier.length : second.length} erreur={erreur} />
      <PaveNumerique valeur={etape === "saisie" ? premier : second} onChange={surSaisie} desactive={erreur} />
    </div>
  );
}

export function ConfidentialiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { empreintePin, modeDiscret, basculerModeDiscret, supprimerPin } = useDiscretionStore();
  const [creation, setCreation] = useState(false);
  const { data: acces, isLoading } = useQuery({
    queryKey: ["patient", "acces"],
    queryFn: patientApi.getAccesDossier,
    enabled: open,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setCreation(false);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confidentialité</DialogTitle>
          <DialogDescription>Protégez votre carnet, surtout si vous partagez votre téléphone.</DialogDescription>
        </DialogHeader>

        {/* Code d'accès */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Code d'accès</h3>
          </div>
          {creation ? (
            <CreationPin onFini={() => setCreation(false)} />
          ) : empreintePin ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Un code protège l'ouverture de l'application. Elle se verrouille aussi quand vous la quittez plus d'une minute.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setCreation(true)}>Changer le code</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-destructive"
                  onClick={() => {
                    supprimerPin();
                    toast("Code supprimé");
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Aucun code pour l'instant : toute personne qui prend votre téléphone peut ouvrir votre carnet.
              </p>
              <Button size="sm" className="rounded-full" onClick={() => setCreation(true)}>Créer un code</Button>
            </div>
          )}
        </section>

        {/* Mode discret */}
        <section className="flex items-start justify-between gap-4 rounded-2xl bg-secondary p-4">
          <div>
            <div className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-foreground">Mode discret</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Masque le nom de la maladie, des médicaments et des examens. Appuyez sur une information pour l'afficher 5 secondes.
            </p>
          </div>
          <Switch checked={modeDiscret} onCheckedChange={basculerModeDiscret} aria-label="Mode discret" />
        </section>

        {/* Journal des accès */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Qui a accédé à mon dossier</h3>
          </div>
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          ) : !acces || acces.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun accès enregistré pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {acces.slice(0, 15).map((a) => (
                <li key={a.id} className="rounded-xl bg-secondary px-3 py-2 text-sm">
                  <p className="text-foreground">
                    <span className="font-semibold">
                      {a.acteur ? `${a.acteur.prenom} ${a.acteur.nom}` : "Un soignant"}
                    </span>{" "}
                    {ACTIONS[a.action] ?? a.action.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.acteur?.structure ? `${a.acteur.structure} · ` : ""}
                    {new Date(a.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Seuls les soignants qui vous suivent peuvent voir votre dossier. Chaque accès est enregistré.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
