import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type ModeTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ mode: ModeTheme; icon: typeof Sun }> = [
  { mode: "clair", icon: Sun },
  { mode: "sombre", icon: Moon },
  { mode: "systeme", icon: Monitor },
];

/** Choix explicite du thème : Clair / Sombre / Système. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { mode, choisir } = useTheme();

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {t("theme.titre")}
      </p>
      <div role="radiogroup" aria-label={t("theme.titre")} className="grid grid-cols-3 gap-1 rounded-full bg-secondary/60 p-1">
        {OPTIONS.map(({ mode: m, icon: Icon }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => choisir(m)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors",
              mode === m
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(`theme.${m}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
