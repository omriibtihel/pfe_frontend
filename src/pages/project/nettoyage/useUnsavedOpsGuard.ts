import { useCallback, useEffect, useRef, useState } from "react";

type PendingNav = { execute: () => void } | null;

/**
 * Bloque la navigation quand shouldWarn est true.
 *
 * - Refresh / fermeture onglet → dialogue natif du navigateur (beforeunload)
 * - Navigation in-app (Link, navigate()) → intercepte pushState → modal personnalisé
 *
 * Fonctionne avec BrowserRouter (sans data router).
 */
export function useUnsavedOpsGuard(shouldWarn: boolean) {
  const [pendingNav, setPendingNav] = useState<PendingNav>(null);
  const shouldWarnRef = useRef(shouldWarn);

  useEffect(() => {
    shouldWarnRef.current = shouldWarn;
    if (!shouldWarn) setPendingNav(null);
  }, [shouldWarn]);

  // Refresh / fermeture d'onglet → dialogue natif
  useEffect(() => {
    if (!shouldWarn) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarn]);

  // Navigation in-app : React Router passe par history.pushState
  useEffect(() => {
    const original = window.history.pushState.bind(window.history);

    window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
      if (shouldWarnRef.current) {
        setPendingNav({ execute: () => original(...args) });
        return;
      }
      original(...args);
    };

    return () => {
      window.history.pushState = original;
    };
  }, []); // ref utilisée → pas de dépendance sur shouldWarn

  const proceed = useCallback(() => {
    const nav = pendingNav;
    setPendingNav(null);
    nav?.execute();
  }, [pendingNav]);

  const cancel = useCallback(() => {
    setPendingNav(null);
  }, []);

  return { isBlocked: pendingNav !== null, proceed, cancel };
}
