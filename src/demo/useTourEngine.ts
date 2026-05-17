// src/demo/useTourEngine.ts
//
// Sequential scene/step executor. Owns the runtime state and exposes
// transport controls (play/pause/next/prev/exit). Side effects on the DOM
// (navigation, clicks, typing, file upload) are dispatched here.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  dispatchFileUpload,
  ensureVisible,
  simulateClick,
  sleep,
  typeInto,
  waitForElement,
} from "./domHelpers";
import { fileFixtures } from "./fixtures";
import type { Scene, TourScript, TourState, TourStep } from "./types";

interface EngineState extends TourState {
  /** Internal monotonic token used to cancel in-flight scene runs. */
  runToken: number;
  /** Estimated ms elapsed in the current scene (drives progress bar). */
  sceneElapsedMs: number;
  /** Whether the user is being "clicked" right now (for cursor pulse). */
  clicking: boolean;
}

type Action =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "FINISH" }
  | { type: "GOTO_SCENE"; index: number }
  | { type: "ENTER_STEP"; stepIndex: number }
  | { type: "SET_CURSOR"; target: string | null }
  | { type: "SET_SPOTLIGHT"; target: string | null }
  | { type: "SET_NARRATION"; text: TourState["currentNarration"]; anchor: string | null }
  | { type: "SET_CLICKING"; value: boolean }
  | { type: "TICK"; ms: number }
  | { type: "RESET_ELAPSED" };

const initial: EngineState = {
  status: "idle",
  sceneIndex: 0,
  stepIndex: 0,
  progress: 0,
  currentNarration: null,
  narrationAnchor: null,
  cursorTarget: null,
  spotlightTarget: null,
  runToken: 0,
  sceneElapsedMs: 0,
  clicking: false,
};

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "START":
      return { ...state, status: "playing", runToken: state.runToken + 1 };
    case "PAUSE":
      return { ...state, status: "paused" };
    case "RESUME":
      return { ...state, status: "playing" };
    case "FINISH":
      return { ...state, status: "finished", progress: 1 };
    case "GOTO_SCENE":
      return {
        ...state,
        sceneIndex: action.index,
        stepIndex: 0,
        sceneElapsedMs: 0,
        progress: 0,
        currentNarration: null,
        narrationAnchor: null,
        cursorTarget: null,
        spotlightTarget: null,
        runToken: state.runToken + 1,
        status: "playing",
      };
    case "ENTER_STEP":
      return { ...state, stepIndex: action.stepIndex };
    case "SET_CURSOR":
      return { ...state, cursorTarget: action.target };
    case "SET_SPOTLIGHT":
      return { ...state, spotlightTarget: action.target };
    case "SET_NARRATION":
      return { ...state, currentNarration: action.text, narrationAnchor: action.anchor };
    case "SET_CLICKING":
      return { ...state, clicking: action.value };
    case "TICK": {
      const newElapsed = state.sceneElapsedMs + action.ms;
      return { ...state, sceneElapsedMs: newElapsed };
    }
    case "RESET_ELAPSED":
      return { ...state, sceneElapsedMs: 0, progress: 0 };
    default:
      return state;
  }
}

export interface TourEngine {
  state: EngineState;
  start: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  goto: (index: number) => void;
  exit: () => void;
}

interface UseTourEngineOptions {
  script: TourScript;
  /** Called when the user explicitly exits the demo. */
  onExit: () => void;
}

