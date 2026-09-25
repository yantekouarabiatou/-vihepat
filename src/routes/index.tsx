import { createFileRoute } from "@tanstack/react-router";
import {
  BellRing,
  WifiOff,
  Stethoscope,
  EyeOff,
  ShieldCheck,
  Users,
  HeartHandshake,
  Lock,
} from "lucide-react";
import heroImage from "@/assets/hero-vihepat.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VIHEPAT — Suivi intelligent VIH & hépatites virales" },
      {
        name: "description",
        content:
          "VIHEPAT accompagne les personnes vivant avec le VIH ou une hépatite virale : rappels de traitement, suivi hors ligne, espace soignant sécurisé et discrétion totale.",
      },
      { property: "og:title", content: "VIHEPAT — Suivi intelligent VIH & hépatites virales" },
      {
        property: "og:description",
        content:
          "Une continuité de soin simple et discrète, pensée pour le Bénin et les contextes africains.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: BellRing,
    title: "Rappels de traitement",
    text: "Des alertes simples et personnalisées pour ne jamais manquer une prise ni un rendez-vous.",
  },
  {
    icon: WifiOff,
    title: "Suivi hors ligne",
    text: "L'application fonctionne sans connexion et se synchronise dès que le réseau revient.",
  },
  {
    icon: Stethoscope,
    title: "Espace soignant",
    text: "Le personnel de santé suit l'observance et intervient au bon moment, en toute sécurité.",
  },
  {
    icon: EyeOff,
    title: "Discrétion",
    text: "Icône neutre, aucun signe visible : votre santé reste votre affaire privée.",
  },
];

const trust = [
  {
    icon: WifiOff,
    title: "Conçu pour le terrain",
    text: "Tout reste accessible hors ligne, même dans les zones à faible couverture réseau.",
  },
  {
    icon: Lock,
    title: "Données chiffrées",
    text: "Vos informations sont chiffrées de bout en bout et stockées de façon sécurisée.",
  },
  {
    icon: ShieldCheck,
    title: "Séparation stricte",
    text: "Espace patient et espace soignant cloisonnés : chacun ne voit que ce qui le concerne.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Hero */}
      <header className="relative isolate overflow-hidden">
        <img
          src={heroImage}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(140deg,var(--brand)_0%,var(--brand-deep)_100%)] opacity-90" />

        <div className="relative mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col px-6 py-8">
          <nav className="flex items-center justify-between">
            <span className="text-xl font-extrabold tracking-tight text-primary-foreground">
              VIHEPAT
            </span>
            <Button
              variant="ghost"
              className="rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            >
              Se connecter
            </Button>
          </nav>

          <div className="flex flex-1 flex-col justify-center py-16">
            <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-medium text-primary-foreground backdrop-blur">
              Bénin · Afrique de l'Ouest
            </p>
            <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-primary-foreground sm:text-6xl md:text-7xl">
              Votre suivi de santé, sans rupture.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/90">
              VIHEPAT accompagne chaque jour les personnes vivant avec le VIH ou une hépatite
              virale : traitement, rendez-vous et lien avec l'équipe soignante, où que vous soyez.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                size="lg"
                className="h-14 rounded-full bg-background px-9 text-base font-semibold text-primary shadow-[var(--shadow-soft)] hover:bg-background/90"
              >
                Commencer
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 rounded-full border-primary-foreground/50 bg-transparent px-9 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              >
                Je suis soignant
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Comment ça marche */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Comment ça marche
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Quatre gestes simples pour garder le fil de votre traitement.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-3xl bg-card p-7 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <s.icon className="h-7 w-7 text-primary" strokeWidth={2} />
              </div>
              <span className="mt-6 block text-sm font-semibold text-primary">
                0{i + 1}
              </span>
              <h3 className="mt-1 text-xl font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Réassurance */}
      <section className="bg-secondary py-24">
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="max-w-2xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Une confiance qui se construit dans les détails
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {trust.map((t) => (
              <div key={t.title} className="flex flex-col gap-4">
                <t.icon className="h-9 w-9 text-primary" strokeWidth={1.75} />
                <h3 className="text-xl font-bold text-foreground">{t.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proches / pairs */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-[linear-gradient(140deg,var(--brand)_0%,var(--brand-deep)_100%)] p-10 text-primary-foreground shadow-[var(--shadow-soft)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <HeartHandshake className="h-10 w-10 shrink-0" strokeWidth={1.75} />
            <div>
              <h3 className="text-2xl font-bold">Proches et soutien entre pairs</h3>
              <p className="mt-2 max-w-xl text-primary-foreground/90">
                Un espace bienveillant pour les accompagnants et les groupes de pairs, toujours
                dans le respect de votre vie privée.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            className="h-13 shrink-0 rounded-full bg-background px-8 font-semibold text-primary hover:bg-background/90"
          >
            <Users className="mr-2 h-5 w-5" />
            Rejoindre
          </Button>
        </div>
      </section>

      <footer className="bg-navy py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-sm text-primary-foreground/70 md:flex-row md:items-center md:justify-between">
          <span className="text-lg font-extrabold text-primary-foreground">VIHEPAT</span>
          <p>Continuité de soin pour le VIH et les hépatites virales · Bénin</p>
          <p>© {new Date().getFullYear()} VIHEPAT</p>
        </div>
      </footer>
    </div>
  );
}
