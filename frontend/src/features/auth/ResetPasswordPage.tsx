import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { apiErrorMessage } from "@/lib/api-error";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { LONGUEUR_MIN_MOT_DE_PASSE, PasswordStrength } from "@/components/password-strength";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Page ouverte depuis le lien « mot de passe oublié » reçu par e-mail.
 * Volontairement sobre : ni nom d'application ni visuel identifiable.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const jeton = params.get("jeton") ?? "";
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    document.title = t("password.reset_title");
  }, [t]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (nouveau.length < LONGUEUR_MIN_MOT_DE_PASSE) return setErreur(t("password.error_min_length", { count: LONGUEUR_MIN_MOT_DE_PASSE }));
    if (nouveau !== confirmation) return setErreur(t("password.error_mismatch"));
    setErreur(null);
    setEnvoi(true);
    try {
      await authApi.resetPassword({ jeton, nouveau });
      setTermine(true);
    } catch (err) {
      setErreur(apiErrorMessage(err, t("errors.RESET_LINK_INVALID")));
    } finally {
      setEnvoi(false);
    }
  }

  const lienValide = /^[a-f0-9]{64}$/.test(jeton);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <LanguageSwitcher />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t("password.reset_title")}</h1>

        {termine ? (
          <div className="mt-4 space-y-5">
            <p className="flex items-start gap-2 text-sm text-foreground" role="status">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" aria-hidden="true" />
              {t("password.change_success")}
            </p>
            <Link to="/login" className={buttonVariants({ className: "h-12 w-full rounded-full text-base font-semibold" })}>
              {t("password.back_to_login")}
            </Link>
          </div>
        ) : !lienValide ? (
          <div className="mt-4 space-y-5">
            <p role="alert" className="text-sm text-destructive">{t("errors.RESET_LINK_INVALID")}</p>
            <Link to="/login" className={buttonVariants({ variant: "outline", className: "h-12 w-full rounded-full" })}>
              {t("password.back_to_login")}
            </Link>
          </div>
        ) : (
          <form onSubmit={soumettre} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="reinit-nouveau">{t("password.new")}</Label>
              <PasswordInput
                id="reinit-nouveau"
                autoComplete="new-password"
                value={nouveau}
                onChange={(e) => setNouveau(e.target.value)}
                aria-describedby="reinit-aide"
                className="h-12 rounded-xl"
                required
              />
              <p id="reinit-aide" className="text-xs text-muted-foreground">
                {t("password.rules", { count: LONGUEUR_MIN_MOT_DE_PASSE })}
              </p>
              <PasswordStrength value={nouveau} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reinit-confirmation">{t("password.confirm")}</Label>
              <PasswordInput
                id="reinit-confirmation"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="h-12 rounded-xl"
                required
              />
            </div>
            {erreur && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erreur}
              </p>
            )}
            <Button type="submit" disabled={envoi} className="h-12 w-full rounded-full text-base font-semibold">
              {envoi && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {t("password.reset_submit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
