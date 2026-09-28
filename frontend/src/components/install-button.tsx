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
      className={
        variant === "glass"
          ? "rounded-full glass-dark text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          : "rounded-full"
      }
    >
      <Download className="mr-1.5 h-4 w-4" />
      {t("install.cta")}
    </Button>
  );
}
