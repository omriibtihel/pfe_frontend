import { describe, expect, it } from "vitest";

import type { TrainingConfig } from "@/types";
import { toTrainingStartPayload } from "@/services/trainingService";

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
          numericScaling: "none",
          categoricalImputation: "none",
          categoricalEncoding: "none",
        },
        columns: {
          Age: {
            use: true,
            type: "numeric",
            numericImputation: "median",
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
        numericScaling: "none",
        categoricalImputation: "none",
        categoricalEncoding: "none",
      },
      columns: {
        Age: {
          use: true,
          type: "numeric",
          numericImputation: "median",
          numericScaling: "standard",
        },
        City: {
          use: false,
        },
      },
    });
    expect((payload.preprocessing as any).numericImputation).toBeUndefined();
    expect((payload.preprocessing as any).categoricalEncoding).toBeUndefined();
    expect(payload.modelHyperparams).toEqual({});
  });
});
