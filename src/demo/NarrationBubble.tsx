// src/demo/NarrationBubble.tsx
//
// Floating narration bubble that anchors next to a target element when given,
// or appears bottom-centered when standalone. Animated with framer-motion.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRect, type ElementRect } from "./domHelpers";
import type { LocalizedText, TourLocale } from "./types";

interface NarrationBubbleProps {
  text: LocalizedText | null;
  anchor: string | null;
}

const BUBBLE_WIDTH = 340;
const BUBBLE_OFFSET = 22;

function pickPosition(rect: ElementRect | null): { left: number; top: number; arrow: "top" | "bottom" | "left" | "right" } {
  if (!rect) {
    return {
      left: Math.max(16, window.innerWidth / 2 - BUBBLE_WIDTH / 2),
      top: window.innerHeight - 200,
      arrow: "bottom",
    };
  }
  const vw = window.innerWidth;
  const spaceRight = vw - (rect.x + rect.width);

  // Prefer placing the bubble to the right of the target
  if (spaceRight >= BUBBLE_WIDTH + 24) {
    return {
      left: rect.x + rect.width + BUBBLE_OFFSET,
      top: Math.max(16, rect.cy - 60),
      arrow: "left",
    };
  }
  // Otherwise try left
  if (rect.x >= BUBBLE_WIDTH + 24) {
    return {
      left: rect.x - BUBBLE_WIDTH - BUBBLE_OFFSET,
      top: Math.max(16, rect.cy - 60),
      arrow: "right",
    };
  }
  // Otherwise below
  return {
    left: Math.max(16, Math.min(rect.cx - BUBBLE_WIDTH / 2, vw - BUBBLE_WIDTH - 16)),
    top: rect.y + rect.height + BUBBLE_OFFSET,
    arrow: "top",
  };
}

export function NarrationBubble({ text, anchor }: NarrationBubbleProps) {
  const { i18n } = useTranslation();
  const locale = (i18n.language?.startsWith("en") ? "en" : "fr") as TourLocale;
  const [pos, setPos] = useState(() => pickPosition(null));

  useEffect(() => {
    if (!text) return;
    const update = () => setPos(pickPosition(anchor ? getRect(anchor) : null));
    update();
    const id = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [text, anchor]);

  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text[locale]}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.35 }}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            width: BUBBLE_WIDTH,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <div
            className="rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 100%)",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--primary) / 0.4)",
              boxShadow:
                "0 20px 50px -12px hsl(var(--primary) / 0.35), 0 0 0 1px hsl(var(--primary) / 0.15)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "hsl(var(--primary))",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              ● Demo
            </div>
            {text[locale]}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NarrationBubble;
