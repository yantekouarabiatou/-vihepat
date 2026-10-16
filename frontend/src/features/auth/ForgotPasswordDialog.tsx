import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MailCheck } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { apiErrorMessage } from "@/lib/api-error";
import { estErreurReseau } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * « Mot de passe oublié » discret : le message affiché est le même que l'adresse
 * corresponde à un compte ou non (aucune révélation de l'existence d'un compte).
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultEmail = "",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultEmail?: string;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(defaultEmail);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setEnvoye(false);
      setErreur(null);
    }
  }, [open, defaultEmail]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await authApi.forgotPassword(email.trim());
      setEnvoye(true);
    } catch (err) {
      // Seules les erreurs techniques sont signalées ; jamais « compte inconnu »
      setErreur(estErreurReseau(err) ? t("password.forgot_offline") : apiErrorMessage(err, t("password.error_generic")));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("password.forgot_title")}</DialogTitle>
          <DialogDescription>{t("password.forgot_desc")}</DialogDescription>
        </DialogHeader>

        {envoye ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-foreground" role="status">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              {t("password.forgot_done")}
            </p>
            <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={() => onOpenChange(false)}>
              {t("password.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={soumettre} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oubli-email">{t("auth.email")}</Label>
              <Input
                id="oubli-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.email_placeholder")}
                required
                className="h-12 rounded-xl"
              />
            </div>
            {erreur && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erreur}
              </p>
            )}
            <Button type="submit" disabled={envoi || !email.trim()} className="h-12 w-full rounded-full text-base font-semibold">
              {envoi && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {t("password.forgot_submit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
