import type { AlerteExamen, JourObservance } from "@/api/patient.api";

/** Couleur associée à un taux d'observance (repère usuel : ≥ 95 % bonne observance). */
export function tauxStyle(taux: number | null | undefined): string {
  if (taux === null || taux === undefined) return "bg-muted text-muted-foreground";
  if (taux >= 95) return "bg-secondary text-primary";
  if (taux >= 80) return "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]";
  return "bg-destructive/15 text-destructive";
}

export function formatTaux(taux: number | null | undefined): string {
  return taux === null || taux === undefined ? "—" : `${taux} %`;
}

const JOURS_COURTS = ["D", "L", "M", "M", "J", "V", "S"];

/** Mini-histogramme des 14 derniers jours : hauteur = part des prises effectuées. */
export function ObservanceBars({ jours }: { jours: JourObservance[] }) {
  return (
    <div className="flex h-20 items-end gap-1" role="img" aria-label="Observance des 14 derniers jours">
      {jours.map((j) => {
        const ratio = j.prevues > 0 ? j.prises / j.prevues : null;
        const couleur =
          ratio === null ? "bg-muted" : ratio >= 1 ? "bg-primary" : ratio > 0 ? "bg-[hsl(var(--gold))]" : "bg-destructive/70";
        const jour = new Date(`${j.date}T12:00:00`);
        return (
          <div key={j.date} className="flex flex-1 flex-col items-center gap-1" title={`${jour.toLocaleDateString("fr-FR")} : ${j.prises}/${j.prevues}`}>
            <div className="flex h-14 w-full items-end rounded-md bg-secondary/60">
              <div className={`w-full rounded-md ${couleur}`} style={{ height: `${ratio === null ? 8 : Math.max(ratio * 100, 8)}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{JOURS_COURTS[jour.getDay()]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function libelleEcheance(a: AlerteExamen): string {
  if (!a.dernierPrelevement) return "Jamais réalisé";
  if (a.joursRestants < 0) return `En retard de ${-a.joursRestants} j`;
  if (a.joursRestants === 0) return "À faire aujourd'hui";
  return `Dans ${a.joursRestants} j`;
}
