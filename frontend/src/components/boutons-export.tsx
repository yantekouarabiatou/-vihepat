import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exporterCsv, exporterExcel, imprimerPdf, type Tableau } from "@/lib/export-tableau";

/** Menu « Exporter » : Excel, CSV ou PDF (impression), à partir des lignes affichées (filtres compris) */
export function BoutonsExport({ tableau, disabled }: { tableau: () => Tableau; disabled?: boolean }) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = useState(false);
  const choix = [
    { cle: "excel", icone: FileSpreadsheet, action: () => exporterExcel(tableau()) },
    { cle: "csv", icone: FileText, action: () => exporterCsv(tableau()) },
    {
      cle: "pdf",
      icone: Printer,
      action: () => {
        if (!imprimerPdf(tableau())) toast.error(t("export.fenetre_bloquee"));
      },
    },
  ] as const;
  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 rounded-full" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> {t("export.bouton")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 rounded-2xl p-1.5">
        {choix.map(({ cle, icone: Icone, action }) => (
          <button
            key={cle}
            type="button"
            onClick={() => {
              setOuvert(false);
              action();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <Icone className="h-4 w-4 text-primary" aria-hidden="true" /> {t(`export.${cle}`)}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
