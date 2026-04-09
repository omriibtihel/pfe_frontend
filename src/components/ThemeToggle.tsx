import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* ── Tiny 4-pointed star ──────────────────────────────────────────────────── */
function Star4({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" className={className}>
      <path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z" />
    </svg>
  );
}

/* ── Crescent moon (two-circle SVG with clip) ────────────────────────────── */
function MoonKnob() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full rounded-full" style={{ background: "#0f172a" }}>
      <defs>
        <clipPath id="moon-clip">
          <circle cx="12" cy="12" r="11" />
        </clipPath>
      </defs>
      {/* Moon body */}
      <circle cx="12" cy="12" r="11" fill="#dde6f0" />
      {/* Bite — colour matches track background */}
      <circle cx="17" cy="8" r="10" fill="#0f172a" clipPath="url(#moon-clip)" />
    </svg>
  );
}

/* ── Sun (SVG with rays + radial gradient) ───────────────────────────────── */
function SunKnob() {
  const rays = Array.from({ length: 8 }, (_, i) => (i * 360) / 8);
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full">
      <defs>
        <radialGradient id="sun-core" cx="40%" cy="36%">
          <stop offset="0%"   stopColor="#fef9c3" />
          <stop offset="48%"  stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      {/* Rays between core edge (r≈7) and clip edge (r≈12) */}
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={12 + Math.cos(rad) * 7.8}
            y1={12 + Math.sin(rad) * 7.8}
            x2={12 + Math.cos(rad) * 11.4}
            y2={12 + Math.sin(rad) * 11.4}
            stroke="#f59e0b"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
      {/* Sun disk with highlight gradient */}
      <circle cx="12" cy="12" r="7" fill="url(#sun-core)" />
    </svg>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ isDark, onToggle, className }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={cn(
        "relative h-8 w-14 shrink-0 overflow-hidden rounded-full",
        "outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "transition-colors duration-500",
        className
      )}
      style={{ background: isDark ? "#0f172a" : "#60a5fa" }}
    >
      {/* ── Dark: stars ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDark && (
          <motion.div
            key="stars"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Star4 className="absolute left-[6px] top-[6px] h-[8px] w-[8px] text-slate-300" />
            <Star4 className="absolute left-[14px] top-[3px] h-[5px] w-[5px] text-slate-400" />
            <Star4 className="absolute left-[10px] top-[16px] h-[5px] w-[5px] text-slate-400" />
            <Star4 className="absolute left-[19px] top-[9px] h-[4px] w-[4px] text-slate-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Light: clouds ───────────────────────────────────────────── */}
      <AnimatePresence>
        {!isDark && (
          <motion.div
            key="clouds"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="absolute right-[5px] top-[6px] h-[5px] w-[13px] rounded-full bg-blue-200/70" />
            <div className="absolute right-[7px] bottom-[6px] h-[4px] w-[9px] rounded-full bg-blue-200/70" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sliding knob ────────────────────────────────────────────── */}
      <motion.div
        className="absolute top-[2px] h-7 w-7 overflow-hidden rounded-full"
        animate={{ left: isDark ? "calc(100% - 30px)" : "2px" }}
        transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="moon"
              className="h-full w-full"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{    y: "-100%" }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <MoonKnob />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              className="h-full w-full"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{    y: "-100%" }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <SunKnob />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
