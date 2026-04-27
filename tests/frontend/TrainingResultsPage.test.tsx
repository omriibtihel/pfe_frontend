import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/layouts/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/training/results/TrainingResultsHeader", () => ({
  TrainingResultsHeader: () => <div data-testid="results-header" />,
}));

vi.mock("@/components/training/results/ResultsOverview", () => ({
  ResultsOverview: () => <div data-testid="results-overview" />,
}));

vi.mock("@/components/training/results/ModelResultCard", () => ({
  ModelResultCard: () => <div data-testid="model-result-card" />,
}));

vi.mock("@/components/training/results/ModelsComparisonTable", () => ({
  ModelsComparisonTable: () => <div data-testid="comparison-table" />,
}));

vi.mock("@/components/ui/loading-skeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

vi.mock("@/utils/trainingReportPdf", () => ({
  generateTrainingReportPdf: vi.fn(),
}));

vi.mock("@/utils/metricUtils", () => ({
  selectBestModel: vi.fn().mockReturnValue(null),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { getSession, toast } = vi.hoisted(() => ({
  getSession: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  // Return the SAME toast reference on every render; a new vi.fn() per render
  // would cause loadSession's useCallback to recreate on every render and
  // re-fire the initial load effect, consuming mock values unexpectedly.
  useToast: () => ({ toast }),
}));

vi.mock("@/services/trainingService", () => ({
  trainingService: {
    getSession,
    saveModel: vi.fn(),
    setActiveModel: vi.fn(),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { TrainingResultsPage } from "@/pages/project/TrainingResultsPage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRunningSession(overrides = {}) {
  return {
    id: "session-1",
    projectId: "42",
    datasetVersionId: "1",
    name: "Test session",
    status: "running",
    progress: 50,
    currentModel: null,
    errorMessage: null,
    activeModelId: null,
    config: {},
    results: [],
    createdAt: "2026-04-28T00:00:00Z",
    startedAt: "2026-04-28T00:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/42/training/results?session=session-1"]}>
      <Routes>
        <Route
          path="/projects/:projectId/training/results"
          element={<TrainingResultsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrainingResultsPage — silent polling failure indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // These tests let the real 1 500ms polling interval fire naturally.
  // Each test therefore takes ~1 500ms; the vitest timeout is raised to 10s.

  it(
    "test_silent_poll_failure_shows_indicator",
    async () => {
      // Initial load succeeds (non-silent), then the first polling tick fails
      getSession
        .mockResolvedValueOnce(makeRunningSession())
        .mockRejectedValueOnce(new Error("network error"));

      renderPage();

      // Wait for initial load — running card visible, no indicator yet
      await waitFor(() => {
        expect(screen.queryByText("Entraînement en cours...")).not.toBeNull();
      });
      expect(screen.queryByTestId("silent-poll-failed")).toBeNull();

      // Wait for the real 1 500ms polling interval to fire and the rejection to
      // propagate → setSilentPollFailed(true) → indicator appears
      await waitFor(
        () => { expect(screen.getByTestId("silent-poll-failed")).toBeTruthy(); },
        { timeout: 4000 },
      );
    },
    10_000,
  );

  it(
    "test_silent_poll_success_clears_indicator",
    async () => {
      // Initial load succeeds; first poll fails; second poll succeeds
      getSession
        .mockResolvedValueOnce(makeRunningSession())
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce(makeRunningSession());

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText("Entraînement en cours...")).not.toBeNull();
      });

      // First tick → indicator appears
      await waitFor(
        () => { expect(screen.getByTestId("silent-poll-failed")).toBeTruthy(); },
        { timeout: 4000 },
      );

      // Second tick → indicator disappears
      await waitFor(
        () => { expect(screen.queryByTestId("silent-poll-failed")).toBeNull(); },
        { timeout: 4000 },
      );
    },
    10_000,
  );
});
