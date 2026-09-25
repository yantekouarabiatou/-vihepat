import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartPulse, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — VIHEPAT" },
      {
        name: "description",
        content:
          "Connectez-vous à votre espace VIHEPAT : suivi de traitement, rendez-vous et lien avec votre équipe soignante.",
      },
      { property: "og:title", content: "Connexion — VIHEPAT" },
      {
        property: "og:description",
        content: "Accédez à votre espace de suivi sécurisé VIHEPAT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";
type Role = "patient" | "soignant";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Compte créé !", {
            description:
              "Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour activer votre compte.",
          });
          setMode("login");
        } else {
          navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error("Une erreur est survenue", {
        description: err instanceof Error ? err.message : "Réessayez dans un instant.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {/* Panneau visuel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,var(--brand)_0%,var(--brand-deep)_100%)] p-12 lg:flex">
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-primary-foreground">
          VIHEPAT
        </Link>
        <div className="max-w-md">
          <HeartPulse className="mb-6 h-12 w-12 text-primary-foreground" strokeWidth={1.5} />
          <h2 className="text-4xl font-extrabold leading-tight text-primary-foreground">
            Votre santé, suivie avec soin et discrétion.
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/85">
            Rappels de traitement, rendez-vous et lien avec votre équipe soignante — même hors
            ligne.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Données chiffrées · Espace patient et soignant séparés
        </p>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 block text-xl font-extrabold tracking-tight text-primary lg:hidden"
          >
            VIHEPAT
          </Link>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {mode === "login" ? "Bon retour" : "Créer votre compte"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "login"
              ? "Connectez-vous pour retrouver votre suivi."
              : "Quelques secondes suffisent pour commencer."}
          </p>

          {mode === "signup" && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {(
                [
                  { value: "patient", label: "Je suis patient·e" },
                  { value: "soignant", label: "Je suis soignant·e" },
                ] as const
              ).map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    role === r.value
                      ? "border-primary bg-secondary text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Awa Mensah"
                  required
                  className="h-12 rounded-xl"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="h-12 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full text-base font-semibold"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit·e ?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
