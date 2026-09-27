import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGS = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fon', label: 'Fɔngbè', flag: '🇧🇯' },
] as const;

export function LanguageSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'glass' }) {
  const { i18n } = useTranslation();

  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={
              variant === 'glass'
                ? 'rounded-full glass-dark text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground'
                : 'rounded-full'
            }
            aria-label="Change language"
          >
            <Globe className="h-4 w-4" />
            <span className="ml-2 hidden text-xs font-semibold uppercase sm:inline">
              {current.code}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="glass-strong min-w-[160px] rounded-2xl">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className={`cursor-pointer rounded-xl ${
              i18n.language === l.code ? 'bg-secondary font-semibold' : ''
            }`}
          >
            <span className="mr-3 text-lg">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
