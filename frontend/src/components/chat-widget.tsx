import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Stethoscope, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { patientApi, type Gravite } from "@/api/patient.api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

export function ChatWidget() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState(false);
  const [symptome, setSymptome] = useState("");
  const [gravite, setGravite] = useState<Gravite>("leger");
  const [notes, setNotes] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => patientApi.createSignalement({ symptome, gravite, ...(notes ? { notes } : {}) }),
    onSuccess: () => {
      toast.success(t("signalement.success"));
      setSymptome("");
      setGravite("leger");
      setNotes("");
      setOpen(false);
    },
    onError: () => toast.error(t("signalement.error")),
  });

  if (role !== "patient") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("signalement.fab_label")}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full gradient-teal-coral text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-110"
      >
        <Stethoscope className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("signalement.title")}</DialogTitle>
            <DialogDescription>{t("signalement.subtitle")}</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="symptome">{t("signalement.symptome_label")}</Label>
              <Input
                id="symptome"
                value={symptome}
                onChange={(e) => setSymptome(e.target.value)}
                placeholder={t("signalement.symptome_placeholder")}
                required
                maxLength={150}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gravite">{t("signalement.gravite_label")}</Label>
              <Select value={gravite} onValueChange={(v) => setGravite(v as Gravite)}>
                <SelectTrigger id="gravite" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leger">{t("signalement.gravite_leger")}</SelectItem>
                  <SelectItem value="modere">{t("signalement.gravite_modere")}</SelectItem>
                  <SelectItem value="severe">{t("signalement.gravite_severe")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("signalement.notes_label")}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("signalement.notes_placeholder")}
                className="rounded-xl"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={isPending} className="h-11 w-full rounded-full font-semibold">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("signalement.submit")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
