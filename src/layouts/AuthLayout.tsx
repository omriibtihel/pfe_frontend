import { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Activity, ShieldCheck, Brain, Workflow, type LucideIcon } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
}

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Données sécurisées",
    text: "Protection renforcée des données médicales sensibles.",
  },
  {
    icon: Brain,
    title: "Modèles IA avancés",
    text: "Pipeline d'entraînement interprétable et robuste.",
  },
  {
    icon: Workflow,
    title: "Workflow sans friction",
    text: "Du dataset brut à la prédiction, en quelques clics.",
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  return (
    <div className="min-h-screen [min-height:100svh] bg-background text-foreground">
      {/* Subtle top gradient only */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,hsl(var(--primary)/0.07),transparent)]" />

      <div className="relative z-10 mx-auto flex min-h-screen [min-height:100svh] max-w-screen-xl px-4 sm:px-6 lg:items-center lg:px-12">

        {/* ── Left panel ── */}
        <motion.aside
          className="hidden lg:flex lg:w-[46%] lg:flex-col lg:justify-center lg:gap-12 lg:pr-16 xl:pr-20"
          initial={animate ? "hidden" : false}
          animate="visible"
          variants={stagger}
        >
          {/* Logo */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none tracking-tight">MedicalVision</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                AI Platform
              </p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div variants={fadeUp} className="space-y-4">
            <h1 className="text-4xl font-semibold leading-[1.18] tracking-tight xl:text-[2.6rem]">
              L'IA médicale,{" "}
              <span className="text-primary">à portée de données.</span>
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Connectez vos datasets, entraînez vos modèles et déployez vos prédictions dans un environnement
              sécurisé et structuré.
            </p>
          </motion.div>

          {/* Feature list */}
          <motion.ul variants={stagger} className="space-y-5">
            {features.map((f) => (
              <motion.li key={f.title} variants={fadeUp} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{f.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>

          <motion.p variants={fadeUp} className="text-xs text-muted-foreground/60">
            © 2025 MedicalVision — Environnement professionnel sécurisé
          </motion.p>
        </motion.aside>

        {/* ── Divider ── */}
        <div className="hidden lg:block lg:h-[58vh] lg:w-px lg:bg-border" />

        {/* ── Right: form ── */}
        <motion.main
          className="flex flex-1 items-start justify-center py-8 sm:py-10 lg:items-center lg:justify-center lg:pl-16 xl:pl-20"
          initial={animate ? { opacity: 0, y: 14 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={animate ? { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.12 } : undefined}
        >
          <div className="w-full max-w-sm sm:max-w-md">
            {children}
          </div>
        </motion.main>

      </div>
    </div>
  );
}

export default AuthLayout;
