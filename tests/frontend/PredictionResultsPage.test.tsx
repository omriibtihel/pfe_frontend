import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Recharts uses ResizeObserver which jsdom doesn't provide
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── Module mocks (hoisted by vitest before imports) ──────────────────────────

vi.mock("@/layouts/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/services/predictionService", () => ({
  predictionService: {
    predictManualWithSavedModelExplain: vi.fn(),
    exportResultsCsv: vi.fn(),
  },
}));

// Import after mocks are registered
import { PredictionResultsPage } from "@/pages/project/PredictionResultsPage";

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/1/predict/results"]}>
      <Routes>
        <Route path="/projects/:id/predict/results" element={<PredictionResultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PredictionResultsPage — FE-01", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("test_parse_error_shows_error_state", () => {
    sessionStorage.setItem("lastPrediction", "THIS IS NOT JSON {{{{");
    renderPage();

    expect(screen.getByTestId("prediction-parse-error")).toBeTruthy();
    // Must NOT show the legitimate "no data" empty state
    expect(screen.queryByTestId("prediction-empty")).toBeNull();
  });

  it("test_valid_parse_renders_table", () => {
    const payload = {
      taskType: "classification",
      modelType: "logisticregression",
      modelId: 1,
      nRows: 2,
      thresholdUsed: 0.5,
      rows: [
        { rowIndex: 0, prediction: "1", score: 0.9, shap: [], inputData: { feature1: 1 } },
        { rowIndex: 1, prediction: "0", score: 0.2, shap: [], inputData: { feature1: 0 } },
      ],
      summary: {
        classDistribution: { "1": 1, "0": 1 },
        mean: null, std: null, min: null, max: null,
      },
    };
    sessionStorage.setItem("lastPrediction", JSON.stringify(payload));
    renderPage();

    // Neither error nor empty state should be shown
    expect(screen.queryByTestId("prediction-parse-error")).toBeNull();
    expect(screen.queryByTestId("prediction-empty")).toBeNull();
    expect(screen.getByText("Résultats de prédiction")).toBeTruthy();
  });

  it("test_empty_session_storage_shows_empty_state_not_error", () => {
    // Nothing stored — legitimately no data, not a parse error
    renderPage();

    expect(screen.getByTestId("prediction-empty")).toBeTruthy();
    expect(screen.queryByTestId("prediction-parse-error")).toBeNull();
  });
});
