// src/demo/TourPlayer.tsx
//
// Top-level orchestrator: wires the engine to the visual overlays
// (ghost cursor + spotlight + bubble + controls). Mounted by DemoLayout.

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import GhostCursor from "./GhostCursor";
import Spotlight from "./Spotlight";
import NarrationBubble from "./NarrationBubble";
import TourControls from "./TourControls";
import { useTourEngine } from "./useTourEngine";
import { tourScript } from "./scenes";
import type { TourLocale } from "./types";
import { purgeDemoSessionStorage, useDemo } from "./DemoContext";

export function TourPlayer() {
  const { i18n } = useTranslation();
  const { restorePreviousAuth } = useDemo();
  const locale = (i18n.language?.startsWith("en") ? "en" : "fr") as TourLocale;

  const engine = useTourEngine({
    script: tourScript,
    onExit: () => {
      // Order matters: restore the auth state BEFORE the hard navigate, so
      // AuthContext.initAuth on the next page load fetches /auth/me with the
      // user's real token (or no token), not with DEMO_USER_TOKEN.
      // React's unmount cleanup wouldn't fire reliably after location.assign,
      // so we do the swap synchronously here.
      restorePreviousAuth();
      purgeDemoSessionStorage();
      window.location.assign("/");
    },
  });

  // Auto-start once on mount.
  useEffect(() => {
    engine.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts: Space = play/pause, → = next, ← = prev, Esc = exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.togglePlay();
      } else if (e.key === "ArrowRight") {
        engine.next();
      } else if (e.key === "ArrowLeft") {
        engine.prev();
      } else if (e.key === "Escape") {
        engine.exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  const currentScene = tourScript.scenes[engine.state.sceneIndex];
  const sceneTitle = currentScene?.title[locale] ?? "";

  return (
    <>
      <Spotlight target={engine.state.spotlightTarget} />
      <NarrationBubble
        text={engine.state.currentNarration}
        anchor={engine.state.narrationAnchor}
      />
      <GhostCursor target={engine.state.cursorTarget} clicking={engine.state.clicking} />
      <TourControls
        status={engine.state.status}
        sceneIndex={engine.state.sceneIndex}
        totalScenes={tourScript.scenes.length}
        sceneTitle={sceneTitle}
        progress={engine.state.progress}
        onPlayPause={engine.togglePlay}
        onPrevScene={engine.prev}
        onNextScene={engine.next}
        onExit={engine.exit}
      />
    </>
  );
}

export default TourPlayer;
