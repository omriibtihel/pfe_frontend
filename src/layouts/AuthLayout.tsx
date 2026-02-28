import { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Activity, ShieldCheck, Brain, Workflow, Sparkles, type LucideIcon } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

interface HighlightItem {
  icon: LucideIcon;
  title: string;
  text: string;
  accent: string;
  glow: string;
  iconBg: string;
}

const highlights: HighlightItem[] = [
  {
    icon: ShieldCheck,
    title: "Conformite",
    text: "Protection renforcee des donnees medicales sensibles.",
    accent: "hsl(var(--primary))",
    glow: "hsl(var(--primary) / 0.34)",
    iconBg: "from-primary/35 to-primary/10",
  },
  {
    icon: Brain,
    title: "Modeles IA",
    text: "Pipeline d'entrainement avance, interpretable et robuste.",
    accent: "hsl(var(--secondary))",
    glow: "hsl(var(--secondary) / 0.34)",
    iconBg: "from-secondary/35 to-secondary/10",
  },
  {
    icon: Workflow,
    title: "Workflow",
    text: "Du dataset brut a la prediction, sans friction technique.",
    accent: "hsl(var(--accent))",
    glow: "hsl(var(--accent) / 0.34)",
    iconBg: "from-accent/35 to-accent/10",
  },
];

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.18 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !reduceMotion;

  return (
    <div className="relative min-h-screen [min-height:100svh] overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_10%_8%,hsl(var(--primary)/0.18),transparent_56%),radial-gradient(950px_circle_at_90%_14%,hsl(var(--secondary)/0.16),transparent_52%),radial-gradient(840px_circle_at_62%_88%,hsl(var(--accent)/0.12),transparent_58%)]" />
        <div className="absolute inset-0 ai-grid-bg opacity-[0.32]" />
        <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--foreground)/0.06)_0.7px,transparent_0.7px)] [background-size:4px_4px] opacity-[0.18]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/45 to-background/85" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1880px] [min-height:100svh] px-4 sm:px-6 lg:items-center lg:px-8 xl:px-10 2xl:max-w-[1980px]">
        <motion.aside
          className="relative hidden lg:flex lg:w-[52%] lg:flex-col lg:justify-start lg:gap-8 lg:px-6 lg:py-6 xl:w-[51%] xl:gap-10 xl:px-8 xl:py-8 2xl:w-[50%] 2xl:px-12"
          initial={shouldAnimate ? "hidden" : false}
          animate="visible"
          variants={panelVariants}
        >
          <div className="w-full max-w-[1040px] space-y-8 xl:space-y-10 2xl:space-y-12">
            <motion.div className="space-y-6" variants={panelVariants}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent shadow-glow-sm 2xl:h-14 2xl:w-14">
                  <Activity className="h-6 w-6 text-white 2xl:h-7 2xl:w-7" />
                </div>
                <div>
                  <p className="text-xl font-bold tracking-tight 2xl:text-[1.45rem]">MedicalVision</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/65 2xl:text-[0.72rem]">AI Platform</p>
                </div>
              </div>

              <div className="space-y-4">
                <span className="ai-chip 2xl:px-3.5 2xl:py-1.5 2xl:text-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Plateforme IA medicale
                </span>
                <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight xl:text-4xl 2xl:max-w-2xl 2xl:text-6xl">
                  Une experience clinique plus fluide, concue pour la
                  <span className="text-gradient-premium"> data science moderne.</span>
                </h1>
                <p className="max-w-lg text-sm leading-relaxed text-foreground/75 xl:text-base 2xl:max-w-xl 2xl:text-lg">
                  Connectez vos datasets, entrainez vos modeles et deployez vos predictions dans un environnement
                  securise et structure.
                </p>
              </div>
            </motion.div>

            <motion.div
              className="space-y-3"
              initial={shouldAnimate ? "hidden" : false}
              animate="visible"
              variants={listVariants}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60 2xl:text-xs 2xl:tracking-[0.2em]">
                Fonctionnalites premium
              </p>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3 2xl:gap-5">
                {highlights.map((item) => (
                  <motion.div
                    key={item.title}
                    variants={cardVariants}
                    whileHover={
                      shouldAnimate
                        ? { y: -5, scale: 1.02, transition: { duration: 0.22, ease: "easeOut" } }
                        : undefined
                    }
                    className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/75 p-4 backdrop-blur-2xl transition-all duration-300 motion-reduce:transform-none motion-reduce:transition-none hover:border-primary/35 2xl:rounded-3xl 2xl:p-5"
                    style={{
                      boxShadow:
                        "0 1px 0 0 hsl(var(--foreground) / 0.08) inset, 0 10px 34px -12px hsl(var(--foreground) / 0.3)",
                    }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${item.glow} 0%, transparent 72%)`,
                      }}
                    />

                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${item.accent}, transparent)`,
                      }}
                    />

                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
                      style={{ background: item.accent }}
                    />

                    <div className={`relative mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${item.iconBg} ring-1 ring-white/15 2xl:h-11 2xl:w-11`}>
                      <item.icon className="h-4 w-4 text-foreground/90 2xl:h-5 2xl:w-5" />
                    </div>

                    <div className="relative space-y-1">
                      <p className="text-sm font-semibold tracking-tight text-foreground/95 2xl:text-base">{item.title}</p>
                      <p className="text-[11px] leading-relaxed text-foreground/70 2xl:text-sm">{item.text}</p>
                    </div>

                    <div className="relative mt-3 flex items-center gap-2 text-[11px] font-medium text-foreground/70 2xl:text-sm">
                      <span className="h-1.5 w-1.5 rounded-full 2xl:h-2 2xl:w-2" style={{ backgroundColor: item.accent }} />
                      <span>Ready for production</span>
                    </div>

                    <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-8 border-t border-border/60 pt-5 text-xs text-foreground/65">
            MedicalVision - Environnement professionnel de confiance
          </div>
        </motion.aside>

        <div className="hidden lg:block lg:h-[72vh] lg:w-px lg:bg-gradient-to-b lg:from-transparent lg:via-border/80 lg:to-transparent" />

        <motion.main
          className="relative flex flex-1 items-start justify-center py-6 sm:py-8 lg:items-center lg:justify-center lg:py-8 lg:pl-4 xl:pl-6"
          initial={shouldAnimate ? { opacity: 0, y: 14 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldAnimate ? { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 } : undefined}
        >
          <div className="relative w-full max-w-[760px] lg:max-w-[720px] xl:max-w-[800px] 2xl:max-w-[900px]">
            <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/10 blur-2xl sm:-inset-6 sm:rounded-[2.2rem] 2xl:-inset-7" />

            <motion.section
              className="relative rounded-[1.4rem] border border-border/70 bg-card/65 p-2 shadow-[0_24px_70px_-38px_hsl(var(--foreground)/0.45)] backdrop-blur-2xl focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-background sm:rounded-[1.8rem] sm:p-2.5 2xl:rounded-[2rem] 2xl:p-3"
              whileHover={shouldAnimate ? { y: -1 } : undefined}
              transition={shouldAnimate ? { duration: 0.2, ease: "easeOut" } : undefined}
            >
              <div className="rounded-[1.05rem] border border-white/25 bg-background/[0.88] p-2.5 sm:rounded-[1.35rem] sm:p-3 md:p-4 2xl:rounded-[1.5rem] 2xl:p-5 dark:border-white/10">
                {children}
              </div>
            </motion.section>

            <p className="mt-5 text-center text-xs text-foreground/65 2xl:text-sm">Infrastructure IA medicale securisee</p>
          </div>
        </motion.main>
      </div>
    </div>
  );
}

export default AuthLayout;
