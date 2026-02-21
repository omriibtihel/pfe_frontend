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

vi.mock("@/components/training/wizard/Step2SplitStrategy", () => ({
  Step2SplitStrategy: () => <div>Mock Step2</div>,
}));

vi.mock("@/components/training/wizard/Step3ColumnPreprocessing", () => ({
  Step3ColumnPreprocessing: ({
    onValidationStateChange,
  }: {
    onValidationStateChange?: (state: {
      hasErrors: boolean;
      errorCount: number;
      warningCount: number;
      isValidating: boolean;
    }) => void;
  }) => {
    useEffect(() => {
      onValidationStateChange?.({
        hasErrors: true,
        errorCount: 2,
        warningCount: 0,
        isValidating: false,
      });
    }, [onValidationStateChange]);
    return <div>Mock Step3</div>;
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

describe("TrainingPage", () => {
  it("disables Next on step 3 when blocking errors are reported", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/123/versions/1/training"]}>
        <Routes>
          <Route path="/projects/:projectId/versions/:versionId/training" element={<TrainingPage />} />
        </Routes>
      </MemoryRouter>
    );

    const getNextButton = () => screen.getByRole("button", { name: /suivant/i });

    await waitFor(() => expect(getNextButton()).toBeEnabled());
    fireEvent.click(getNextButton());
    await waitFor(() => expect(screen.getByText("Mock Step2")).toBeInTheDocument());

    fireEvent.click(getNextButton());
    await waitFor(() => expect(screen.getByText("Mock Step3")).toBeInTheDocument());
    await waitFor(() => expect(getNextButton()).toBeDisabled());

    expect(screen.getByText(/corrigez les erreurs step 3/i)).toBeInTheDocument();
  });
});
