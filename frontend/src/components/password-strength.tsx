import { useTranslation } from "react-i18next";

export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/** Score de 0 (vide) à 4 (fort) : longueur et variété des caractères. */
export function robustesseMotDePasse(mdp: string): 0 | 1 | 2 | 3 | 4 {
  if (!mdp) return 0;
  if (mdp.length < LONGUEUR_MIN_MOT_DE_PASSE) return 1;
  let points = 0;
  if (mdp.length >= 12) points++;
  if (/[a-z]/.test(mdp) && /[A-Z]/.test(mdp)) points++;
  if (/\d/.test(mdp)) points++;
  if (/[^A-Za-z0-9]/.test(mdp)) points++;
  if (points <= 1) return 2;
  if (points <= 2) return 3;
  return 4;
}

const NIVEAUX = {
  1: { cle: "password.strength_weak", couleur: "bg-destructive" },
  2: { cle: "password.strength_fair", couleur: "bg-[hsl(var(--gold))]" },
  3: { cle: "password.strength_good", couleur: "bg-primary" },
  4: { cle: "password.strength_strong", couleur: "bg-[hsl(var(--success))]" },
} as const;

/** Indicateur de robustesse (4 segments + libellé annoncé aux lecteurs d'écran). */
export function PasswordStrength({ value, id }: { value: string; id?: string }) {
  const { t } = useTranslation();
  const score = robustesseMotDePasse(value);
  if (score === 0) return null;
  const niveau = NIVEAUX[score];
  return (
    <div id={id} className="space-y-1" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? niveau.couleur : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("password.strength_label")} <span className="font-semibold text-foreground">{t(niveau.cle)}</span>
      </p>
    </div>
  );
}