export function useTourEngine({ script, onExit }: UseTourEngineOptions): TourEngine {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const navigate = useNavigate();
  // Pause coordination: when paused, awaiters wait on this promise.
  const pauseGateRef = useRef<{ promise: Promise<void>; resolve: () => void }>(makeGate());

  // Re-open / close the gate whenever play/pause toggles.
  useEffect(() => {
    if (state.status === "playing") pauseGateRef.current.resolve();
    if (state.status === "paused") pauseGateRef.current = makeGate();
  }, [state.status]);

  const waitWhilePaused = useCallback(async () => {
    while (stateRef.current.status === "paused") {
      // eslint-disable-next-line no-await-in-loop
      await pauseGateRef.current.promise;
    }
  }, []);

  const executeStep = useCallback(
    async (step: TourStep, token: number): Promise<void> => {
      if (stateRef.current.runToken !== token) return;
      await waitWhilePaused();

      switch (step.kind) {
        case "wait":
          await sleep(step.ms);
          return;

        case "navigate":
          navigate(step.to);
          await sleep(400); // let routes mount
          return;

        case "moveCursorTo": {
          const el = await waitForElement(step.target);
          if (el) ensureVisible(el);
          dispatch({ type: "SET_CURSOR", target: step.target });
          await sleep(step.duration ?? 700);
          return;
        }

        case "clickAt": {
          const el = await waitForElement(step.target);
          if (!el) {
            console.warn("[demo] clickAt: target not found", step.target);
            return;
          }
          dispatch({ type: "SET_CURSOR", target: step.target });
          dispatch({ type: "SET_CLICKING", value: true });
          await sleep(220);
          console.debug("[demo] clickAt", step.target);
          simulateClick(el);
          await sleep(280);
          dispatch({ type: "SET_CLICKING", value: false });
          return;
        }

        case "typeInto": {
          const el = (await waitForElement(step.target)) as
            | HTMLInputElement
            | HTMLTextAreaElement
            | null;
          if (!el) return;
          dispatch({ type: "SET_CURSOR", target: step.target });
          await typeInto(el, step.value, step.perCharMs ?? 60);
          return;
        }

        case "uploadDemoFile": {
          const file = fileFixtures[step.fixtureId];
          if (!file) return;
          dispatch({ type: "SET_CURSOR", target: step.target });
          dispatch({ type: "SET_CLICKING", value: true });
          await sleep(200);
          dispatchFileUpload(step.target, file);
          dispatch({ type: "SET_CLICKING", value: false });
          return;
        }

        case "spotlight":
          dispatch({ type: "SET_SPOTLIGHT", target: step.target });
          return;

        case "clearSpotlight":
          dispatch({ type: "SET_SPOTLIGHT", target: null });
          return;

        case "narrate":
          dispatch({
            type: "SET_NARRATION",
            text: step.text,
            anchor: step.anchor ?? null,
          });
          await sleep(step.ms ?? 1800);
          return;

        default:
          return;
      }
    },
    [navigate, waitWhilePaused],
  );

  const runScene = useCallback(
    async (scene: Scene, token: number) => {
      // Navigate to the scene route if needed
      if (window.location.pathname !== scene.route) {
        navigate(scene.route);
        await sleep(450);
      }
      // Reset visual props before starting the scene
      dispatch({ type: "RESET_ELAPSED" });
      dispatch({ type: "SET_CURSOR", target: null });
      dispatch({ type: "SET_SPOTLIGHT", target: null });
      dispatch({ type: "SET_NARRATION", text: null, anchor: null });

      for (let i = 0; i < scene.steps.length; i += 1) {
        if (stateRef.current.runToken !== token) return;
        dispatch({ type: "ENTER_STEP", stepIndex: i });
        // eslint-disable-next-line no-await-in-loop
        await executeStep(scene.steps[i], token);
      }
    },
    [executeStep, navigate],
  );

  // Drive the scene loop whenever sceneIndex or runToken changes.
  useEffect(() => {
    if (state.status === "idle" || state.status === "finished") return;
    const token = state.runToken;
    const scene = script.scenes[state.sceneIndex];
    if (!scene) {
      dispatch({ type: "FINISH" });
      return;
    }
    runScene(scene, token).then(() => {
      if (stateRef.current.runToken !== token) return;
      // Auto-advance to next scene; FINISH if last.
      if (stateRef.current.sceneIndex >= script.scenes.length - 1) {
        dispatch({ type: "FINISH" });
      } else {
        dispatch({ type: "GOTO_SCENE", index: stateRef.current.sceneIndex + 1 });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.runToken, state.sceneIndex]);

  // Progress ticker (independent of step boundaries — smoother UI).
  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => dispatch({ type: "TICK", ms: 200 }), 200);
    return () => window.clearInterval(id);
  }, [state.status]);

  // Derived progress for the current scene (0..1, clamped).
  const scene = script.scenes[state.sceneIndex];
  const progress = scene ? Math.min(1, state.sceneElapsedMs / scene.estimatedMs) : 0;

  const start = useCallback(() => dispatch({ type: "START" }), []);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const resume = useCallback(() => dispatch({ type: "RESUME" }), []);
  const togglePlay = useCallback(() => {
    dispatch({ type: stateRef.current.status === "playing" ? "PAUSE" : "RESUME" });
  }, []);
  const next = useCallback(() => {
    const i = stateRef.current.sceneIndex;
    if (i < script.scenes.length - 1) dispatch({ type: "GOTO_SCENE", index: i + 1 });
  }, [script.scenes.length]);
  const prev = useCallback(() => {
    const i = stateRef.current.sceneIndex;
    if (i > 0) dispatch({ type: "GOTO_SCENE", index: i - 1 });
  }, []);
  const goto = useCallback((index: number) => dispatch({ type: "GOTO_SCENE", index }), []);
  const exit = useCallback(() => onExit(), [onExit]);

  return {
    state: { ...state, progress },
    start,
    pause,
    resume,
    togglePlay,
    next,
    prev,
    goto,
    exit,
  };
}

function makeGate(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
