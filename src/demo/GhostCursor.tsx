// src/demo/GhostCursor.tsx
//
// Animated fake cursor that glides between scene targets.
// Rendered as a fixed overlay above the page (pointer-events: none).

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect } from "react";
import { getRect } from "./domHelpers";

interface GhostCursorProps {
  /** Selector of the currently focused element, or null to hide. */
  target: string | null;
  /** Whether the cursor should render a click pulse at its current position. */
  clicking?: boolean;
}

const CURSOR_SIZE = 28;

export function GhostCursor({ target, clicking }: GhostCursorProps) {
  const x = useMotionValue(window.innerWidth / 2);
  const y = useMotionValue(window.innerHeight / 2);
  const sx = useSpring(x, { stiffness: 120, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 120, damping: 22, mass: 0.6 });

  useEffect(() => {
    if (!target) return;
    const rect = getRect(target);
    if (!rect) return;
    x.set(rect.cx - CURSOR_SIZE / 2);
    y.set(rect.cy - CURSOR_SIZE / 2);
  }, [target, x, y]);

  if (!target) return null;

  return (
    <motion.div
      style={{
        position: "fixed",
        left: sx,
        top: sy,
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        pointerEvents: "none",
        zIndex: 9998,
      }}
      aria-hidden
    >
      {/* Click ripple */}
      {clicking && (
        <motion.span
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: "radial-gradient(circle, hsl(var(--primary) / 0.45) 0%, transparent 70%)",
          }}
        />
      )}

      <svg
        viewBox="0 0 28 28"
        width={CURSOR_SIZE}
        height={CURSOR_SIZE}
        style={{
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
        }}
      >
        <defs>
          <linearGradient id="ghost-cursor-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" />
          </linearGradient>
        </defs>
        <path
          d="M4 3 L4 22 L10 17 L13.5 25 L16.5 23.5 L13 16 L21 16 Z"
          fill="url(#ghost-cursor-grad)"
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

export default GhostCursor;
