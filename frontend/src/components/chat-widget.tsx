import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  Send,
  Mic,
  MicOff,
  Loader2,
  CloudOff,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
} from "lucide-react";
import { useEnLigne } from "@/hooks/use-connexion";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { patientApi, type ChatMessage } from "@/api/patient.api";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const enLigne = useEnLigne();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // Message d'accueil contextualisé
  const greetingText = useMemo(() => {
    if (role === "soignant" || role === "admin") {
      return "Bonjour ! Je suis l'assistant clinique VIHEPAT. Comment puis-je vous assister dans le suivi de vos patients ou l'utilisation de la plateforme ?";
    }
    if (role === "patient") {
      return "Bonjour ! Je suis votre assistant santé VIHEPAT. Décrivez-moi vos symptômes ou posez vos questions. Vous pouvez aussi utiliser le micro pour parler ou écouter mes réponses.";
    }
    return "Bonjour et bienvenue sur la plateforme nationale VIHEPAT ! Je suis votre assistant santé. Posez-moi vos questions sur le VIH, les hépatites virales B et C, le dépistage ou l'accès aux soins au Bénin.";
  }, [role]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: greetingText },
  ]);

  // Réinitialiser le message d'accueil si le rôle change
  useEffect(() => {
    setMessages([{ role: "assistant", content: greetingText }]);
  }, [greetingText]);

  // Suggestions rapides selon le rôle
  const quickChips = useMemo(() => {
    if (role === "patient") {
      return [
        "J'ai de la fièvre et des courbatures",
        "J'ai oublié de prendre mon traitement",
        "J'ai des nausées depuis ce matin",
        "Comment bien prendre mes médicaments ?",
      ];
    }
    if (role === "soignant" || role === "admin") {
      return [
        "Quels sont les seuils d'alerte charge virale ?",
        "Protocoles nationaux de prise en charge",
        "Comment réinitialiser un code patient ?",
      ];
    }
    return [
      "Comment et où faire un dépistage au Bénin ?",
      "Quelle est la différence entre Hépatite B et C ?",
      "Le traitement du VIH est-il gratuit ?",
      "Comment protéger mon partenaire ?",
    ];
  }, [role]);

  const { isSupported: micSupported, isListening, transcript, start: startListening, stop: stopListening } =
    useSpeechRecognition("fr-FR");

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Synthèse vocale (Text-To-Speech)
  function toggleSpeech(text: string, index: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.info("La synthèse vocale n'est pas supportée sur ce navigateur.");
      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = i18n.language === "fon" ? "fr-FR" : "fr-FR";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }

  // Envoi de message
  const { mutate: send, isPending } = useMutation({
    mutationFn: (history: ChatMessage[]) => patientApi.sendChatMessage(history),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.signalementCreated) {
        toast.success("Signalement médical transmis à votre équipe soignante.");
        queryClient.invalidateQueries({ queryKey: ["patient", "signalements"] });
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Désolé, je rencontre une difficulté de connexion. En cas d'urgence ou de malaise, contactez directement votre centre de santé ou le 166.",
        },
      ]);
    },
  });

  function handleSend(customText?: string) {
    const text = (customText ?? input).trim();
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

  function handleReset() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingIndex(null);
    setMessages([{ role: "assistant", content: greetingText }]);
  }

  return (
    <>
      {/* Bouton Flottant (Visible par tous les utilisateurs) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'assistant santé VIHEPAT"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--brand))_0%,hsl(var(--brand-deep))_100%)] text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-primary/20"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
        </span>
      </button>

      {/* Boîte de dialogue du Chatbot */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[620px] max-h-[88vh] flex-col rounded-3xl p-0 sm:max-w-md shadow-2xl overflow-hidden border border-border/70">
          {/* En-tête du Chatbot */}
          <DialogHeader className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-secondary/30 px-5 py-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    Assistant VIHEPAT
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                      En ligne
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {role === "patient"
                      ? "Accompagnement & Signalement de santé"
                      : role === "soignant" || role === "admin"
                      ? "Support professionnel & Protocoles"
                      : "Information & Prévention santé"}
                  </DialogDescription>
                </div>
              </div>

              {/* Bouton de réinitialisation */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleReset}
                title="Recommencer la conversation"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Bandeau hors ligne éventuel */}
          {!enLigne && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Mode hors ligne : l'assistant intelligent requiert internet. Vos déclarations de traitement et signalements restent enregistrés hors ligne.
              </span>
            </div>
          )}

          {/* Fil de discussion */}
          <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}
              >
                <div className="flex items-end gap-2 max-w-[85%]">
                  {m.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-secondary/70 text-foreground border border-border/50 rounded-bl-xs"
                    )}
                  >
                    {m.content}
                  </div>

                  {m.role === "assistant" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSpeech(m.content, i)}
                      title={speakingIndex === i ? "Arrêter la lecture" : "Écouter la réponse"}
                      className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-primary"
                    >
                      {speakingIndex === i ? (
                        <VolumeX className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {isPending && (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-secondary/70 px-4 py-3 border border-border/40">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                </div>
              </div>
            )}

            {/* Suggestions rapides (Quick Chips) si seulement le message d'accueil */}
            {messages.length === 1 && (
              <div className="mt-4 space-y-2 pt-2 border-t border-border/40">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Suggestions rapides :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(chip)}
                      className="rounded-full border border-border/80 bg-background hover:bg-secondary px-3 py-1.5 text-xs text-foreground transition-all hover:border-primary text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Zone de saisie */}
          <div className="border-t border-border/70 bg-card p-3">
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
                  aria-label={isListening ? "Arrêter l'enregistrement" : "Parler au micro"}
                  title={isListening ? "Arrêter le micro" : "Parler au micro"}
                  className={cn(
                    "h-10 w-10 shrink-0 rounded-full",
                    isListening && "animate-pulse bg-rose-500 text-white hover:bg-rose-600"
                  )}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? "Je vous écoute..."
                    : role === "patient"
                    ? "Décrivez ce que vous ressentez..."
                    : "Posez votre question..."
                }
                className="h-10 flex-1 rounded-full text-sm"
                disabled={isPending || !enLigne}
              />

              <Button
                type="submit"
                size="icon"
                disabled={isPending || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-full shadow-sm"
                aria-label="Envoyer"
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
