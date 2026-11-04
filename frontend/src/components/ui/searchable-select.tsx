import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

/** Select avec recherche intégrée (équivalent « Select2 »)  utile dès qu'une liste dépasse quelques options. */
export function SearchableSelect({
  value, onChange, options, placeholder, searchPlaceholder, emptyText, className, id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-11 w-full justify-between gap-2 rounded-xl bg-background pl-3.5 pr-1.5 text-sm font-normal hover:bg-background hover:border-ring/60", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <span className="flex h-6 shrink-0 items-center border-l border-input pl-2 pr-1.5 text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] rounded-xl p-1.5 shadow-lg" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? placeholder} className="h-11" />
          <CommandList>
            <CommandEmpty>{emptyText ?? ""}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
