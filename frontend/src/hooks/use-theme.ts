import { useEffect, useState } from "react";

const STORAGE_KEY = "vihepat_theme";

function lireThemeInitial(): boolean {
  try {
    const stocke = localStorage.getItem(STORAGE_KEY);
    if (stocke) return stocke === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Bascule le mode sombre (classe `.dark` sur `<html>`, déjà défini dans styles.css) et le persiste. */
export function useTheme() {
  const [sombre, setSombre] = useState(lireThemeInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", sombre);
    try {
      localStorage.setItem(STORAGE_KEY, sombre ? "dark" : "light");
    } catch {
      // stockage indisponible (navigation privée) : le thème reste appliqué pour la session
    }
  }, [sombre]);

  return { sombre, basculer: () => setSombre((v) => !v) };
}
