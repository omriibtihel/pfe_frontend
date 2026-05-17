// src/demo/DemoContext.tsx
//
// Activates demo mode globally:
//   - flips the demoAdapter flag so axios calls are intercepted
//   - injects a fake auth token + user so ProtectedRoute lets the demo through
//   - cleans up on exit, restoring whatever auth state existed before
//
// Mount once at the demo route root via <DemoProvider> — never on regular routes.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import apiClient from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_ME, DEMO_USER_TOKEN, demoFixtures } from "./fixtures";
import { setDemoMode } from "./demoAdapter";

export const DEMO_ACTIVE_STORAGE_KEY = "__mediq_demo_active__";

/**
 * localStorage key holding a backup of the user's real auth token while the
 * demo is active. Surviving a tab crash relies on this — if the tour exits
 * abnormally (closed tab, browser crash, OOM kill, …) the cleanup paths
 * below never run, so the only thing that lets a real session recover is
 * boot-time inspection of this backup key by `recoverFromCrashedDemo()`.
 *
 * Values stored:
 *   - real token string  → restore as the active token
 *   - empty string ""    → user had no token before the demo (i.e. was anon)
 */
export const DEMO_TOKEN_BACKUP_KEY = "__mediq_demo_token_backup__";

/**
 * sessionStorage keys touched by the demo. Centralized so cleanup paths
 * (DemoProvider unmount, TourPlayer onExit, fresh DemoProvider mount)
 * never miss one and leak demo state into a subsequent real-user session.
 *
 * `lastPrediction` and `lastPredictionFile` are normally written by the
 * real PredictionPage flow — we seed them for the demo and must remove
 * them on exit so a real user doesn't see demo data on /predict/results.
 */
/** sessionStorage key holding the tour engine's resume point so it survives
 *  brief unmounts (e.g. `navigate("/projects/new")` → DemoRouteGuard redirect). */
export const DEMO_ENGINE_STATE_KEY = "__mediq_demo_engine__";

export const DEMO_STORAGE_KEYS = [
  DEMO_ACTIVE_STORAGE_KEY,
  DEMO_ENGINE_STATE_KEY,
  "lastPrediction",
  "lastPredictionFile",
] as const;

/** Remove every sessionStorage key the demo writes. Safe to call any time. */
export function purgeDemoSessionStorage() {
  try {
    for (const k of DEMO_STORAGE_KEYS) sessionStorage.removeItem(k);
  } catch {
    /* sessionStorage unavailable — silently degrade */
  }
}

/**
 * If the previous tab crashed mid-demo, the active localStorage token may be
 * `DEMO_USER_TOKEN` while a backup of the real token waits under
 * `DEMO_TOKEN_BACKUP_KEY`. Restore it (or clear, for anon users) before
 * AuthContext.initAuth fires, so the real user's session survives the crash.
 *
 * Must be called from `main.tsx` BEFORE the React tree mounts.
 */
export function recoverFromCrashedDemo(apiClient: { setToken(t: string | null): void; clearToken(): void }) {
  try {
    const backup = localStorage.getItem(DEMO_TOKEN_BACKUP_KEY);
    if (backup === null) return; // nothing to recover
    // If a fresh demo is starting in this tab (sessionStorage flag set by
    // DemoProvider mount which hasn't happened yet), DO NOT touch anything:
    // boot runs before any React effect, so the flag is always absent here
    // — meaning any backup we see is from a previous, dead session.
    if (backup.length > 0) {
      apiClient.setToken(backup);
    } else {
      apiClient.clearToken();
    }
    localStorage.removeItem(DEMO_TOKEN_BACKUP_KEY);
  } catch {
    /* localStorage unavailable — silently degrade */
  }
}

interface DemoContextValue {
  /** True while the tour is mounted. */
  active: boolean;
  /**
   * Restore the user's pre-demo auth state synchronously. Must be called
   * BEFORE any hard navigation away from `/demo` (e.g. `window.location.assign`),
   * otherwise the demo token leaks into AuthContext re-init and the real
   * user ends up logged out by a 401 on /auth/me.
   */
  restorePreviousAuth: () => void;
}

const DemoCtx = createContext<DemoContextValue>({
  active: false,
  restorePreviousAuth: () => {},
});

