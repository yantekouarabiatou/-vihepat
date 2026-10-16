import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Noms des langues écrits dans leur propre langue : ils ne se traduisent pas
const LANGS = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fon', label: 'Fɔngbè', flag: '🇧🇯' },
] as const;

/**
 * Sélecteur de langue. Couleurs uniquement issues des variables du thème
 * (popover, secondary, primary, border) : lisible en mode clair comme en mode sombre.
 * La variante `glass` reste réservée au bandeau sur image de la page d'accueil.
 */
export function LanguageSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'glass' }) {
  const { t, i18n } = useTranslation();

  const langueActive = i18n.resolvedLanguage ?? i18n.language;
  const current = LANGS.find((l) => l.code === langueActive) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={
              variant === 'glass'
                ? 'h-9 rounded-full glass-dark text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground/70'
                : 'h-9 rounded-full border border-border/70 bg-background/60 px-2.5 text-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-secondary aria-expanded:text-secondary-foreground'
            }
            aria-label={t('language.change', { langue: current.label })}
            title={t('language.change', { langue: current.label })}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span className="ml-1 hidden text-xs font-semibold uppercase sm:inline">{current.code}</span>
            <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg ring-0"
      >
        {LANGS.map((l) => {
          const actif = langueActive === l.code;
          return (
            <DropdownMenuItem
              key={l.code}
              onClick={() => void i18n.changeLanguage(l.code)}
              aria-checked={actif}
              role="menuitemradio"
              lang={l.code}
              className={`min-h-11 cursor-pointer gap-3 rounded-xl px-3 text-sm text-popover-foreground focus:bg-secondary focus:text-secondary-foreground data-highlighted:bg-secondary data-highlighted:text-secondary-foreground ${
                actif ? 'bg-primary/15 font-semibold text-foreground' : ''
              }`}
            >
              <span className="text-lg" aria-hidden="true">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {actif && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
