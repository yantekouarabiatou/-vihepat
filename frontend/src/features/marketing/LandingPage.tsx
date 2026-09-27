import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing, WifiOff, Stethoscope, EyeOff, ShieldCheck, Users,
  HeartHandshake, Lock, ArrowRight, CheckCircle2, Sparkles, Activity, Globe2,
} from "lucide-react";
import heroImage from "@/assets/hero-vihepat.jpg";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChatWidget } from "@/components/chat-widget";

export function LandingPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = "VIHEPAT — Suivi intelligent VIH & hépatites virales";
  }, []);

  const stats = [
    { value: t("stats.pvviH_value"), label: t("stats.pvviH_label"), sub: t("stats.pvviH_sub") },
    { value: t("stats.arv_value"), label: t("stats.arv_label"), sub: t("stats.arv_sub") },
    { value: t("stats.staff_value"), label: t("stats.staff_label"), sub: t("stats.staff_sub") },
    { value: t("stats.net_value"), label: t("stats.net_label"), sub: t("stats.net_sub") },
  ];

  const steps = [
    { icon: BellRing, title: t("steps.s1_title"), text: t("steps.s1_text") },
    { icon: WifiOff, title: t("steps.s2_title"), text: t("steps.s2_text") },
    { icon: Stethoscope, title: t("steps.s3_title"), text: t("steps.s3_text") },
    { icon: EyeOff, title: t("steps.s4_title"), text: t("steps.s4_text") },
  ];

  const trust = [
    { icon: WifiOff, title: t("trust.t1_title"), text: t("trust.t1_text") },
    { icon: Lock, title: t("trust.t2_title"), text: t("trust.t2_text") },
    { icon: ShieldCheck, title: t("trust.t3_title"), text: t("trust.t3_text") },
  ];

  const faq = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
  ];

  return (
    <div className="min-h-screen gradient-mesh font-sans">
      {/* ============ HERO avec glassmorphism ============ */}
      <header className="relative isolate overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,hsl(var(--brand)/0.9)_0%,hsl(var(--brand-deep)/0.85)_40%,hsl(var(--brand)/0.6)_75%,hsl(var(--accent)/0.35)_100%)]" />

        {/* Bulles déco */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-[hsl(var(--brand-light)/0.3)] blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-2/3 h-80 w-80 rounded-full bg-[hsl(var(--accent)/0.25)] blur-3xl" />

        <div className="relative mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col px-6 py-8">
          {/* Nav glass */}
          <nav className="glass-dark flex items-center justify-between rounded-full px-4 py-2.5 shadow-lg">
            <Link to="/" className="px-3 text-xl font-extrabold tracking-tight text-primary-foreground">
              VIHEPAT
            </Link>
            <div className="flex items-center gap-1.5">
              <LanguageSwitcher variant="glass" />
              <Link to="/login">
                <Button
                  size="sm"
                  className="rounded-full bg-white/95 text-[hsl(var(--brand))] hover:bg-white"
                >
                  {t("nav.login")}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </nav>

          <div className="flex flex-1 flex-col justify-center py-16">
            <p className="glass-dark animate-fade-up mb-5 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground">
              <Sparkles className="h-4 w-4" />
              {t("hero.badge")}
            </p>
            <h1 className="animate-fade-up delay-100 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-primary-foreground sm:text-6xl md:text-7xl">
              {t("hero.title_part1")}
              <br />
              <span className="bg-gradient-to-r from-white via-white to-[hsl(var(--brand-light))] bg-clip-text text-transparent">
                {t("hero.title_part2")}
              </span>
            </h1>
            <p className="animate-fade-up delay-200 mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/90">
              {t("hero.subtitle")}
            </p>
            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap gap-4">
              <Link to="/login">
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-white px-9 text-base font-semibold text-[hsl(var(--brand))] shadow-[var(--shadow-soft)] transition-all hover:scale-[1.03] hover:bg-white/95"
                >
                  {t("hero.cta_primary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login?role=soignant">
                <Button
                  size="lg"
                  variant="outline"
                  className="glass-dark h-14 rounded-full border-white/40 px-9 text-base font-semibold text-primary-foreground transition-all hover:bg-white/15"
                >
                  {t("hero.cta_secondary")}
                </Button>
              </Link>
            </div>

            <div className="animate-fade-up delay-400 mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-primary-foreground/85">
              {[t("hero.trust1"), t("hero.trust2"), t("hero.trust3")].map((txt) => (
                <span key={txt} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {txt}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ============ STATS en glassmorphism ============ */}
      <section className="mx-auto -mt-12 w-full max-w-6xl px-6">
        <div className="glass-card grid grid-cols-2 gap-8 rounded-3xl px-8 py-10 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`text-center md:text-left animate-fade-up delay-${(i + 1) * 100}`}>
              <div className="text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{s.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ COMMENT ÇA MARCHE ============ */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex items-center gap-3">
          <span className="glass-card inline-flex h-9 w-9 items-center justify-center rounded-full">
            <Activity className="h-4 w-4 text-[hsl(var(--brand))]" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand))]">
            {t("steps.eyebrow")}
          </span>
        </div>
        <h2 className="mt-5 max-w-2xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {t("steps.title")}
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t("steps.subtitle")}</p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="glass-card group relative rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-deep))] text-white shadow-md transition-transform group-hover:scale-110">
                <s.icon className="h-7 w-7" strokeWidth={2} />
              </div>
              <span className="mt-6 block text-sm font-bold text-[hsl(var(--accent))]">
                0{i + 1}
              </span>
              <h3 className="mt-1 text-xl font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ RÉASSURANCE ============ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="flex items-center gap-3">
          <span className="glass-card inline-flex h-9 w-9 items-center justify-center rounded-full">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--brand))]" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand))]">
            {t("trust.eyebrow")}
          </span>
        </div>
        <h2 className="mt-5 max-w-2xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {t("trust.title")}
        </h2>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {trust.map((tr) => (
            <div key={tr.title} className="glass-card flex flex-col gap-4 rounded-3xl p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--accent-soft))]">
                <tr.icon className="h-6 w-6 text-[hsl(var(--accent))]" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-foreground">{tr.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{tr.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ ESPACE SOIGNANT ============ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl gradient-teal-coral p-10 text-white shadow-[var(--shadow-soft)] md:p-14">
          <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-72 w-72 rounded-full bg-[hsl(var(--gold)/0.2)] blur-3xl" />

          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-3">
                <Globe2 className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  {t("caregiver.eyebrow")}
                </span>
              </div>
              <h3 className="mt-4 text-3xl font-extrabold sm:text-4xl">{t("caregiver.title")}</h3>
              <p className="mt-4 max-w-lg text-white/90">{t("caregiver.subtitle")}</p>
              <ul className="mt-6 space-y-2 text-sm text-white/95">
                {[t("caregiver.bullet1"), t("caregiver.bullet2"), t("caregiver.bullet3")].map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {b}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link to="/login?role=soignant">
                  <Button
                    size="lg"
                    className="h-13 rounded-full bg-white px-8 font-semibold text-[hsl(var(--brand))] transition-all hover:scale-[1.03] hover:bg-white/95"
                  >
                    <Stethoscope className="mr-2 h-5 w-5" />
                    {t("caregiver.cta")}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="glass-dark rounded-3xl p-6">
              <div className="rounded-2xl bg-white p-5 text-foreground shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Patient suivi
                  </span>
                  <span className="rounded-full bg-[hsl(var(--brand)/0.1)] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--brand))]">
                    VIH · ARV
                  </span>
                </div>
                <div className="mt-3 text-lg font-bold">VHP-2026-482917</div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Charge virale</span>
                      <span className="font-semibold text-emerald-600">Indétectable</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full w-[92%] rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Observance (30 j)</span>
                      <span className="font-semibold text-[hsl(var(--brand))]">96 %</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full w-[96%] rounded-full bg-[hsl(var(--brand))]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Prochain RDV</span>
                      <span className="font-semibold">12 oct. 2026</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {t("faq.title")}
        </h2>
        <div className="mt-10 space-y-3">
          {faq.map((item) => (
            <details key={item.q} className="glass-card group rounded-2xl px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-foreground">
                {item.q}
                <ArrowRight className="h-5 w-5 shrink-0 text-[hsl(var(--brand))] transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 max-w-2xl text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="glass-card rounded-3xl p-10 text-center sm:p-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-teal-coral text-white shadow-lg">
            <HeartHandshake className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("cta.subtitle")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="h-13 rounded-full px-8 font-semibold gradient-teal-coral text-white transition-transform hover:scale-[1.03]">
                <Users className="mr-2 h-5 w-5" />
                {t("cta.join")}
              </Button>
            </Link>
            <Link to="/login?role=soignant">
              <Button size="lg" variant="outline" className="h-13 rounded-full px-8 font-semibold">
                {t("cta.caregiver")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative overflow-hidden bg-[hsl(var(--navy))] py-14">
        <div className="pointer-events-none absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-[hsl(var(--brand)/0.3)] blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 md:grid-cols-3">
          <div>
            <span className="text-lg font-extrabold text-white">VIHEPAT</span>
            <p className="mt-3 max-w-xs text-sm text-white/70">{t("footer.tagline")}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              {t("footer.nav_title")}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li><Link to="/" className="hover:text-white">{t("nav.home")}</Link></li>
              <li><Link to="/login" className="hover:text-white">{t("nav.login")}</Link></li>
              <li><Link to="/login?role=soignant" className="hover:text-white">{t("hero.cta_secondary")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              {t("footer.contact_title")}
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>Cotonou, Bénin</li>
              <li>contact@vihepat.org</li>
            </ul>
          </div>
        </div>
        <div className="relative mx-auto mt-10 w-full max-w-6xl border-t border-white/10 px-6 pt-6">
          <p className="text-center text-sm text-white/60">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>

      {/* Widget flottant (signalement de symptôme, patients connectés) */}
      <ChatWidget />
    </div>
  );
}
