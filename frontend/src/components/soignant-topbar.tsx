import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, ExternalLink, Globe, History, Menu, Moon, Search, Sun } from "lucide-react";
import { soignantApi } from "@/api/soignant.api";
import { useAuthStore } from "@/store/auth.store";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallButton } from "@/components/install-button";

function initiales(nom: string, prenom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

export function SoignantTopbar({ admin, onOpenSidebar }: { admin: boolean; onOpenSidebar: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { sombre, basculer } = useTheme();

  const { data: communiques } = useQuery({
    queryKey: ["soignant", "communiques"],
    queryFn: soignantApi.getCommuniques,
    staleTime: 60_000,
  });

  const recents = useMemo(() => (communiques ?? []).slice(0, 5), [communiques]);
  const nouveau = useMemo(() => {
    if (!communiques || communiques.length === 0) return false;
    const dernier = new Date(communiques[0]!.createdAt).getTime();
    return Date.now() - dernier < 24 * 60 * 60 * 1000;
  }, [communiques]);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 shrink-0 rounded-input lg:hidden"
          onClick={onOpenSidebar}
          aria-label={t("app_shell.menu_tooltip")}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("app_shell.search_placeholder")}
            className="h-11 w-full rounded-full border border-border bg-secondary/40 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground/85 hover:bg-secondary hover:text-primary transition-all shadow-xs"
            title="Accéder au site public VIHEPAT"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Site public</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </Link>

          <InstallButton />

          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-input text-muted-foreground hover:text-foreground"
            onClick={basculer}
            aria-label={t("app_shell.theme_tooltip")}
            title={t("app_shell.theme_tooltip")}
          >
            {sombre ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {admin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-input text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/soignant/administration?table=audit_logs")}
              aria-label={t("app_shell.historique_tooltip")}
              title={t("app_shell.historique_tooltip")}
            >
              <History className="h-4 w-4" />
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="relative h-10 w-10 rounded-input text-muted-foreground hover:text-foreground"
                aria-label={t("app_shell.notifications_tooltip")}
                title={t("app_shell.notifications_tooltip")}
              >
                <Bell className="h-4 w-4" />
                {nouveau && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 rounded-card p-0 shadow-dash">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-bold text-foreground">{t("app_shell.notifications_title")}</p>
              </div>
              {recents.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {t("app_shell.notifications_empty")}
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {recents.map((c) => (
                    <li key={c.id} className="px-4 py-3 hover:bg-secondary/50">
                      <p className="text-sm font-semibold text-foreground">{c.titre}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.contenu}</p>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>

          <LanguageSwitcher />

          <div className="ml-1 hidden items-center gap-2 rounded-full border border-border bg-secondary/40 px-2 py-1 sm:flex">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                {user ? initiales(user.nom, user.prenom) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 pr-1">
              <p className="truncate text-xs font-semibold leading-tight text-foreground">
                {user ? `${user.prenom} ${user.nom}` : ""}
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {admin ? t("sidebar.role_admin") : t("sidebar.role_soignant")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
