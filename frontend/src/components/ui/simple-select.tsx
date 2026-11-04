import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SimpleSelectOption {
  value: string;
  label: string;
}

/** Radix n'accepte pas de valeur vide : on la remplace par un jeton interne. */
const VIDE = "__vide__";

/**
 * Champ de sélection standard de l'application (même rendu partout).
 * À utiliser à la place d'un <select> natif.
 */
export function SimpleSelect({
  value, onChange, options, placeholder, id, className, ariaLabel, disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SimpleSelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value === "" ? VIDE : value}
      onValueChange={(v) => onChange(v === VIDE ? "" : v)}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value === "" ? VIDE : o.value} value={o.value === "" ? VIDE : o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
