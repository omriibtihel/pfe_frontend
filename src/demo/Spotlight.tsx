// src/demo/Spotlight.tsx
//
// Full-screen dim overlay with a transparent "hole" cut around the spotlight
// target. Uses an SVG mask so it remains crisp at any zoom level.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getRect, type ElementRect } from "./domHelpers";

interface SpotlightProps {
  target: string | null;
  /** Extra padding around the target rect, in pixels. */
  padding?: number;
}

export function Spotlight({ target, padding = 10 }: SpotlightProps) {
  const [rect, setRect] = useState<ElementRect | null>(null);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const update = () => setRect(getRect(target));
    update();
    const id = window.setInterval(update, 250); // cheap reflow-track
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  return (
    <AnimatePresence>
      {target && rect && (
        <motion.svg
          key="spotlight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 9990,
          }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <motion.rect
                initial={false}
                animate={{
                  x: rect.x - padding,
                  y: rect.y - padding,
                  width: rect.width + padding * 2,
                  height: rect.height + padding * 2,
                }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
                rx="12"
                ry="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(8, 12, 24, 0.55)"
            mask="url(#spotlight-mask)"
          />
          {/* Glow ring around the spotlight target */}
          <motion.rect
            initial={false}
            animate={{
              x: rect.x - padding,
              y: rect.y - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
            }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
            rx="12"
            ry="12"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeOpacity="0.85"
            style={{ filter: "drop-shadow(0 0 12px hsl(var(--primary) / 0.7))" }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

export default Spotlight;
