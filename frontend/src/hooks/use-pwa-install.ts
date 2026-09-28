import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function estDejaInstallee() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

/** Capture l'invite d'installation PWA du navigateur (Chrome/Edge/Android) pour afficher un bouton natif. */
export function usePwaInstall() {
  const [evenement, setEvenement] = useState<BeforeInstallPromptEvent | null>(null);
  const [installee, setInstallee] = useState(estDejaInstallee);

  useEffect(() => {
    const surPropose = (e: Event) => {
      e.preventDefault();
      setEvenement(e as BeforeInstallPromptEvent);
    };
    const surInstallee = () => {
      setInstallee(true);
      setEvenement(null);
    };
    window.addEventListener("beforeinstallprompt", surPropose);
    window.addEventListener("appinstalled", surInstallee);
    return () => {
      window.removeEventListener("beforeinstallprompt", surPropose);
      window.removeEventListener("appinstalled", surInstallee);
    };
  }, []);

  async function installer() {
    if (!evenement) return false;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    setEvenement(null);
    return outcome === "accepted";
  }

  return { peutInstaller: !!evenement && !installee, installee, installer };
}
