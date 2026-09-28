import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bouton « écouter » : lit `text` à voix haute (accessibilité illettrisme). */
export function ListenButton({ text, className, size = "icon" }: {
  text: string; className?: string; size?: "icon" | "sm";
}) {
  const { t } = useTranslation();
  const { parler, arreter, enCours, supporte } = useTextToSpeech();

  if (!supporte || !text.trim()) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size={size === "sm" ? "sm" : "icon"}
      onClick={() => (enCours ? arreter() : parler(text))}
      className={cn("shrink-0 rounded-full text-primary", className)}
      aria-label={enCours ? t("audio.stop") : t("audio.listen")}
      title={enCours ? t("audio.stop") : t("audio.listen")}
    >
      {enCours ? <VolumeX className="h-4 w-4 animate-pulse" /> : <Volume2 className="h-4 w-4" />}
      {size === "sm" && <span className="ml-1.5">{enCours ? t("audio.stop") : t("audio.listen")}</span>}
    </Button>
  );
}
