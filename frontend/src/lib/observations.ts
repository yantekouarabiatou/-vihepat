export type TypeObservation =
  | "charge_virale"
  | "cd4"
  | "transaminases"
  | "creatinine"
  | "hemoglobine"
  | "ag_hbs"
  | "arn_vhc"
  | "autre";

export const OBSERVATION_TYPES: { value: TypeObservation; label: string; unite: string }[] = [
  { value: "charge_virale", label: "Charge virale VIH", unite: "copies/mL" },
  { value: "cd4", label: "CD4", unite: "cellules/mm³" },
  { value: "transaminases", label: "Transaminases (ALAT)", unite: "UI/L" },
  { value: "creatinine", label: "Créatinine", unite: "µmol/L" },
  { value: "hemoglobine", label: "Hémoglobine", unite: "g/dL" },
  { value: "ag_hbs", label: "Ag HBs", unite: "positif" },
  { value: "arn_vhc", label: "ARN VHC", unite: "UI/mL" },
  { value: "autre", label: "Autre", unite: "" },
];

export const OBSERVATION_LABELS: Record<string, string> = Object.fromEntries(
  OBSERVATION_TYPES.map((t) => [t.value, t.label]),
);

export type NiveauRepere = "ok" | "attention" | "alerte";

/**
 * Repères indicatifs pour l'affichage (ne remplacent pas l'interprétation clinique).
 * Charge virale : seuil OMS d'échec virologique à 1000 copies/mL.
 * CD4 : < 200 cellules/mm³ = immunodépression sévère.
 */
export function repereObservation(type: string, valeur: number): { niveau: NiveauRepere; label: string } | null {
  switch (type) {
    case "charge_virale":
      if (valeur < 50) return { niveau: "ok", label: "Indétectable" };
      if (valeur < 1000) return { niveau: "attention", label: "Détectable" };
      return { niveau: "alerte", label: "≥ 1000" };
    case "cd4":
      if (valeur < 200) return { niveau: "alerte", label: "< 200" };
      if (valeur < 350) return { niveau: "attention", label: "< 350" };
      return { niveau: "ok", label: "Satisfaisant" };
    case "arn_vhc":
      return valeur === 0
        ? { niveau: "ok", label: "Indétectable" }
        : { niveau: "attention", label: "Détectable" };
    default:
      return null;
  }
}

export const NIVEAU_STYLES: Record<NiveauRepere, string> = {
  ok: "bg-secondary text-primary",
  attention: "bg-[hsl(var(--gold)/0.2)] text-[hsl(var(--gold))]",
  alerte: "bg-destructive/15 text-destructive",
};
