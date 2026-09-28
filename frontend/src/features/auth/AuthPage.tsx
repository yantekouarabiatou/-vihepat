import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HeartPulse, Loader2, Stethoscope, ShieldCheck, Lock, Info, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { authApi, type RegisterSoignantInput } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallButton } from "@/components/install-button";
import { ListenButton } from "@/components/listen-button";

type Mode = "login" | "register";

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const initialMode: Mode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);

  // Champs d'authentification
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Inscription soignant
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [matricule, setMatricule] = useState("");
  const [structureId, setStructureId] = useState("");
  const [specialite, setSpecialite] = useState("");
  const [codeInvitation, setCodeInvitation] = useState("");

  const { data: structures } = useQuery({
    queryKey: ["auth", "structures"],
    queryFn: authApi.getStructures,
    enabled: mode === "register",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await authApi.login({ email, password });
        setAuth(res.user, res.accessToken, res.refreshToken);
        navigate(res.user.role === "patient" ? "/dashboard" : "/soignant/dashboard");
        return;
      }

      // Inscription réservée aux professionnels de santé habilités
      const input: RegisterSoignantInput = {
        email,
        password,
        nom,
        prenom,
        matricule,
        structureId: Number(structureId),
        codeInvitation,
        ...(specialite ? { specialite } : {}),
      };
      const res = await authApi.registerSoignant(input);
      setAuth(res.user, res.accessToken, res.refreshToken);
      toast.success("Compte soignant créé avec succès !");
      navigate("/soignant/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("auth.error_generic"), {
        description: err.response?.data?.message || t("auth.error_description"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {/* Panneau visuel latéral */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,hsl(var(--brand))_0%,hsl(var(--brand-deep))_100%)] p-12 lg:flex">
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-primary-foreground">
          VIHEPAT
        </Link>
        <div className="max-w-md">
          <HeartPulse className="mb-6 h-12 w-12 text-primary-foreground" strokeWidth={1.5} />
          <h2 className="text-4xl font-extrabold leading-tight text-primary-foreground">
            {t("hero.title_part1")} {t("hero.title_part2")}
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/85">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 space-y-3 rounded-2xl bg-white/10 p-5 backdrop-blur-md text-sm text-primary-foreground/90">
            <div className="flex items-center gap-2.5 font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-300 shrink-0" />
              <span>Gouvernance & Rôles Sécurisés</span>
            </div>
            <p className="text-xs text-primary-foreground/75 leading-relaxed">
              Pour des raisons éthiques et de secret médical, les dossiers patients sont exclusivement ouverts et gérés par le personnel soignant habilité et les administrateurs en centre de santé.
            </p>
          </div>
        </div>
        <p className="text-sm text-primary-foreground/60">
          {t("hero.trust2")} · {t("hero.trust3")}
        </p>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link
              to="/"
              className="block text-xl font-extrabold tracking-tight text-primary lg:hidden"
            >
              VIHEPAT
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <InstallButton />
              <LanguageSwitcher />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {mode === "login" ? t("auth.back_title") : "Inscription Soignant"}
              </h1>
              <p className="mt-2 text-muted-foreground text-sm">
                {mode === "login"
                  ? "Connectez-vous à votre espace personnel sécurisé."
                  : "Réservé aux professionnels habilités par leur structure de santé."}
              </p>
            </div>
            <ListenButton
              className="mt-1"
              text={`${mode === "login" ? t("auth.back_title") : "Inscription Soignant"}. ${
                mode === "login"
                  ? "Connectez-vous à votre espace personnel sécurisé."
                  : "Réservé aux professionnels habilités par leur structure de santé."
              }`}
            />
          </div>

          {/* Bannière explicative pour les patients */}
          {mode === "register" ? (
            <div className="mt-6 rounded-2xl border border-sky-500/30 bg-sky-50/80 dark:bg-sky-950/40 p-4 text-sky-900 dark:text-sky-200">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed space-y-1.5">
                  <p className="font-bold text-sm text-sky-950 dark:text-sky-100">
                    Vous êtes patient·e ?
                  </p>
                  <p className="text-sky-800 dark:text-sky-300">
                    Les comptes patients <strong>ne peuvent pas être créés en ligne</strong> de manière autonome. Votre dossier doit être ouvert directement par votre médecin, infirmier ou coordinateur en centre de santé.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto font-semibold text-sky-700 dark:text-sky-300 hover:underline"
                    onClick={() => setMode("login")}
                  >
                    J'ai déjà reçu mes identifiants de mon soignant →
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-border/80 bg-secondary/40 p-3.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  Espace d'accès unique : <strong>Patients</strong>, <strong>Soignants</strong> et <strong>Administrateurs</strong>.
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="prenom">{t("auth.first_name")}</Label>
                    <Input
                      id="prenom"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                      placeholder="Prénom"
                      className="h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">{t("auth.last_name")}</Label>
                    <Input
                      id="nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                      placeholder="Nom"
                      className="h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matricule">{t("auth.matricule")}</Label>
                  <Input
                    id="matricule"
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    required
                    placeholder="Ex: MED-COTONOU-102"
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="structureId">{t("auth.structure_label")}</Label>
                  <SearchableSelect
                    id="structureId"
                    value={structureId}
                    onChange={setStructureId}
                    options={(structures ?? []).map((s) => ({ value: String(s.id), label: s.nom }))}
                    placeholder={t("auth.structure_placeholder")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialite">{t("auth.specialite_optional")}</Label>
                  <Input
                    id="specialite"
                    value={specialite}
                    onChange={(e) => setSpecialite(e.target.value)}
                    placeholder="Ex: Infectiologie, Médecine générale"
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codeInvitation">{t("auth.code_invitation")}</Label>
                  <Input
                    id="codeInvitation"
                    value={codeInvitation}
                    onChange={(e) => setCodeInvitation(e.target.value)}
                    required
                    placeholder={t("auth.code_invitation_placeholder")}
                    className="h-12 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("auth.code_invitation_hint")}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
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
              <Label htmlFor="password">{t("auth.password")}</Label>
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

            <Button
              type="submit"
              disabled={
                loading ||
                (mode === "register" && (!structureId || !codeInvitation || !matricule))
              }
              className="h-12 w-full rounded-full text-base font-semibold transition-transform active:scale-[0.99]"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {mode === "login" ? t("auth.submit_login") : "Créer mon compte soignant"}
            </Button>
          </form>

          {/* Pied de formulaire */}
          <div className="mt-8 pt-6 border-t border-border/60 text-center space-y-3">
            {mode === "login" ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Vous êtes un professionnel de santé et n'avez pas encore de compte ?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("register")}
                  className="rounded-full text-xs font-semibold gap-1.5 h-9"
                >
                  <Stethoscope className="h-3.5 w-3.5 text-primary" />
                  Créer un compte professionnel (Soignant)
                </Button>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  Patients : vos identifiants sécurisés vous sont remis en main propre par votre centre de santé.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Déjà inscrit·e ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-semibold text-primary hover:underline"
                >
                  Retourner à la connexion
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
