import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDiscretionStore } from "@/store/discretion.store";

/**
 * Masque une information sensible quand le mode discret est actif.
 * Un appui l'affiche pendant 5 secondes, puis elle se masque à nouveau.
 */
export function Masque({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  const modeDiscret = useDiscretionStore((s) => s.modeDiscret);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(id);
  }, [visible]);

  if (!modeDiscret || visible) return <span className={className}>{children}</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setVisible(true);
      }}
      title={t("masque.afficher")}
      aria-label={t("masque.aria")}
      className={`inline-block cursor-pointer select-none rounded-md bg-muted px-1.5 align-middle text-muted-foreground ${className}
`}
    >
      ••••••
    </button>
  );
}
