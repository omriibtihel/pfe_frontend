import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrainingConfig } from "@/types";
import { DEFAULT_TRAINING_PREPROCESSING } from "@/types";
import { Step3ColumnPreprocessing } from "@/components/preparation/Step3ColumnPreprocessing";

const {
  capabilities,
  columns,
  getCapabilitiesMock,
  getColumnsMock,
  profileDatasetMock,
  validateTrainingMock,
} = vi.hoisted(() => {
  const caps = {
    numericImputation: ["none", "median", "mean", "most_frequent", "constant", "knn"],
    numericPowerTransform: ["none", "yeo_johnson", "box_cox"],
    numericScaling: ["none", "standard", "minmax", "robust", "maxabs"],
    categoricalImputation: ["none", "most_frequent", "constant"],
    categoricalEncoding: ["none", "onehot", "ordinal", "label"],
    defaults: {
      numericImputation: "none",
      numericPowerTransform: "none",
      numericScaling: "none",
      categoricalImputation: "none",
      categoricalEncoding: "none",
    },
    supportsPerColumn: true,
    columnTypes: ["numeric", "categorical", "ordinal"],
  };
  const cols = [
    { name: "age", type: "numeric", nullCount: 0, uniqueCount: 10, sampleValues: [42, 50] },
    { name: "city", type: "categorical", nullCount: 0, uniqueCount: 3, sampleValues: ["A", "B"] },
    { name: "Outcome", type: "categorical", nullCount: 0, uniqueCount: 2, sampleValues: [0, 1] },
  ];
  const datasetProfile = {
    n_samples: 100,
    n_features: 2,
    n_classes: 2,
    task_type: "classification",
    imbalance_ratio: null,
    minority_ratio: null,
    has_missing_values: false,
    missing_ratio: 0,
    feature_types: { numeric: 1, categorical: 1, text: 0 },
    dimensionality_ratio: 0.02,
    dataset_size_category: "small",
    estimated_training_speed: "fast",
    recommended_cv_strategy: "holdout",
    recommended_resampling: null,
    recommended_metric: "accuracy",
    meta_features: {},
    non_normal_ratio: 1,
    avg_skewness: 1.2,
    highly_skewed_count: 1,
    column_distribution: {
      age: {
        is_normal: false,
        skewness: 1.2,
        abs_skewness: 1.2,
        n: 100,
        test_used: "shapiro",
        p_value: 0.01,
        has_missing: false,
        has_negative: false,
      },
    },
  };
  return {
    capabilities: caps,
    columns: cols,
    getCapabilitiesMock: vi.fn(async () => ({ preprocessingCapabilities: caps })),
    getColumnsMock: vi.fn(async () => cols),
    profileDatasetMock: vi.fn(async () => datasetProfile),
    validateTrainingMock: vi.fn(async () => ({
      normalized_config: {},
      effective_preprocessing_by_column: {},
      warnings: [],
      errors: [],
      error_details: [],
      previewTransformed: {
        columns: ["num__age"],
        rows: [[1]],
      },
      previewMeta: {
        fittedOn: "train",
        subset: "train",
        mode: "head",
        n: 1,
        splitSeed: 42,
        fromCache: false,
        trainSize: 1,
        valSize: 0,
        testSize: 0,
      },
    })),
  };
});

vi.mock("@/services/trainingService", () => ({
  FALLBACK_PREPROCESSING_CAPABILITIES: capabilities,
  trainingService: {
    getCapabilities: getCapabilitiesMock,
    profileDataset: profileDatasetMock,
    validateTraining: validateTrainingMock,
  },
}));

vi.mock("@/services/dataService", () => ({
  dataService: {
    getVersionTrainingColumns: getColumnsMock,
  },
}));

function makeConfig(
  preprocessing: TrainingConfig["preprocessing"] = { ...DEFAULT_TRAINING_PREPROCESSING }
): TrainingConfig {
  return {
    datasetVersionId: "1",
    targetColumn: "Outcome",
    taskType: "classification",
    models: ["randomforest"],
    useGridSearch: false,
    gridCvFolds: 3,
    gridScoring: "auto",
    useSmote: false,
    splitMethod: "holdout",
    trainRatio: 70,
    valRatio: 15,
    testRatio: 15,
    kFolds: 5,
    metrics: ["accuracy"],
    preprocessing,
    customCode: "",
  };
}

function StatefulStep3({ initialConfig }: { initialConfig: TrainingConfig }) {
  const [config, setConfig] = React.useState<TrainingConfig>(initialConfig);
  return (
    <Step3ColumnPreprocessing
      projectId="123"
      config={config}
      onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
    />
  );
}

