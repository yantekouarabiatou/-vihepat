import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";

export function InstallButton({ variant = "default" }: { variant?: "default" | "glass" }) {
  const { t } = useTranslation();
  const { peutInstaller, installer } = usePwaInstall();

  if (!peutInstaller) return null;

  async function onClick() {
    const accepte = await installer();
    if (accepte) toast.success(t("install.success"));
  }

  return (
    <Button
      size="sm"
      onClick={onClick}
      aria-label={t("install.cta")}
      title={t("install.cta")}
      className={
        variant === "glass"
          ? "rounded-full glass-dark text-white hover:bg-white/15 hover:text-white"
          : "rounded-full"
      }
    >
      <Download className="h-4 w-4 sm:mr-1.5" />
      {/* Libellé masqué sur petit écran : l'icône seule suffit et évite le débordement */}
      <span className="hidden sm:inline">{t("install.cta")}</span>
    </Button>
  );
}
