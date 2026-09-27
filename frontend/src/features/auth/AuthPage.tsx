import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi, type RegisterPatientInput, type RegisterSoignantInput } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Mode = "login" | "register";
type Role = "patient" | "soignant";

const PATHOLOGIES: { value: RegisterPatientInput["pathologie"]; label: string }[] = [
  { value: "vih", label: "VIH" },
  { value: "vhb", label: "Hépatite B (VHB)" },
  { value: "vhc", label: "Hépatite C (VHC)" },
  { value: "vih_vhb", label: "VIH + VHB" },
  { value: "vih_vhc", label: "VIH + VHC" },
  { value: "vhb_vhc", label: "VHB + VHC" },
];

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>(searchParams.get("role") === "soignant" ? "soignant" : "patient");
  const [loading, setLoading] = useState(false);

  // Champs communs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");

  // Patient
  const [pathologie, setPathologie] = useState<RegisterPatientInput["pathologie"]>("vih");
  const [consentement, setConsentement] = useState(false);

  // Soignant
  const [matricule, setMatricule] = useState("");
  const [structure, setStructure] = useState("");
  const [specialite, setSpecialite] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await authApi.login({ email, password });
        setAuth(res.user, res.accessToken, res.refreshToken);
        navigate(res.user.role === "soignant" ? "/soignant/dashboard" : "/dashboard");
        return;
      }

      if (role === "patient") {
        const res = await authApi.registerPatient({
          email, password, nom, prenom, pathologie, consentementDonne: consentement,
        });
        setAuth(res.user, res.accessToken, res.refreshToken);
        navigate("/dashboard");
      } else {
        const input: RegisterSoignantInput = {
          email, password, nom, prenom, matricule, structure,
          ...(specialite ? { specialite } : {}),
        };
        const res = await authApi.registerSoignant(input);
        setAuth(res.user, res.accessToken, res.refreshToken);
        navigate("/soignant/dashboard");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Une erreur est survenue", {
        description: "Vérifiez vos informations et réessayez.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {/* Panneau visuel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,hsl(var(--brand))_0%,hsl(var(--brand-deep))_100%)] p-12 lg:flex">
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
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
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

          {mode === "register" && (
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
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required className="h-12 rounded-xl" />
                </div>
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
                minLength={8}
                className="h-12 rounded-xl"
              />
            </div>

            {mode === "register" && role === "patient" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pathologie">Pathologie suivie</Label>
                  <Select value={pathologie} onValueChange={(v) => setPathologie(v as typeof pathologie)}>
                    <SelectTrigger id="pathologie" className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PATHOLOGIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-secondary/60 p-4">
                  <Checkbox
                    id="consentement"
                    checked={consentement}
                    onCheckedChange={(v) => setConsentement(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="consentement" className="text-sm font-normal leading-relaxed text-foreground">
                    J'accepte que mes données de santé soient traitées dans le cadre de mon suivi VIHEPAT,
                    de façon chiffrée et confidentielle.
                  </Label>
                </div>
              </>
            )}

            {mode === "register" && role === "soignant" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="matricule">Matricule professionnel</Label>
                  <Input id="matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} required className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="structure">Structure de santé</Label>
                  <Input id="structure" value={structure} onChange={(e) => setStructure(e.target.value)} required className="h-12 rounded-xl" placeholder="Ex. CHU Cotonou" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialite">Spécialité (optionnel)</Label>
                  <Input id="specialite" value={specialite} onChange={(e) => setSpecialite(e.target.value)} className="h-12 rounded-xl" />
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={loading || (mode === "register" && role === "patient" && !consentement)}
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
              onClick={() => setMode(mode === "login" ? "register" : "login")}
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
