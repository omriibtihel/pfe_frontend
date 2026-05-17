// src/demo/TourControls.tsx
//
// Bottom playback bar: play/pause, prev/next scene, segmented progress, exit.

import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TourControlsProps {
  status: "idle" | "playing" | "paused" | "finished";
  sceneIndex: number;
  totalScenes: number;
  sceneTitle: string;
  progress: number; // 0..1
  onPlayPause: () => void;
  onPrevScene: () => void;
  onNextScene: () => void;
  onExit: () => void;
}

export function TourControls({
  status,
  sceneIndex,
  totalScenes,
  sceneTitle,
  progress,
  onPlayPause,
  onPrevScene,
  onNextScene,
  onExit,
}: TourControlsProps) {
  const { t } = useTranslation();
  const playing = status === "playing";

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        className="flex items-center gap-3 rounded-full px-5 py-2.5 backdrop-blur-xl"
        style={{
          pointerEvents: "auto",
          background: "hsl(var(--card) / 0.85)",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          minWidth: 480,
          maxWidth: "92vw",
        }}
      >
        <button
          onClick={onPrevScene}
          disabled={sceneIndex === 0}
          aria-label={t("demo.controls.prev", "Précédent")}
          className="rounded-full p-2 hover:bg-muted disabled:opacity-40 transition-colors"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          onClick={onPlayPause}
          aria-label={playing ? t("demo.controls.pause", "Pause") : t("demo.controls.play", "Lecture")}
          className="rounded-full p-2.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <button
          onClick={onNextScene}
          disabled={sceneIndex >= totalScenes - 1}
          aria-label={t("demo.controls.next", "Suivant")}
          className="rounded-full p-2 hover:bg-muted disabled:opacity-40 transition-colors"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        {/* Segmented progress */}
        <div className="flex-1 flex items-center gap-1.5 mx-2">
          {Array.from({ length: totalScenes }).map((_, i) => {
            const segProgress =
              i < sceneIndex ? 1 : i === sceneIndex ? Math.max(0, Math.min(1, progress)) : 0;
            return (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full overflow-hidden bg-muted"
                style={{ minWidth: 24 }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{
                    width: `${segProgress * 100}%`,
                    background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
          {sceneIndex + 1} / {totalScenes}
        </div>

        <div className="hidden md:block text-sm font-medium text-foreground/80 max-w-[220px] truncate">
          {sceneTitle}
        </div>

        <button
          onClick={onExit}
          aria-label={t("demo.controls.exit", "Quitter")}
          className="rounded-full p-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TourControls;
