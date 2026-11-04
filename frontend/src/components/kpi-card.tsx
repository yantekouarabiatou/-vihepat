import type { LucideIcon } from "lucide-react";

/**
 * Couleurs d'état des cartes de statistiques : la couleur dit quelque chose au soignant
 * (normal = marque, bon = vert, attention = ambre, critique = rouge, neutre = gris).
 */
const KPI_ETATS = {
  normal: { chip: "bg-primary/10", icon: "text-primary", barre: "bg-primary/60", blob: "from-primary/10" },
  bon: { chip: "bg-success/12", icon: "text-success", barre: "bg-success", blob: "from-success/10" },
  attention: { chip: "bg-gold/15", icon: "text-gold", barre: "bg-gold", blob: "from-gold/10" },
  critique: { chip: "bg-destructive/10", icon: "text-destructive", barre: "bg-destructive", blob: "from-destructive/10" },
  neutre: { chip: "bg-muted", icon: "text-muted-foreground", barre: "bg-border", blob: "from-muted-foreground/10" },
} as const;

export type KpiEtat = keyof typeof KPI_ETATS;

/** Carte de statistique compacte : libellé + icône, grand chiffre, une ligne de contexte. */
export function KpiCard({
  icon: Icon, label, value, etat, contexte, valeurCompacte,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  etat: KpiEtat;
  contexte?: string | undefined;
  /** Pour une valeur textuelle plutôt qu'un nombre. */
  valeurCompacte?: boolean;
}) {
  const c = KPI_ETATS[etat];
  return (
    <div className="relative isolate min-w-0 overflow-hidden rounded-card border border-border/60 bg-card px-4 pb-3.5 pt-4 shadow-dash">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${c.barre}`} />
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 sm:h-24 sm:w-24 ${c.icon} opacity-[0.07]`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t ${c.blob} to-transparent`} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">{label}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${c.chip}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <p
        className={`relative mt-1.5 font-extrabold leading-none tracking-tight ${valeurCompacte ? `text-xl ${c.icon}` : "text-3xl text-foreground"}`}
      >
        {value}
      </p>
      <p className={`relative mt-2 min-h-4 text-xs font-medium ${etat === "critique" || etat === "attention" ? c.icon : "text-muted-foreground"}`}>
        {contexte ?? " "}
      </p>
    </div>
  );
}
