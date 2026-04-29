import { describe, expect, it } from "vitest";

import type { TrainingConfig } from "@/types";
import {
  FALLBACK_PREPROCESSING_CAPABILITIES,
  toPreprocessingCapabilities,
} from "@/services/trainingService";
import { toTrainingStartPayload } from "@/services/trainingPayloadBuilders";

describe("toTrainingStartPayload", () => {
  it("keeps preprocessing defaults+columns exactly and does not remap metrics/models", () => {
    const config: TrainingConfig = {
      datasetVersionId: "12",
      targetColumn: "Outcome",
      taskType: "classification",
      models: ["logisticregression"],
      useGridSearch: false,
      gridCvFolds: 3,
      gridScoring: "auto",
      useSmote: false,
      splitMethod: "holdout",
      trainRatio: 70,
      valRatio: 15,
      testRatio: 15,
      kFolds: 5,
      metrics: ["accuracy", "pr_auc", "f1_pos", "confusion_matrix"],
      preprocessing: {
        defaults: {
          numericImputation: "none",
          numericPowerTransform: "none",
          numericScaling: "none",
          categoricalImputation: "none",
          categoricalEncoding: "none",
        },
        columns: {
          Age: {
            use: true,
            type: "numeric",
            numericImputation: "median",
            numericPowerTransform: "none",
            numericScaling: "standard",
          },
          City: {
            use: false,
          },
        },
      },
      customCode: "",
    };

    const payload = toTrainingStartPayload(config);

    expect(payload.models).toEqual(["logisticregression"]);
    expect(payload.metrics).toEqual(["accuracy", "pr_auc", "f1_pos", "confusion_matrix"]);
    expect(payload.preprocessing).toEqual({
      defaults: {
        numericImputation: "none",
        numericPowerTransform: "none",
        numericScaling: "none",
        categoricalImputation: "none",
        categoricalEncoding: "none",
      },
      columns: {
        Age: {
          use: true,
          type: "numeric",
          numericImputation: "median",
          numericPowerTransform: "none",
          numericScaling: "standard",
        },
        City: {
          use: false,
        },
      },
    });
    expect((payload.preprocessing as Record<string, unknown>).numericImputation).toBeUndefined();
    expect((payload.preprocessing as Record<string, unknown>).categoricalEncoding).toBeUndefined();
    expect(payload.modelHyperparams).toEqual({});
  });
});

describe("toPreprocessingCapabilities", () => {
  it("keeps numericPowerTransform for flat modern payloads", () => {
    const caps = toPreprocessingCapabilities({
      numericImputation: ["none", "mean"],
      numericPowerTransform: ["none", "yeo_johnson"],
      numericScaling: ["none", "standard"],
      categoricalImputation: ["none", "most_frequent"],
      categoricalEncoding: ["none", "onehot"],
      defaults: {
        numericImputation: "mean",
        numericPowerTransform: "yeo_johnson",
        numericScaling: "standard",
        categoricalImputation: "most_frequent",
        categoricalEncoding: "onehot",
      },
      supportsPerColumn: true,
      columnTypes: ["numeric", "categorical"],
    });

    expect(caps.numericPowerTransform).toEqual(["none", "yeo_johnson"]);
    expect(caps.defaults.numericPowerTransform).toBe("yeo_johnson");
  });

  it("reads numericPowerTransform from legacy normalization capabilities", () => {
    const caps = toPreprocessingCapabilities({
      imputation: {
        numeric: ["none", "mean"],
        categorical: ["none", "most_frequent"],
      },
      encoding: {
        categorical: ["none", "onehot"],
      },
      scaling: {
        numeric: ["none", "standard"],
      },
      normalization: {
        numeric: ["none", "box_cox"],
      },
    });

    expect(caps.numericPowerTransform).toEqual(["none", "box_cox"]);
  });

  it("keeps numericPowerTransform when mixed payloads do not satisfy flatPresent", () => {
    const caps = toPreprocessingCapabilities({
      numericImputation: ["none", "median"],
      numericPowerTransform: ["none", "yeo_johnson"],
      normalization: {
        numeric: ["none", "box_cox"],
      },
    });

    expect(caps.numericPowerTransform).toEqual(["none", "yeo_johnson"]);
  });

  it("falls back to default numericPowerTransform when absent", () => {
    const caps = toPreprocessingCapabilities({
      imputation: {
        numeric: ["none", "mean"],
      },
    });

    expect(caps.numericPowerTransform).toEqual(FALLBACK_PREPROCESSING_CAPABILITIES.numericPowerTransform);
    expect(caps.defaults.numericPowerTransform).toBe(
      FALLBACK_PREPROCESSING_CAPABILITIES.defaults.numericPowerTransform
    );
  });
});
