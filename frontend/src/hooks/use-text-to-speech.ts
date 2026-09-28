import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Aucun moteur de synthèse vocale ne sait prononcer le fon (langue non
 * supportée par les navigateurs). Pour la démo, le fon utilise donc la voix
 * française — c'est une simulation assumée, pas une vraie prononciation fon.
 */
const LANG_VOIX: Record<string, string> = {
  fr: "fr-FR",
  en: "en-US",
  fon: "fr-FR",
};

/** Lecture à voix haute (accessibilité pour les personnes ne sachant pas lire). */
export function useTextToSpeech() {
  const { i18n } = useTranslation();
  const [enCours, setEnCours] = useState(false);
  const supporte = typeof window !== "undefined" && "speechSynthesis" in window;

  const parler = useCallback(
    (texte: string) => {
      if (!supporte || !texte.trim()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = LANG_VOIX[i18n.language] ?? "fr-FR";
      u.rate = 0.95;
      u.onstart = () => setEnCours(true);
      u.onend = () => setEnCours(false);
      u.onerror = () => setEnCours(false);
      window.speechSynthesis.speak(u);
    },
    [i18n.language, supporte],
  );

  const arreter = useCallback(() => {
    if (supporte) window.speechSynthesis.cancel();
    setEnCours(false);
  }, [supporte]);

  // Ne pas laisser une lecture continuer après le démontage du composant
  useEffect(() => () => { if (supporte) window.speechSynthesis.cancel(); }, [supporte]);

  return { parler, arreter, enCours, supporte };
}
