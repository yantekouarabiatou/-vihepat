import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Megaphone, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { soignantApi, type CibleCommunique } from "@/api/soignant.api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api-error";

export function CommuniquesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [cible, setCible] = useState<CibleCommunique>("tous");
  const [patientId, setPatientId] = useState("");

  const { data: communiques, isLoading } = useQuery({
    queryKey: ["soignant", "communiques"],
    queryFn: soignantApi.getCommuniques,
  });
  const { data: patients } = useQuery({
    queryKey: ["soignant", "patients"],
    queryFn: () => soignantApi.getPatients(),
    enabled: open,
  });

  function reset() {
    setTitre("");
    setContenu("");
    setCible("tous");
    setPatientId("");
  }

  const { mutate: creer, isPending } = useMutation({
    mutationFn: () =>
      soignantApi.createCommunique({
        titre, contenu, cible,
        ...(cible === "patient" ? { patientId: Number(patientId) } : {}),
      }),
    onSuccess: () => {
      toast.success(t("communiques.toast_success"));
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["soignant", "communiques"] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("communiques.toast_error"))),
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <AppShell title={t("communiques.page_title")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("communiques.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("communiques.subtitle")}</p>
        </div>
        <Button className="h-12 rounded-full px-6" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-5 w-5" /> {t("communiques.nouveau")}
        </Button>
      </div>

      <div className="mt-8 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !communiques || communiques.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("communiques.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {communiques.map((c) => (
              <li key={c.id} className="rounded-2xl border-2 border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                    <p className="font-semibold text-foreground">{c.titre}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                    {c.cible === "tous"
                      ? t("communiques.cible_tous")
                      : c.patient
                        ? `${c.patient.user.prenom} ${c.patient.user.nom}`
                        : t("communiques.cible_patient")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">{c.contenu}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("communiques.dialog_title")}</DialogTitle>
            <DialogDescription>{t("communiques.dialog_desc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              creer();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="titre">{t("communiques.champ_titre")}</Label>
              <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} required maxLength={150} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contenu">{t("communiques.champ_contenu")}</Label>
              <Textarea id="contenu" value={contenu} onChange={(e) => setContenu(e.target.value)} required maxLength={2000} rows={4} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t("communiques.champ_cible")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCible("tous")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    cible === "tous" ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Users className="h-4 w-4" /> {t("communiques.cible_tous")}
                </button>
                <button
                  type="button"
                  onClick={() => setCible("patient")}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    cible === "patient" ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t("communiques.cible_patient")}
                </button>
              </div>
            </div>
            {cible === "patient" && (
              <div className="space-y-2">
                <Label htmlFor="patientId">{t("communiques.champ_patient")}</Label>
                <SearchableSelect
                  id="patientId"
                  value={patientId}
                  onChange={setPatientId}
                  options={(patients ?? []).map((p) => ({ value: String(p.id), label: `${p.user.prenom} ${p.user.nom}` }))}
                  placeholder={t("communiques.champ_patient")}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending || !titre.trim() || !contenu.trim() || (cible === "patient" && !patientId)}
                className="w-full rounded-full"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("communiques.envoyer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
