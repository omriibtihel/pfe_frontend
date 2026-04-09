import { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Activity, ShieldCheck, Brain, Workflow, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface AuthLayoutProps {
  children: ReactNode;
}

interface Feature {
  icon: LucideIcon;
  titleKey: string;
  textKey: string;
}

const FEATURES: Feature[] = [
  { icon: ShieldCheck, titleKey: "auth.layout.feature1Title", textKey: "auth.layout.feature1Text" },
  { icon: Brain,       titleKey: "auth.layout.feature2Title", textKey: "auth.layout.feature2Text" },
  { icon: Workflow,    titleKey: "auth.layout.feature3Title", textKey: "auth.layout.feature3Text" },
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
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  return (
    <div className="min-h-screen [min-height:100svh] bg-background text-foreground">
      {/* Subtle top gradient only */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,hsl(var(--primary)/0.07),transparent)]" />

      {/* Language switcher — top right, always visible */}
      <div className="fixed right-4 top-4 z-50 sm:right-6">
        <LanguageSwitcher variant="badge" />
      </div>

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
              {t("auth.layout.tagline")}{" "}
              <span className="text-primary">{t("auth.layout.taglineAccent")}</span>
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {t("auth.layout.subtitle")}
            </p>
          </motion.div>

          {/* Feature list */}
          <motion.ul variants={stagger} className="space-y-5">
            {FEATURES.map((f) => (
              <motion.li key={f.titleKey} variants={fadeUp} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{t(f.titleKey)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(f.textKey)}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>

          <motion.p variants={fadeUp} className="text-xs text-muted-foreground/60">
            {t("common.copyright")}
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