export function useDemo() {
  return useContext(DemoCtx);
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const previousTokenRef = useRef<string | null>(null);
  const auth = useAuth();

  useEffect(() => {
    let cancelled = false;

    // Defensive: clear any stale demo state from a prior incomplete run so the
    // new session starts clean. We do NOT touch the user's regular auth token
    // because we capture it just below.
    // Order matters: purge BEFORE re-seeding the prediction fixture, otherwise
    // the seed would be wiped by a subsequent purge.
    purgeDemoSessionStorage();

    // Seed sessionStorage so PredictionResultsPage (which reads from there
    // without going through the predictionService mapper) renders even if the
    // user lands on it directly. Uses the camelCase-mapped shape.
    try {
      sessionStorage.setItem(
        "lastPrediction",
        JSON.stringify(demoFixtures.predictionResponseMapped),
      );
      sessionStorage.setItem("lastPredictionFile", "manual");
    } catch {
      /* sessionStorage unavailable — silently degrade */
    }

    // Capture previous auth state so we can restore on exit.
    const currentToken = apiClient.getToken();
    // Multi-tab safety: if the localStorage token is ALREADY the demo token,
    // another tab is mid-demo (or a previous tab crashed). The real-token
    // backup written by that first tab is the source of truth — we must not
    // overwrite it with `DEMO_USER_TOKEN` ourselves. We seed our in-memory
    // ref from that pre-existing backup so cleanup still restores correctly.
    if (currentToken === DEMO_USER_TOKEN) {
      try {
        const existingBackup = localStorage.getItem(DEMO_TOKEN_BACKUP_KEY);
        previousTokenRef.current = existingBackup && existingBackup.length > 0 ? existingBackup : null;
      } catch {
        previousTokenRef.current = null;
      }
    } else {
      previousTokenRef.current = currentToken;
      // First demo entering this tab session — record the real token (or "" for anon)
      // in localStorage so any tab boot can recover it.
      try {
        localStorage.setItem(DEMO_TOKEN_BACKUP_KEY, currentToken ?? "");
      } catch {
        /* localStorage unavailable — crash recovery degraded but tour still works */
      }
    }

    // Enable demo mode BEFORE touching auth so /auth/me is intercepted.
    setDemoMode(true);
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");
    apiClient.setToken(DEMO_USER_TOKEN);

    // Atomically swap the AuthContext user to the demo identity via the
    // standard login flow. The adapter intercepts /auth/login and /auth/me
    // so credentials don't matter. This avoids mixing demo fields into a
    // pre-existing real user via updateUser (which would temporarily
    // pollute the real user's state during the tour).
    auth
      .login({ email: DEMO_ME.email, password: "demo" })
      .catch(() => {
        /* Silently ignore — if login fails the tour still proceeds */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      // Distinguish a TRUE exit from a brief unmount during internal route
      // transitions (e.g. /demo/dashboard → /projects/new → /demo/projects/new
      // intercepted by DemoRouteGuard).
      //   - TourPlayer.onExit clears DEMO_ACTIVE_STORAGE_KEY before unmounting,
      //     so when we see the flag absent we know it's a real exit and we
      //     restore the user's pre-demo auth state.
      //   - If the flag is STILL set, the user is mid-transition — leave the
      //     demo token in place so the next DemoProvider mount reuses it
      //     without an auth churn (which would briefly expose DEMO_USER_TOKEN
      //     to the real backend if any in-flight request slipped through).
      let stillActive = false;
      try { stillActive = sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY) === "1"; } catch { /* noop */ }
      if (stillActive) return;

      setDemoMode(false);
      const prev = previousTokenRef.current;
      if (prev && prev !== DEMO_USER_TOKEN) apiClient.setToken(prev);
      else apiClient.clearToken();
      try { localStorage.removeItem(DEMO_TOKEN_BACKUP_KEY); } catch { /* noop */ }
    };
    // We intentionally only run this once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restorePreviousAuth = useCallback(() => {
    setDemoMode(false);
    const prev = previousTokenRef.current;
    if (prev && prev !== DEMO_USER_TOKEN) apiClient.setToken(prev);
    else apiClient.clearToken();
    // Clear the crash-recovery backup since we restored cleanly.
    try { localStorage.removeItem(DEMO_TOKEN_BACKUP_KEY); } catch { /* noop */ }
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({ active: ready, restorePreviousAuth }),
    [ready, restorePreviousAuth],
  );

  if (!ready) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "hsl(var(--background))",
          color: "hsl(var(--muted-foreground))",
          fontFamily: "inherit",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">Preparing demo…</p>
        </div>
      </div>
    );
  }

  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

export default DemoProvider;
