import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Lang = "fr" | "en";

/**
 * Flag configuration.
 * To use image files: add SVGs to public/flags/ and set the `src` field.
 * e.g. fr: { emoji: "🇫🇷", src: "/flags/fr.svg", alt: "French flag" }
 */
const FLAG_CONFIG: Record<Lang, { emoji: string; src?: string; alt: string }> = {
  fr: { emoji: "🇫🇷", src: "/flags/fr.svg", alt: "French flag" },
  en: { emoji: "🇬🇧", src: "/flags/gb.svg", alt: "British flag" },
};

function FlagImage({ lang }: { lang: Lang }) {
  const { emoji, src, alt } = FLAG_CONFIG[lang];
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full rounded-full object-cover select-none"
      />
    );
  }
  return (
    <span className="text-xl leading-none select-none" aria-hidden="true">
      {emoji}
    </span>
  );
}

function FlagToggle({ className, showLabels = true }: { className?: string; showLabels?: boolean }) {
  const { lang, setLang } = useLanguage();
  const isFr = lang === "fr";

  return (
    /* Outer row: labels sit OUTSIDE the track so the knob never covers them */
    <button
      type="button"
      onClick={() => setLang(isFr ? "en" : "fr")}
      aria-label={`Switch to ${isFr ? "English" : "French"}`}
      className={cn(
        "flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full",
        className
      )}
    >
      {/* Left label */}
      {showLabels && (
        <span
          className={cn(
            "text-[9px] font-black tracking-[0.15em] select-none transition-colors duration-200 w-3 text-right",
            isFr ? "text-foreground" : "text-muted-foreground/40"
          )}
        >
          FR
        </span>
      )}

      {/* Track */}
      <div
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full",
          "bg-muted/80 border border-border/50 shadow-inner shadow-black/5",
          "transition-colors duration-200 hover:bg-muted"
        )}
      >
        {/* Sliding flag knob */}
        <motion.div
          className={cn(
            "absolute top-[2px] h-7 w-7 rounded-full",
            "bg-card shadow-md shadow-black/20",
            "border-2 border-white/30 dark:border-white/10",
            "flex items-center justify-center overflow-hidden"
          )}
          animate={{ left: isFr ? "2px" : "calc(100% - 30px)" }}
          transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={lang}
              initial={{ scale: 0.4, opacity: 0, rotate: -15 }}
              animate={{ scale: 1,   opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4,    opacity: 0, rotate: 15 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full w-full items-center justify-center"
            >
              <FlagImage lang={lang} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Right label */}
      {showLabels && (
        <span
          className={cn(
            "text-[9px] font-black tracking-[0.15em] select-none transition-colors duration-200 w-3 text-left",
            !isFr ? "text-foreground" : "text-muted-foreground/40"
          )}
        >
          EN
        </span>
      )}
    </button>
  );
}

interface LanguageSwitcherProps {
  /** "badge" — standalone toggle (AuthLayout top corner)
   *  "pill"  — toggle with label (sidebar dropdown) */
  variant?: "badge" | "pill";
  className?: string;
}

export function LanguageSwitcher({ variant = "pill", className }: LanguageSwitcherProps) {
  const { t } = useTranslation();

  if (variant === "badge") {
    return <FlagToggle className={className} />;
  }

  return (
    <div className={cn("flex w-full items-center justify-between", className)}>
      <span className="text-sm text-muted-foreground">{t("langSwitcher.label")}</span>
      <FlagToggle showLabels={false} />
    </div>
  );
}
