import * as React from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

/** Durée pendant laquelle le mot de passe reste lisible avant d'être remasqué. */
const DUREE_VISIBLE_MS = 10_000;

/**
 * Champ mot de passe avec bouton « œil » (afficher / masquer).
 * Discrétion : le texte repasse masqué au bout de 10 secondes et à chaque changement de page.
 */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => setVisible(false), DUREE_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  // Remasque au changement de page
  React.useEffect(() => {
    setVisible(false);
  }, [pathname]);

  const libelle = visible ? t("password.hide") : t("password.show");

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={libelle}
        aria-pressed={visible}
        aria-controls={props.id}
        title={libelle}
        disabled={props.disabled}
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-input text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
