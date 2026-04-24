import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// ── Module mocks (hoisted by vitest before imports) ──────────────────────────

vi.mock("@/layouts/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/training/wizard/WizardStepper", () => ({
  WizardStepper: () => <div data-testid="wizard-stepper" />,
}));

vi.mock("@/components/training/wizard/Step1DatasetTarget", () => ({
  Step1DatasetTarget: () => <div data-testid="step1" />,
}));

vi.mock("@/components/training/wizard/Step4Models", () => ({
  Step4Models: () => <div data-testid="step4" />,
}));

vi.mock("@/components/training/wizard/Step5Metrics", () => ({
  Step5Metrics: () => <div data-testid="step5" />,
}));

vi.mock("@/components/training/wizard/Step6Summary", () => ({
  Step6Summary: () => <div data-testid="step6" />,
}));

vi.mock("@/components/training/wizard/AutoMLConfigPanel", () => ({
  AutoMLConfigPanel: () => <div data-testid="automl" />,
}));

vi.mock("@/services/dataService", () => ({
  default: {
    getVersions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/utils/prepConfig", () => ({
  loadPrepConfig: vi.fn().mockReturnValue(null),
  savePrepConfig: vi.fn(),
}));

const { getSessions } = vi.hoisted(() => ({ getSessions: vi.fn() }));

vi.mock("@/services/trainingService", () => ({
  trainingService: {
    getSessions,
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

// Import after mocks
import { TrainingPage } from "@/pages/project/TrainingPage";

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/1/training"]}>
      <Routes>
        <Route path="/projects/:id/training" element={<TrainingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrainingPage — FE-03 history load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_history_failure_shows_soft_indicator", async () => {
    getSessions.mockRejectedValue(new Error("network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("history-load-failed")).toBeTruthy();
    });
  });

  it("test_history_failure_does_not_block_training_launch", async () => {
    getSessions.mockRejectedValue(new Error("network error"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("history-load-failed")).toBeTruthy();
    });

    // Wizard stepper is still rendered — training launch is not blocked
    expect(screen.getByTestId("wizard-stepper")).toBeTruthy();
  });

  it("test_history_retry_clears_indicator", async () => {
    getSessions
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("history-load-failed")).toBeTruthy();
    });

    const retryBtn = screen.getByTestId("history-retry-btn");
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("history-load-failed")).toBeNull();
    });
  });
});
