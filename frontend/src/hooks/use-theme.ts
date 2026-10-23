import { useEffect } from "react";
import { create } from "zustand";

const STORAGE_KEY = "vihepat_theme";

/** `systeme` suit le réglage du téléphone ; sans choix enregistré, l'application est en clair. */
export type ModeTheme = "clair" | "sombre" | "systeme";

function lireMode(): ModeTheme {
  try {
    const stocke = localStorage.getItem(STORAGE_KEY);
    // Anciennes valeurs ("dark" / "light") conservées
    if (stocke === "dark" || stocke === "sombre") return "sombre";
    if (stocke === "systeme") return "systeme";
  } catch {
    // stockage indisponible (navigation privée)
  }
  return "clair";
}

function systemeSombre() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function appliquer(mode: ModeTheme) {
  const sombre = mode === "sombre" || (mode === "systeme" && systemeSombre());
  document.documentElement.classList.toggle("dark", sombre);
  document.documentElement.style.colorScheme = sombre ? "dark" : "light";
  return sombre;
}

interface ThemeState {
  mode: ModeTheme;
  sombre: boolean;
  choisir: (mode: ModeTheme) => void;
}

/** Un seul état partagé : tous les boutons de thème de l'écran restent synchronisés. */
const useThemeStore = create<ThemeState>((set) => {
  const mode = lireMode();
  return {
    mode,
    sombre: appliquer(mode),
    choisir: (m) => {
      try {
        localStorage.setItem(STORAGE_KEY, m);
      } catch {
        // le thème reste appliqué pour la session
      }
      set({ mode: m, sombre: appliquer(m) });
    },
  };
});

export function useTheme() {
  const { mode, sombre, choisir } = useThemeStore();

  // Mode « système » : suit le changement de réglage du téléphone en direct
  useEffect(() => {
    if (mode !== "systeme") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangement = () => useThemeStore.setState({ sombre: appliquer("systeme") });
    mq.addEventListener("change", surChangement);
    return () => mq.removeEventListener("change", surChangement);
  }, [mode]);

  return { mode, sombre, choisir, basculer: () => choisir(sombre ? "clair" : "sombre") };
}
