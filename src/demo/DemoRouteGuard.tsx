// src/demo/DemoRouteGuard.tsx
//
// Top-level guard mounted inside <BrowserRouter>. When demo mode is active,
// it keeps demo-owned routes under `/demo/*` and clears demo session data when
// navigation clearly leaves the tour.

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEMO_ACTIVE_STORAGE_KEY, purgeDemoSessionStorage } from "./DemoContext";
import { DEMO_PROJECT_ID } from "./fixtures";
import { isDemoPath } from "./paths";

const PROJECT_ROUTE_PATTERN = /^\/projects\/([^/]+)(?=\/|$)/;

/**
 * Non-project-id paths the demo flow visits. They must be rewritten under
 * `/demo` while a tour is active so the layout / TourPlayer stay mounted.
 */
const DEMO_PATH_PREFIXES = ["/dashboard", "/projects/new"];

function isDemoFlagActive() {
  try {
    return sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DemoRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDemoFlagActive()) return;

    const path = location.pathname;
    if (isDemoPath(path) || path === "/") return;

    const projectMatch = PROJECT_ROUTE_PATTERN.exec(path);
    if (projectMatch) {
      const id = projectMatch[1];
      if (id === DEMO_PROJECT_ID || id === "new") {
        navigate(`/demo${path}${location.search}`, { replace: true });
        return;
      }

      // Any other project route belongs to real app usage. Clear demo-owned
      // session data so prediction/results fixtures cannot leak into reality.
      purgeDemoSessionStorage();
      return;
    }

    if (DEMO_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
      navigate(`/demo${path}${location.search}`, { replace: true });
      return;
    }

    purgeDemoSessionStorage();
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default DemoRouteGuard;
