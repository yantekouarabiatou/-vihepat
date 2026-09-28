import { useNavigate } from "react-router-dom";
import { LogOut, HeartPulse, CloudOff, RefreshCw } from "lucide-react";
import { useConnexion } from "@/hooks/use-connexion";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChatWidget } from "@/components/chat-widget";
import type { ReactNode } from "react";

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { enLigne, enAttente } = useConnexion();

  function handleSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-secondary/50 font-sans">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <HeartPulse className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="block text-sm font-extrabold tracking-tight text-foreground">
                VIHEPAT
              </span>
              <span className="block text-xs text-muted-foreground">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="rounded-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        </div>
      </header>
      {(!enLigne || enAttente > 0) && (
        <div className="border-b border-border/60 bg-secondary">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-2 text-sm text-foreground">
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

      <ChatWidget />
    </div>
  );
}
