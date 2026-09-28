import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, HeartPulse, CloudOff, RefreshCw, Leaf, Lock, Shield } from "lucide-react";
import { toast } from "sonner";
import { useConnexion } from "@/hooks/use-connexion";
import { useAuthStore } from "@/store/auth.store";
import { useDiscretionStore } from "@/store/discretion.store";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChatWidget } from "@/components/chat-widget";
import { EcranVerrou } from "@/components/ecran-verrou";
import { ConfidentialiteDialog } from "@/features/patient/ConfidentialiteDialog";

/** Délai en arrière-plan au-delà duquel l'application se reverrouille. */
const DELAI_VERROU_MS = 60_000;

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const estPatient = user?.role === "patient";
  const { enLigne, enAttente } = useConnexion();
  const { charger, verrouille, verrouiller, empreintePin } = useDiscretionStore();
  const [confidentialiteOpen, setConfidentialiteOpen] = useState(false);
  const cacheDepuis = useRef<number | null>(null);

  useEffect(() => {
    charger(estPatient ? user?.id ?? null : null);
  }, [charger, estPatient, user?.id]);

  // Côté patient, l'onglet et l'application affichent un nom neutre
  useEffect(() => {
    document.title = estPatient ? "Mon carnet" : "VIHEPAT — Espace soignant";
  }, [estPatient]);

  // Verrouillage automatique après un passage en arrière-plan
  useEffect(() => {
    if (!estPatient) return;
    const surVisibilite = () => {
      if (document.hidden) cacheDepuis.current = Date.now();
      else if (cacheDepuis.current && Date.now() - cacheDepuis.current > DELAI_VERROU_MS) verrouiller();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => document.removeEventListener("visibilitychange", surVisibilite);
  }, [estPatient, verrouiller]);

  function handleSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  function surVerrouiller() {
    if (empreintePin) {
      verrouiller();
    } else {
      toast("Créez d'abord un code d'accès");
      setConfidentialiteOpen(true);
    }
  }

  // Écran verrouillé : le contenu protégé n'est pas monté du tout
  if (estPatient && verrouille) return <EcranVerrou />;

  return (
    <div className="min-h-screen bg-secondary/50 font-sans">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
              {estPatient ? (
                <Leaf className="h-5 w-5 text-primary-foreground" />
              ) : (
                <HeartPulse className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-tight text-foreground">
                {estPatient ? "Mon carnet" : "VIHEPAT"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{estPatient ? "Mon espace" : title}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            {estPatient && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfidentialiteOpen(true)}
                  className="rounded-full text-muted-foreground"
                  aria-label="Confidentialité"
                  title="Confidentialité"
                >
                  <Shield className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={surVerrouiller}
                  className="rounded-full text-muted-foreground"
                  aria-label="Verrouiller"
                  title="Verrouiller maintenant"
                >
                  <Lock className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="rounded-full text-muted-foreground"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Se déconnecter</span>
            </Button>
          </div>
        </div>
      </header>
      {(!enLigne || enAttente > 0) && (
        <div className="border-b border-border/60 bg-secondary">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2 text-sm text-foreground sm:px-6">
            {enLigne ? (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : (
              <CloudOff className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span>
              {enLigne
                ? "Envoi de vos saisies en cours…"
                : `Mode hors ligne : l'application reste utilisable.${
                    enAttente > 0 ? ` ${enAttente} saisie${enAttente > 1 ? "s" : ""} en attente d'envoi.` : ""
                  }`}
            </span>
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>

      {estPatient && <ConfidentialiteDialog open={confidentialiteOpen} onOpenChange={setConfidentialiteOpen} />}
      <ChatWidget />
    </div>
  );
}
