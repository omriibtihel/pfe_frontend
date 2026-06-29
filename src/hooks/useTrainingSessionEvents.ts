import { useEffect, useRef, useState } from "react";
import { trainingService } from "@/services/trainingService";

/**
 * Live training-session tracking.
 *
 * Primary transport is the backend SSE stream
 * (`GET /projects/{id}/training/sessions/{sid}/events`). When the stream cannot
 * be reached (proxy/auth/network issue, or a multi-worker backend where the
 * in-memory notifier lives on another process), the hook automatically falls
 * back to polling `getSession`, so the progress UI keeps updating either way.
 *
 * The hook only reports progress; the final per-model results must still be
 * fetched by the consumer (via `getSession`) once `onComplete` fires.
 */

export type TrainingLiveStatus =
  | "idle"
  | "connecting"
  | "running"
  | "succeeded"
  | "failed";

export interface TrainingLiveState {
  status: TrainingLiveStatus;
  progress: number;
  currentModel: string | null;
  phase: string | null;
  index: number | null;
  total: number | null;
  error: string | null;
  /** True while the SSE stream is open and healthy. */
  connected: boolean;
  /** True when progress is being driven by the polling fallback (SSE down). */
  usingFallback: boolean;
}

interface Options {
  enabled: boolean;
  onComplete?: () => void;
  onError?: (message: string) => void;
  /** Polling fallback interval (ms) used only while SSE is unavailable. */
  fallbackIntervalMs?: number;
}

const INITIAL: TrainingLiveState = {
  status: "idle",
  progress: 0,
  currentModel: null,
  phase: null,
  index: null,
  total: null,
  error: null,
  connected: false,
  usingFallback: false,
};

const clampPct = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(100, v))
    : null;

export function useTrainingSessionEvents(
  projectId: string | undefined,
  sessionId: string | null | undefined,
  { enabled, onComplete, onError, fallbackIntervalMs = 2000 }: Options,
): TrainingLiveState {
  const [state, setState] = useState<TrainingLiveState>(INITIAL);

  // Keep callbacks current without re-opening the stream on every render.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !projectId || !sessionId) {
      setState(INITIAL);
      return;
    }

    let done = false; // terminal reached (succeeded/failed) — stop everything
    let lastSeq = -1; // dedupe replayed events after an SSE reconnect
    let connected = false; // current SSE health (read by the poller)
    let es: EventSource | null = null;
    let pollTimer: number | null = null;

    setState((s) => ({ ...s, status: "connecting" }));

    const parse = (raw: unknown): Record<string, unknown> | null => {
      if (typeof raw !== "string") return null;
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const finishOk = () => {
      if (done) return;
      done = true;
      setState((s) => ({ ...s, status: "succeeded", progress: 100 }));
      teardown();
      onCompleteRef.current?.();
    };

    const finishErr = (message: string) => {
      if (done) return;
      done = true;
      setState((s) => ({ ...s, status: "failed", error: message }));
      teardown();
      onErrorRef.current?.(message);
    };

    // ── SSE progress events ────────────────────────────────────────────────
    const onProgress = (ev: MessageEvent) => {
      const d = parse(ev.data);
      if (!d) return;
      const seq = typeof d.seq === "number" ? d.seq : -1;
      if (seq >= 0 && seq <= lastSeq) return; // already seen (replay)
      if (seq > lastSeq) lastSeq = seq;
      setState((s) => ({
        ...s,
        status: "running",
        connected: true,
        usingFallback: false,
        progress: clampPct(d.progress) ?? s.progress,
        currentModel:
          typeof d.currentModel === "string"
            ? d.currentModel
            : typeof d.modelType === "string"
            ? d.modelType
            : s.currentModel,
        phase: typeof d.phase === "string" ? d.phase : s.phase,
        index: typeof d.index === "number" ? d.index : s.index,
        total: typeof d.total === "number" ? d.total : s.total,
      }));
    };

    const onFinal = () => finishOk();
    const onErr = (ev: MessageEvent) => {
      const d = parse(ev.data) ?? {};
      finishErr(typeof d.error === "string" ? d.error : "Training failed");
    };

    // ── Polling fallback (active only while SSE is not connected) ───────────
    const poll = async () => {
      if (done || connected) return;
      try {
        const s = await trainingService.getSession(projectId, sessionId);
        if (done) return;
        const raw = s as {
          status?: string;
          progress?: number;
          currentModel?: string | null;
          errorMessage?: string;
          error_message?: string;
        };
        const st = String(raw.status ?? "running");
        setState((prev) => ({
          ...prev,
          status: connected ? prev.status : "running",
          usingFallback: !connected,
          progress: clampPct(raw.progress) ?? prev.progress,
          currentModel: raw.currentModel ?? prev.currentModel,
        }));
        if (st === "succeeded") finishOk();
        else if (st === "failed")
          finishErr(raw.errorMessage || raw.error_message || "Training failed");
      } catch {
        /* transient — keep trying on the next tick */
      }
    };

    const teardown = () => {
      if (es) {
        es.close();
        es = null;
      }
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    // Open the SSE stream.
    try {
      es = trainingService.getSessionEventSource(projectId, sessionId, lastSeq);
      es.onopen = () => {
        if (done) return;
        connected = true;
        setState((s) => ({ ...s, connected: true, usingFallback: false }));
      };
      es.addEventListener("training.started", onProgress);
      es.addEventListener("training.progress", onProgress);
      es.addEventListener("training.baseline.complete", onProgress);
      es.addEventListener("training.hpo.progress", onProgress);
      es.addEventListener("training.hpo.complete", onProgress);
      es.addEventListener("training.model.complete", onProgress);
      es.addEventListener("training.final.complete", onFinal);
      es.addEventListener("training.error", onErr);
      es.onerror = () => {
        if (done) return;
        // Browser will auto-reconnect; meanwhile mark unhealthy so the
        // polling fallback takes over.
        connected = false;
        setState((s) => ({ ...s, connected: false }));
      };
    } catch {
      connected = false;
    }

    // Fallback poller always runs but no-ops while SSE is connected.
    pollTimer = window.setInterval(() => void poll(), fallbackIntervalMs);

    return teardown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId, sessionId, fallbackIntervalMs]);

  return state;
}
