import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import apiClient from "./services/apiClient";
import { demoRequestInterceptor } from "./demo/demoAdapter";
import {
  DEMO_ACTIVE_STORAGE_KEY,
  purgeDemoSessionStorage,
  recoverFromCrashedDemo,
} from "./demo/DemoContext";
import { isDemoPath } from "./demo/paths";

// Install the demo request interceptor once. It is dormant until demo mode
// is activated by <DemoProvider>.
apiClient.attachRequestInterceptor(demoRequestInterceptor);

// Crash recovery — runs synchronously before React mounts. If the previous
// tab session entered a demo and died (closed mid-tour, OOM, browser crash)
// without the normal cleanup, localStorage still holds DEMO_USER_TOKEN and a
// backup of the real token. Restore it now so AuthContext.initAuth fetches
// /auth/me with the right credentials and the real user keeps their session.
recoverFromCrashedDemo(apiClient);

// Defensive boot-time purge: if a previous tab session left a demo flag
// behind AND we're now loading something outside `/demo`, scrub every
// demo-owned sessionStorage key. Without this, a hard refresh after the
// tour would let demo data (e.g. lastPrediction) leak into a real user's
// /predict/results render.
try {
  const flag = sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY);
  if (flag === "1" && !isDemoPath(window.location.pathname)) {
    purgeDemoSessionStorage();
  }
} catch {
  /* sessionStorage may be unavailable */
}

createRoot(document.getElementById("root")!).render(<App />);
