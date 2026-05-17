// src/demo/types.ts
//
// Type definitions for the demo / guided tour module.
// Scenes are declarative scripts that the TourEngine executes step-by-step.

export type TourLocale = "fr" | "en";

export type LocalizedText = Record<TourLocale, string>;

/**
 * A target is a CSS selector resolved at runtime to a DOM element.
 * We use `data-tour="..."` attributes on real pages to keep coupling loose.
 */
export type TourTarget = string;

/**
 * Steps are atomic actions the tour engine performs in order.
 * Each step has a typed payload so the engine knows exactly what to do.
 */
export type TourStep =
  | { kind: "wait"; ms: number }
  | { kind: "navigate"; to: string }
  | { kind: "moveCursorTo"; target: TourTarget; duration?: number }
  | { kind: "clickAt"; target: TourTarget }
  | { kind: "typeInto"; target: TourTarget; value: string; perCharMs?: number }
  | { kind: "uploadDemoFile"; target: TourTarget; fixtureId: string }
  | { kind: "spotlight"; target: TourTarget }
  | { kind: "narrate"; text: LocalizedText; anchor?: TourTarget; ms?: number }
  | { kind: "clearSpotlight" };

export interface Scene {
  id: string;
  title: LocalizedText;
  /** Route the engine navigates to at scene start (if not already there). */
  route: string;
  /** Approximate duration in ms — used by the progress bar. */
  estimatedMs: number;
  steps: TourStep[];
}

export interface TourScript {
  scenes: Scene[];
}

/** Runtime state exposed by the TourEngine. */
export interface TourState {
  status: "idle" | "playing" | "paused" | "finished";
  sceneIndex: number;
  stepIndex: number;
  /** Progress 0..1 across the whole script. */
  progress: number;
  currentNarration: LocalizedText | null;
  narrationAnchor: TourTarget | null;
  cursorTarget: TourTarget | null;
  spotlightTarget: TourTarget | null;
}
