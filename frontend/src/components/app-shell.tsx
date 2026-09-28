import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, CloudOff, RefreshCw, Leaf, Lock, Settings, Shield, Sun, Moon, Users, Globe } from "lucide-react";
import { toast } from "sonner";
import { useConnexion } from "@/hooks/use-connexion";
import { useAuthStore } from "@/store/auth.store";
import { useDiscretionStore } from "@/store/discretion.store";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallButton } from "@/components/install-button";
import { ChatWidget } from "@/components/chat-widget";
import { EcranVerrou } from "@/components/ecran-verrou";
import { ConfidentialiteDialog } from "@/features/patient/ConfidentialiteDialog";
import { SoignantSidebar } from "@/components/soignant-sidebar";
import { SoignantTopbar } from "@/components/soignant-topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Délai en arrière-plan au-delà duquel l'application se reverrouille. */
const DELAI_VERROU_MS = 60_000;

function OfflineBanner({ enLigne, enAttente }: { enLigne: boolean; enAttente: number }) {
  const { t } = useTranslation();
  if (enLigne && enAttente === 0) return null;
  return (
    <div className="border-b border-border/60 bg-secondary">
      <div className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground sm:px-6">
        {enLigne ? (
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <CloudOff className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span>
          {enLigne
            ? t("app_shell.offline_sync")
            : `${t("app_shell.offline_mode")}${enAttente > 0 ? ` ${t("app_shell.offline_pending", { count: enAttente })}` : ""}`}
        </span>
      </div>
    </div>
  );
}

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const estPatient = user?.role === "patient";
  const estAdmin = user?.role === "admin";
  const estSoignantOuAdmin = user?.role === "soignant" || estAdmin;
  const { enLigne, enAttente } = useConnexion();
  const { charger, verrouille, verrouiller, empreintePin } = useDiscretionStore();
  const { sombre, basculer } = useTheme();
  const [confidentialiteOpen, setConfidentialiteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const cacheDepuis = useRef<number | null>(null);

  useEffect(() => {
    charger(estPatient ? user?.id ?? null : null);
  }, [charger, estPatient, user?.id]);

  // Côté patient, l'onglet et l'application affichent un nom neutre
  useEffect(() => {
    document.title = estPatient ? "Mon carnet" : "VIHEPAT - Espace soignant";
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
      toast(t("app_shell.creer_code_toast"));
      setConfidentialiteOpen(true);
    }
  }

  // Écran verrouillé : le contenu protégé n'est pas monté du tout
  if (estPatient && verrouille) return <EcranVerrou />;

  if (estSoignantOuAdmin) {
    return (
      <div className="flex min-h-screen bg-secondary/30 font-sans">
        {/* Sidebar fixe (desktop) */}
        <aside className="hidden shrink-0 lg:block lg:w-[260px]">
          <div className="sticky top-0 h-screen border-r border-border/60">
            <SoignantSidebar admin={estAdmin} />
          </div>
        </aside>

        {/* Tiroir (mobile) */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SoignantSidebar admin={estAdmin} onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <SoignantTopbar admin={estAdmin} onOpenSidebar={() => setSidebarOpen(true)} />
          <OfflineBanner enLigne={enLigne} enAttente={enAttente} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>

        {/* Bouton flottant « paramètres » */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("app_shell.parametres_tooltip")}
              title={t("app_shell.parametres_tooltip")}
              className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-dash transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Settings className="h-6 w-6" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 rounded-card p-3 shadow-dash">
            <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("app_shell.parametres_tooltip")}
            </p>
            <button
              type="button"
              onClick={basculer}
              className="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
            >
              {sombre ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {sombre ? t("app_shell.theme_clair") : t("app_shell.theme_sombre")}
            </button>
            <div className="mt-1 flex items-center justify-between rounded-input px-3 py-2">
              <span className="text-sm font-medium text-foreground">{t("app_shell.langue_label")}</span>
              <LanguageSwitcher />
            </div>
          </PopoverContent>
        </Popover>

        <ChatWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/50 font-sans">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link
            to="/"
            title="Accéder au site public VIHEPAT"
            className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-85"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-tight text-foreground">Mon carnet</span>
              <span className="block truncate text-xs text-muted-foreground">Mon espace</span>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-secondary hover:text-primary transition-all shadow-xs"
              title="Accéder au site public VIHEPAT"
            >
              <Globe className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Site public</span>
            </Link>
            <InstallButton />
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/groupes")}
              className="rounded-full text-muted-foreground"
              aria-label={t("app_shell.groupes_tooltip")}
              title={t("app_shell.groupes_tooltip")}
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfidentialiteOpen(true)}
              className="rounded-full text-muted-foreground"
              aria-label={t("app_shell.confidentialite_tooltip")}
              title={t("app_shell.confidentialite_tooltip")}
            >
              <Shield className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={surVerrouiller}
              className="rounded-full text-muted-foreground"
              aria-label={t("app_shell.verrouiller_tooltip")}
              title={t("app_shell.verrouiller_tooltip")}
            >
              <Lock className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="rounded-full text-muted-foreground"
              aria-label={t("app_shell.deconnexion")}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t("app_shell.deconnexion")}</span>
            </Button>
          </div>
        </div>
      </header>
      <OfflineBanner enLigne={enLigne} enAttente={enAttente} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>

      <ConfidentialiteDialog open={confidentialiteOpen} onOpenChange={setConfidentialiteOpen} />
      <ChatWidget />
    </div>
  );
}
