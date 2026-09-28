import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Database, Globe, HeartPulse, LayoutDashboard, LogOut, Megaphone, Users, UserPlus, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

function initiales(nom: string, prenom: string) {
  return `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();
}

/**
 * Contenu de la navigation soignant/admin — sans mise en page propre (largeur,
 * position fixe) : c'est à l'appelant (AppShell) de le placer, en colonne fixe
 * sur desktop ou dans un tiroir (Sheet) sur mobile.
 */
export function SoignantSidebar({ admin, onNavigate }: { admin: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const groups: NavGroup[] = [
    {
      title: t("sidebar.section_general"),
      items: [
        { to: "/soignant/dashboard", icon: LayoutDashboard, label: t("sidebar.dashboard") },
        { to: "/", icon: Globe, label: "Site public" },
      ],
    },
    {
      title: t("sidebar.section_patients", { defaultValue: "Gestion des Patients" }),
      items: [
        { to: "/soignant/patients", icon: Users, label: t("sidebar.patients_index", { defaultValue: "Répertoire des patients" }) },
        { to: "/soignant/patients?action=nouveau", icon: UserPlus, label: t("sidebar.patients_nouveau", { defaultValue: "Nouveau patient" }) },
        { to: "/soignant/patients?view=gestion", icon: UserCog, label: t("sidebar.patients_gestion", { defaultValue: "Modification & Fiches" }) },
      ],
    },
    {
      title: t("sidebar.section_communication"),
      items: [{ to: "/soignant/communiques", icon: Megaphone, label: t("sidebar.communiques") }],
    },
    ...(admin
      ? [
          {
            title: t("sidebar.section_administration"),
            items: [{ to: "/soignant/administration", icon: Database, label: t("sidebar.administration") }],
          },
        ]
      : []),
  ];

  function isItemActive(to: string): boolean {
    if (to.includes("?")) {
      const [path, search] = to.split("?");
      return location.pathname === path && location.search.includes(search);
    }
    return location.pathname === to && (!location.search || location.search === "");
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Bloc logo cliquable vers le site public */}
      <Link
        to="/"
        onClick={onNavigate}
        title="Accéder au site public VIHEPAT"
        className="group flex items-center gap-3 bg-[linear-gradient(160deg,hsl(var(--brand))_0%,hsl(var(--brand-deep))_100%)] px-5 py-6 transition-all hover:brightness-105"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 transition-transform group-hover:scale-105">
          <HeartPulse className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-base font-extrabold tracking-tight text-primary-foreground">VIHEPAT</p>
            <Globe className="h-3 w-3 text-primary-foreground/50 transition-colors group-hover:text-primary-foreground" />
          </div>
          <p className="truncate text-xs text-primary-foreground/70">
            {admin ? t("sidebar.role_admin") : t("sidebar.role_soignant")}
          </p>
        </div>
      </Link>

      {/* Navigation groupée */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {g.title}
            </p>
            <div className="space-y-1">
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={() =>
                    cn(
                      "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors duration-150",
                      isItemActive(item.to)
                        ? "bg-primary text-primary-foreground shadow-dash"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bloc utilisateur */}
      <div className="m-3 rounded-card bg-[linear-gradient(160deg,hsl(var(--brand))_0%,hsl(var(--brand-deep))_100%)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-primary-foreground">
            {user ? initiales(user.nom, user.prenom) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary-foreground">
              {user ? `${user.prenom} ${user.nom}` : ""}
            </p>
            <p className="truncate text-xs text-primary-foreground/70">
              {admin ? t("sidebar.role_admin") : t("sidebar.role_soignant")}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-input bg-white/10 text-primary-foreground hover:bg-white/20"
            onClick={handleLogout}
            aria-label={t("app_shell.deconnexion")}
            title={t("app_shell.deconnexion")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
