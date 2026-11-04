import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { CalendarCheck, Flame, HeartHandshake, PartyPopper, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Félicitations et encouragements du patient (prises confirmées, séries de jours sans oubli,
 * rendez-vous honorés). Petite : un bandeau qui disparaît seul ; grande : confettis et carte.
 * Mouvement réduit (réglage du téléphone) : pas de confettis ni d'animation.
 */

export type GenreCelebration = "prise" | "journee" | "serie" | "rdv" | "encouragement";

export interface Celebration {
  genre: GenreCelebration;
  titre: string;
  message: string;
  grande: boolean;
}

interface CelebrationState {
  courante: (Celebration & { id: number }) | null;
  celebrer: (c: Celebration) => void;
  fermer: () => void;
}

export const useCelebration = create<CelebrationState>((set) => ({
  courante: null,
  celebrer: (c) => set({ courante: { ...c, id: Date.now() } }),
  fermer: () => set({ courante: null }),
}));

/** Une étape (série, rendez-vous…) ne se fête qu'une fois par compte et par appareil */
export function premiereFois(userId: number | undefined, cle: string) {
  if (!userId) return false;
  const nom = `vihepat_celebrations_${userId}`;
  try {
    const deja = new Set<string>(JSON.parse(localStorage.getItem(nom) ?? "[]"));
    if (deja.has(cle)) return false;
    deja.add(cle);
    localStorage.setItem(nom, JSON.stringify([...deja].slice(-200)));
    return true;
  } catch {
    return true;
  }
}

const ICONES = { prise: Sparkles, journee: PartyPopper, serie: Flame, rdv: CalendarCheck, encouragement: HeartHandshake };
const COULEURS = ["hsl(var(--primary))", "hsl(var(--gold))", "#f472b6", "#34d399", "#60a5fa", "#fbbf24"];

function Confettis() {
  const morceaux = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        gauche: Math.random() * 100,
        retard: Math.random() * 0.6,
        duree: 2.2 + Math.random() * 1.6,
        derive: (Math.random() - 0.5) * 160,
        rotation: 360 + Math.random() * 720,
        taille: 6 + Math.random() * 6,
        couleur: COULEURS[i % COULEURS.length],
        rond: i % 3 === 0,
      })),
    [],
  );
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden motion-reduce:hidden">
      {morceaux.map((m, i) => (
        <span
          key={i}
          className="vihepat-confetti absolute top-[-20px] block"
          style={
            {
              left: `${m.gauche}%`,
              width: m.taille,
              height: m.rond ? m.taille : m.taille * 0.45,
              background: m.couleur,
              borderRadius: m.rond ? "9999px" : "2px",
              animationDelay: `${m.retard}s`,
              animationDuration: `${m.duree}s`,
              "--derive": `${m.derive}px`,
              "--rotation": `${m.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

const STYLES = `
@keyframes vihepat-chute { 0% { transform: translate3d(0,0,0) rotate(0); opacity: 1 } 85% { opacity: 1 } 100% { transform: translate3d(var(--derive), 105vh, 0) rotate(var(--rotation)); opacity: 0 } }
@keyframes vihepat-apparition { 0% { transform: scale(.6) translateY(20px); opacity: 0 } 60% { transform: scale(1.05) translateY(0); opacity: 1 } 100% { transform: scale(1) } }
@keyframes vihepat-bandeau { 0% { transform: translateY(-120%); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes vihepat-battement { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.15) } }
.vihepat-confetti { animation-name: vihepat-chute; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards }
.vihepat-apparition { animation: vihepat-apparition .55s cubic-bezier(.2,.9,.3,1.2) both }
.vihepat-bandeau { animation: vihepat-bandeau .35s ease-out both }
.vihepat-battement { animation: vihepat-battement 1.2s ease-in-out 3 }
@media (prefers-reduced-motion: reduce) { .vihepat-apparition, .vihepat-bandeau, .vihepat-battement { animation: none } }
`;

export function Celebrations() {
  const { t } = useTranslation();
  const { courante, fermer } = useCelebration();

  useEffect(() => {
    if (!courante) return;
    const id = window.setTimeout(fermer, courante.grande ? 7000 : 3500);
    if (courante.grande && courante.genre !== "encouragement") navigator.vibrate?.([60, 40, 60]);
    return () => window.clearTimeout(id);
  }, [courante, fermer]);

  if (!courante) return null;
  const Icone = ICONES[courante.genre];
  const doux = courante.genre === "encouragement";

  if (!courante.grande) {
    return (
      <>
        <style>{STYLES}</style>
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
          <div key={courante.id} className="vihepat-bandeau pointer-events-auto flex max-w-sm items-center gap-3 rounded-full bg-card px-4 py-2.5 shadow-[var(--shadow-card)] ring-1 ring-border">
            <span className="vihepat-battement flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icone className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-sm text-foreground">
              <span className="font-bold">{courante.titre}</span> {courante.message}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      {!doux && <Confettis key={courante.id} />}
      <div className="fixed inset-0 z-[61] flex items-center justify-center bg-background/40 px-4 backdrop-blur-[2px]" onClick={fermer}>
        <div
          key={courante.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-titre"
          onClick={(e) => e.stopPropagation()}
          className="vihepat-apparition relative w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-border"
        >
          <button type="button" onClick={fermer} aria-label={t("celebration.fermer")} className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
          <span className={`vihepat-battement mx-auto flex h-16 w-16 items-center justify-center rounded-full ${doux ? "bg-secondary text-primary" : "bg-primary text-primary-foreground"}`}>
            <Icone className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 id="celebration-titre" className="mt-4 text-xl font-extrabold text-foreground">{courante.titre}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{courante.message}</p>
          <Button className="mt-5 h-11 w-full rounded-full" onClick={fermer} autoFocus>
            {doux ? t("celebration.ok") : t("celebration.merci")}
          </Button>
        </div>
      </div>
    </>
  );
}
