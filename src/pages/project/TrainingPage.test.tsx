import { useEffect, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { TrainingPage } from "@/pages/project/TrainingPage";

vi.mock("@/layouts/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/services/trainingService", () => ({
  trainingService: {
    startTraining: vi.fn(),
    getSession: vi.fn(),
    validateTraining: vi.fn(),
    getSessions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/components/training/wizard/WizardStepper", () => ({
  WizardStepper: () => <div>Mock Stepper</div>,
}));

vi.mock("@/components/training/wizard/Step1DatasetTarget", () => ({
  Step1DatasetTarget: ({ onConfigChange }: { onConfigChange: (updates: Record<string, unknown>) => void }) => {
    useEffect(() => {
      onConfigChange({ targetColumn: "Outcome" });
    }, [onConfigChange]);
    return <div>Mock Step1</div>;
  },
}));

vi.mock("@/components/training/wizard/Step4Models", () => ({
  Step4Models: () => <div>Mock Step4</div>,
}));

vi.mock("@/components/training/wizard/Step5Metrics", () => ({
  Step5Metrics: () => <div>Mock Step5</div>,
}));

vi.mock("@/components/training/wizard/Step6Summary", () => ({
  Step6Summary: () => <div>Mock Step6</div>,
}));

vi.mock("@/components/training/wizard/AutoMLConfigPanel", () => ({
  AutoMLConfigPanel: () => <div>Mock AutoML</div>,
}));

describe("TrainingPage", () => {
  it("mode dialog opens on step 0 and manual mode navigates to step 1 with Suivant disabled", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/123/versions/1/training"]}>
        <Routes>
          <Route path="/projects/:projectId/versions/:versionId/training" element={<TrainingPage />} />
        </Routes>
      </MemoryRouter>
    );

    // After Step1 mock fires onConfigChange({ targetColumn: "Outcome" }), canGoNext becomes true
    // and the button label is "Choisir le mode" (not "Suivant") when trainingMode === null
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /choisir le mode/i })).toBeEnabled()
    );

    // Open mode selection dialog
    fireEvent.click(screen.getByRole("button", { name: /choisir le mode/i }));

    // ModeDialog shows two cards — click the "Mode manuel" card heading
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /mode manuel/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("heading", { name: /mode manuel/i }));

    // After selecting manual mode, wizard advances to step 1 (Step4Models)
    await waitFor(
      () => expect(screen.getByText("Mock Step4")).toBeInTheDocument(),
      { timeout: 2000 }
    );

    // "Suivant" is disabled at step 1 because no models have been selected yet
    expect(screen.getByRole("button", { name: /suivant/i })).toBeDisabled();
  });
});