describe("Step3ColumnPreprocessing", () => {
  beforeEach(() => {
    getCapabilitiesMock.mockClear();
    getColumnsMock.mockClear();
    profileDatasetMock.mockClear();
    validateTrainingMock.mockClear();
    profileDatasetMock.mockResolvedValue({
      n_samples: 100,
      n_features: 2,
      n_classes: 2,
      task_type: "classification",
      imbalance_ratio: null,
      minority_ratio: null,
      has_missing_values: false,
      missing_ratio: 0,
      feature_types: { numeric: 1, categorical: 1, text: 0 },
      dimensionality_ratio: 0.02,
      dataset_size_category: "small",
      estimated_training_speed: "fast",
      recommended_cv_strategy: "holdout",
      recommended_resampling: null,
      recommended_metric: "accuracy",
      meta_features: {},
      non_normal_ratio: 1,
      avg_skewness: 1.2,
      highly_skewed_count: 1,
      column_distribution: {
        age: {
          is_normal: false,
          skewness: 1.2,
          abs_skewness: 1.2,
          n: 100,
          test_used: "shapiro",
          p_value: 0.01,
          has_missing: false,
          has_negative: false,
        },
      },
    });
    validateTrainingMock.mockResolvedValue({
      normalized_config: {},
      effective_preprocessing_by_column: {},
      warnings: [],
      errors: [],
      error_details: [],
      previewTransformed: {
        columns: ["num__age"],
        rows: [[1]],
      },
      previewMeta: {
        fittedOn: "train",
        subset: "train",
        mode: "head",
        n: 1,
        splitSeed: 42,
        fromCache: false,
        trainSize: 1,
        valSize: 0,
        testSize: 0,
      },
    });
  });

  it("filters rows with search and status filters", async () => {
    render(<Step3ColumnPreprocessing projectId="123" config={makeConfig()} onConfigChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("column-row-age")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/search columns/i), {
      target: { value: "ag" },
    });

    expect(screen.getByTestId("column-row-age")).toBeInTheDocument();
    expect(screen.queryByTestId("column-row-city")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search columns/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /with errors/i }));

    expect(screen.getByTestId("column-row-city")).toBeInTheDocument();
    expect(screen.queryByTestId("column-row-age")).not.toBeInTheDocument();
  });

  it("apply defaults to selected columns affects only selected rows", async () => {
    const onConfigChange = vi.fn();
    render(
      <Step3ColumnPreprocessing
        projectId="123"
        config={makeConfig({
          defaults: {
            numericImputation: "median",
            numericPowerTransform: "yeo_johnson",
            numericScaling: "standard",
            categoricalImputation: "most_frequent",
            categoricalEncoding: "onehot",
          },
          columns: {},
        })}
        onConfigChange={onConfigChange}
      />
    );

    await waitFor(() => expect(screen.getByTestId("column-row-age")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("select-age"));
    fireEvent.click(screen.getByRole("button", { name: /appliquer les defaults/i }));

    const payloads = onConfigChange.mock.calls.map((call) => call[0]).filter((payload) => payload?.preprocessing);
    const latest = payloads[payloads.length - 1];

    expect(latest.preprocessing.columns.age).toEqual(
      expect.objectContaining({
        numericImputation: "median",
        numericPowerTransform: "yeo_johnson",
        numericScaling: "standard",
        categoricalImputation: "most_frequent",
        categoricalEncoding: "onehot",
      })
    );
    expect(latest.preprocessing.columns.city).toBeUndefined();
  });

  it("apply defaults resets an explicit numericPowerTransform override on selected rows", async () => {
    const onConfigChange = vi.fn();
    render(
      <Step3ColumnPreprocessing
        projectId="123"
        config={makeConfig({
          defaults: {
            numericImputation: "median",
            numericPowerTransform: "yeo_johnson",
            numericScaling: "standard",
            categoricalImputation: "most_frequent",
            categoricalEncoding: "onehot",
          },
          columns: {
            age: {
              type: "numeric",
              numericPowerTransform: "box_cox",
            },
          },
        })}
        onConfigChange={onConfigChange}
      />
    );

    await waitFor(() => expect(screen.getByTestId("column-row-age")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("select-age"));
    fireEvent.click(screen.getByRole("button", { name: /appliquer les defaults/i }));

    const payloads = onConfigChange.mock.calls.map((call) => call[0]).filter((payload) => payload?.preprocessing);
    const latest = payloads[payloads.length - 1];

    expect(latest.preprocessing.columns.age).toEqual(
      expect.objectContaining({
        numericPowerTransform: "yeo_johnson",
      })
    );
  });

  it("shows inline local error for categorical column with encoding none", async () => {
    render(<Step3ColumnPreprocessing projectId="123" config={makeConfig()} onConfigChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("column-row-city")).toBeInTheDocument());

    expect(screen.getByLabelText("status-city-error")).toBeInTheDocument();
    expect(screen.getByText(/configuration invalide/i)).toBeInTheDocument();
  });

  it("shows local ordinal error when order is missing", async () => {
    render(
      <Step3ColumnPreprocessing
        projectId="123"
        config={makeConfig({
          defaults: {
            numericImputation: "none",
            numericPowerTransform: "none",
            numericScaling: "none",
            categoricalImputation: "most_frequent",
            categoricalEncoding: "ordinal",
          },
          columns: {
            city: {
              type: "ordinal",
              categoricalEncoding: "ordinal",
            },
          },
        })}
        onConfigChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("status-city-error")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("toggle-issues-city"));
    expect(screen.getAllByText(/ordre explicite/i).length).toBeGreaterThan(0);
  });

  it("renders server validation issue inline per column", async () => {
    validateTrainingMock.mockResolvedValue({
      normalized_config: {},
      effective_preprocessing_by_column: {},
      warnings: [],
      errors: [],
      error_details: [
        {
          column: "age",
          severity: "error",
          code: "nan_found",
          message: "NaN detected in age",
        },
      ],
    });

    render(
      <Step3ColumnPreprocessing
        projectId="123"
        config={makeConfig({
          defaults: {
            numericImputation: "none",
            numericPowerTransform: "none",
            numericScaling: "none",
            categoricalImputation: "most_frequent",
            categoricalEncoding: "onehot",
          },
          columns: {},
        })}
        onConfigChange={vi.fn()}
      />
    );

    await waitFor(() => expect(validateTrainingMock).toHaveBeenCalled(), { timeout: 2500 });
    await waitFor(() => expect(screen.getByLabelText("status-age-error")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("toggle-issues-age"));
    expect(screen.getAllByText(/nan detected in age/i).length).toBeGreaterThan(0);
  });

  it("renders transformed preview table from validation response", async () => {
    validateTrainingMock.mockResolvedValue({
      normalized_config: {},
      effective_preprocessing_by_column: {},
      warnings: [],
      errors: [],
      error_details: [],
      previewTransformed: {
        columns: ["num__age", "num__city"],
        rows: [
          [0.5, 1],
          [1.5, 0],
        ],
      },
      previewMeta: {
        fittedOn: "train",
        subset: "train",
        mode: "head",
        n: 2,
        splitSeed: 42,
        fromCache: false,
        trainSize: 90,
        valSize: 20,
        testSize: 20,
      },
    });

    render(<Step3ColumnPreprocessing projectId="123" config={makeConfig()} onConfigChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId("preview-transformed-table")).toBeInTheDocument(), {
      timeout: 2500,
    });
    expect(screen.getByTestId("preview-transformed-table")).toHaveTextContent("num__age");
    expect(screen.getByTestId("preview-meta-badge")).toHaveTextContent("subset: TRAIN");
  });

  it("updates preview after preprocessing change with debounced validation", async () => {
    vi.useFakeTimers();
    try {
      validateTrainingMock.mockImplementation(async (_projectId: string, cfg: TrainingConfig) => {
        const isAgeDropped = cfg.preprocessing?.columns?.age?.use === false;
        return {
          normalized_config: {},
          effective_preprocessing_by_column: {},
          warnings: [],
          errors: [],
          error_details: [],
          previewTransformed: {
            columns: ["num__age"],
            rows: [[isAgeDropped ? 0 : 1]],
          },
          previewMeta: {
            fittedOn: "train",
            subset: "train",
            mode: "head",
            n: 1,
            splitSeed: 42,
            fromCache: false,
            trainSize: 80,
            valSize: 20,
            testSize: 20,
          },
        };
      });

      render(<StatefulStep3 initialConfig={makeConfig()} />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(validateTrainingMock).toHaveBeenCalledTimes(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(validateTrainingMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("preview-transformed-table")).toHaveTextContent("1");

      fireEvent.click(screen.getByLabelText("use-age"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(499);
      });
      expect(validateTrainingMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(validateTrainingMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("preview-transformed-table")).toHaveTextContent("0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("disables val and test preview subsets when their ratios are zero", async () => {
    render(
      <Step3ColumnPreprocessing
        projectId="123"
        config={{
          ...makeConfig(),
          trainRatio: 100,
          valRatio: 0,
          testRatio: 0,
        }}
        onConfigChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId("preview-subset")).toBeInTheDocument());
    const subsetSelect = screen.getByTestId("preview-subset") as HTMLSelectElement;
    const valOption = Array.from(subsetSelect.options).find((option) => option.value === "val");
    const testOption = Array.from(subsetSelect.options).find((option) => option.value === "test");

    expect(valOption?.disabled).toBe(true);
    expect(testOption?.disabled).toBe(true);
  });
});
