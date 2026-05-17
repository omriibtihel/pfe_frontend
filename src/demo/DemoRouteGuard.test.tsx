// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import DemoRouteGuard from "./DemoRouteGuard";
import { DEMO_ACTIVE_STORAGE_KEY } from "./DemoContext";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderGuardAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <DemoRouteGuard />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DemoRouteGuard", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("keeps real project routes outside demo when a stale demo flag exists", async () => {
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");

    renderGuardAt("/projects/123/import?tab=data");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/projects/123/import?tab=data");
    });
    expect(sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY)).toBeNull();
  });

  it("clears stale demo state for future non-numeric real project ids", async () => {
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");

    renderGuardAt("/projects/real-slug/import");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/projects/real-slug/import");
    });
    expect(sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY)).toBeNull();
  });

  it("rewrites demo project routes back into the demo subtree", async () => {
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");

    renderGuardAt("/projects/demo/import?step=upload");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/demo/projects/demo/import?step=upload");
    });
    expect(sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY)).toBe("1");
  });

  it("rewrites project creation routes used by the tour", async () => {
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");

    renderGuardAt("/projects/new");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/demo/projects/new");
    });
    expect(sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY)).toBe("1");
  });

  it("rewrites dashboard routes used by the tour", async () => {
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");

    renderGuardAt("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/demo/dashboard");
    });
    expect(sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY)).toBe("1");
  });

  it("does not treat similar prefixes as demo routes", async () => {
    sessionStorage.setItem(DEMO_ACTIVE_STORAGE_KEY, "1");

    renderGuardAt("/demonstration");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/demonstration");
    });
    expect(sessionStorage.getItem(DEMO_ACTIVE_STORAGE_KEY)).toBeNull();
  });
});
