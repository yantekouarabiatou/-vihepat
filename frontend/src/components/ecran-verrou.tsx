import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Delete, Leaf } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { ESSAIS_MAX, useDiscretionStore } from "@/store/discretion.store";

export const LONGUEUR_PIN = 4;

/** Pavé numérique réutilisé pour saisir ou définir un code. */
export function PaveNumerique({ valeur, onChange, desactive = false }: {
  valeur: string; onChange: (v: string) => void; desactive?: boolean;
}) {
  const { t: traduire } = useTranslation();
  const touches = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {touches.map((t, i) =>
        t === "" ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            disabled={desactive}
            aria-label={t === "⌫" ? traduire("verrou.effacer") : t}
            onClick={() => onChange(t === "⌫" ? valeur.slice(0, -1) : (valeur + t).slice(0, LONGUEUR_PIN))}
            className="flex h-16 items-center justify-center rounded-2xl bg-secondary text-2xl font-bold text-foreground transition-colors hover:bg-secondary/70 active:scale-95 disabled:opacity-50"
          >
            {t === "⌫" ? <Delete className="h-6 w-6" /> : t}
          </button>
        ),
      )}
    </div>
  );
}

export function Points({ n, erreur = false }: { n: number; erreur?: boolean }) {
  return (
    <div className={`flex justify-center gap-4 ${erreur ? "animate-pulse" : ""}`}>
      {Array.from({ length: LONGUEUR_PIN }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full border-2 ${
            erreur ? "border-destructive bg-destructive" : i < n ? "border-primary bg-primary" : "border-border"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Écran de verrouillage neutre : rien ne laisse deviner le contenu de l'application.
 * Le contenu protégé n'est pas monté tant que l'écran est affiché.
 */
export function EcranVerrou() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { verifierPin, essaisRestants } = useDiscretionStore();
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState(false);
  const [verification, setVerification] = useState(false);

  function seDeconnecter(message?: string) {
    logout();
    if (message) toast(message);
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if (pin.length !== LONGUEUR_PIN) return;
    setVerification(true);
    void verifierPin(pin).then((ok) => {
      setVerification(false);
      if (ok) return;
      setErreur(true);
      window.setTimeout(() => {
        setErreur(false);
        setPin("");
      }, 600);
    });
  }, [pin, verifierPin]);

  useEffect(() => {
    // Trop d'essais : on ferme la session (le mot de passe sera redemandé)
    if (essaisRestants <= 0) seDeconnecter(t("verrou.trop_essais"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essaisRestants]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 font-sans">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary">
          <Leaf className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">{t("app_shell.patient_app_name")}</h1>
        {/* Aucun nom affiché : l'écran ne révèle rien à une personne qui prendrait le téléphone */}
        <p className="mt-1 text-sm text-muted-foreground">{t("verrou.entrez_code")}</p>
        <div className="my-8">
          <Points n={pin.length} erreur={erreur} />
          {essaisRestants < ESSAIS_MAX && (
            <p className="mt-3 text-xs text-destructive">
              {t("verrou.code_incorrect", { count: essaisRestants })}
            </p>
          )}
        </div>
        <PaveNumerique valeur={pin} onChange={setPin} desactive={verification || erreur} />
        <button
          type="button"
          onClick={() => seDeconnecter()}
          className="mt-8 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("verrou.code_oublie")}
        </button>
      </div>
    </div>
  );
}
