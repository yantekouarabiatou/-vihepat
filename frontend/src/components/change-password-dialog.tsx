import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { apiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { LONGUEUR_MIN_MOT_DE_PASSE, PasswordStrength } from "@/components/password-strength";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Changement du mot de passe par l'utilisateur connecté (patient ou soignant).
 * Le serveur vérifie le mot de passe actuel, ferme les autres sessions et renvoie
 * de nouveaux jetons pour la session courante. Message de confirmation neutre.
 */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  function reinitialiser() {
    setActuel("");
    setNouveau("");
    setConfirmation("");
    setErreur(null);
  }

  function validerLocalement(): string | null {
    if (!actuel) return t("password.error_current_required");
    if (nouveau.length < LONGUEUR_MIN_MOT_DE_PASSE) return t("password.error_min_length", { count: LONGUEUR_MIN_MOT_DE_PASSE });
    if (nouveau === actuel) return t("password.error_same");
    if (nouveau !== confirmation) return t("password.error_mismatch");
    return null;
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const probleme = validerLocalement();
    setErreur(probleme);
    if (probleme) return;
    setEnvoi(true);
    try {
      const jetons = await authApi.changePassword({ actuel, nouveau });
      setTokens(jetons.accessToken, jetons.refreshToken);
      toast.success(t("password.change_success"));
      reinitialiser();
      onOpenChange(false);
    } catch (err) {
      setErreur(apiErrorMessage(err, t("password.error_generic")));
    } finally {
      setEnvoi(false);
    }
  }

  const confirmationFausse = confirmation.length > 0 && confirmation !== nouveau;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reinitialiser();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("password.change_title")}</DialogTitle>
          <DialogDescription>{t("password.change_subtitle")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={soumettre} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="mdp-actuel">{t("password.current")}</Label>
            <PasswordInput
              id="mdp-actuel"
              autoComplete="current-password"
              value={actuel}
              onChange={(e) => setActuel(e.target.value)}
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mdp-nouveau">{t("password.new")}</Label>
            <PasswordInput
              id="mdp-nouveau"
              autoComplete="new-password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              aria-describedby="mdp-nouveau-aide mdp-nouveau-force"
              className="h-12 rounded-xl"
              minLength={LONGUEUR_MIN_MOT_DE_PASSE}
              required
            />
            <p id="mdp-nouveau-aide" className="text-xs text-muted-foreground">
              {t("password.rules", { count: LONGUEUR_MIN_MOT_DE_PASSE })}
            </p>
            <PasswordStrength id="mdp-nouveau-force" value={nouveau} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mdp-confirmation">{t("password.confirm")}</Label>
            <PasswordInput
              id="mdp-confirmation"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              aria-invalid={confirmationFausse || undefined}
              className="h-12 rounded-xl"
              required
            />
            {confirmationFausse && <p className="text-xs text-destructive">{t("password.error_mismatch")}</p>}
          </div>

          {erreur && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erreur}
            </p>
          )}

          <Button type="submit" disabled={envoi} className="h-12 w-full rounded-full text-base font-semibold">
            {envoi && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {t("password.change_submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
