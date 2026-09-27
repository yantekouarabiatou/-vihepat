import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Send, Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { patientApi, type ChatMessage } from "@/api/patient.api";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Bonjour 👋 Je suis là pour vous aider à signaler un symptôme à votre équipe soignante. Décrivez-moi ce que vous ressentez — vous pouvez aussi utiliser le micro pour parler.",
};

export function ChatWidget() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { isSupported: micSupported, isListening, transcript, start: startListening, stop: stopListening } =
    useSpeechRecognition("fr-FR");

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const { mutate: send, isPending } = useMutation({
    mutationFn: (history: ChatMessage[]) => patientApi.sendChatMessage(history),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.signalementCreated) {
        toast.success(t("signalement.success"));
        queryClient.invalidateQueries({ queryKey: ["patient", "signalements"] });
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("signalement.error") },
      ]);
    },
  });

  function handleSend() {
    const text = input.trim();
    if (!text || isPending) return;
    if (isListening) stopListening();

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    send(next);
  }

  function toggleMic() {
    if (isListening) {
      stopListening();
    } else {
      setInput("");
      startListening();
    }
  }

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
        <DialogContent className="flex h-[600px] max-h-[85vh] flex-col rounded-3xl p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>{t("signalement.title")}</DialogTitle>
            <DialogDescription>{t("signalement.subtitle")}</DialogDescription>
          </DialogHeader>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "gradient-teal-coral text-white"
                      : "bg-secondary text-foreground"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-secondary px-4 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              {micSupported && (
                <Button
                  type="button"
                  variant={isListening ? "default" : "outline"}
                  size="icon"
                  onClick={toggleMic}
                  aria-label={isListening ? "Arrêter l'enregistrement" : "Décrire à l'oral"}
                  className={cn("h-10 w-10 shrink-0 rounded-full", isListening && "animate-pulse")}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening ? "Je vous écoute…" : t("signalement.symptome_placeholder")
                }
                className="h-10 flex-1 rounded-full"
                disabled={isPending}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isPending || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-full"
                aria-label={t("signalement.submit")}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
