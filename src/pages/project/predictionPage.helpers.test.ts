import { describe, expect, it } from "vitest";

import type { SavedModelSummary } from "@/types";
import {
  buildSavedModelVersionGroups,
  getDefaultSelectedModelId,
  getDefaultSelectedVersionId,
} from "@/pages/project/predictionPage.helpers";

function makeSavedModel(overrides: Partial<SavedModelSummary>): SavedModelSummary {
  return {
    id: "model-1",
    modelType: "randomforest",
    taskType: "classification",
    sessionId: "session-1",
    datasetVersionId: "1",
    datasetVersionName: "Version A",
    isActive: false,
    isSaved: true,
    featureNames: ["age", "bmi"],
    threshold: 0.5,
    trainedAt: "2026-03-06T10:00:00Z",
    primaryMetric: null,
    testScore: null,
    ...overrides,
  };
}

describe("predictionPage helpers", () => {
  it("groups models by dataset version and keeps the active version first", () => {
    const models = [
      makeSavedModel({
        id: "m1",
        modelType: "svm",
        datasetVersionId: "2",
        datasetVersionName: "Version B",
        trainedAt: "2026-03-05T10:00:00Z",
      }),
      makeSavedModel({
        id: "m2",
        modelType: "randomforest",
        datasetVersionId: "1",
        datasetVersionName: "Version A",
        isActive: true,
        trainedAt: "2026-03-01T10:00:00Z",
      }),
      makeSavedModel({
        id: "m3",
        modelType: "xgboost",
        datasetVersionId: "1",
        datasetVersionName: "Version A",
        trainedAt: "2026-03-06T12:00:00Z",
      }),
    ];

    const groups = buildSavedModelVersionGroups(models);

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe("1");
    expect(groups[0].models.map((model) => model.id)).toEqual(["m2", "m3"]);
    expect(groups[1].id).toBe("2");
  });

  it("keeps the current version when it still exists", () => {
    const groups = buildSavedModelVersionGroups([
      makeSavedModel({ id: "m1", datasetVersionId: "1", datasetVersionName: "Version A" }),
      makeSavedModel({ id: "m2", datasetVersionId: "2", datasetVersionName: "Version B" }),
    ]);

    expect(getDefaultSelectedVersionId(groups, "2")).toBe("2");
    expect(getDefaultSelectedVersionId(groups, "999")).toBe("1");
  });

  it("chooses the active model first when the current model is no longer available", () => {
    const models = [
      makeSavedModel({ id: "m1", isActive: false }),
      makeSavedModel({ id: "m2", isActive: true }),
      makeSavedModel({ id: "m3", isActive: false }),
    ];

    expect(getDefaultSelectedModelId(models, "m3")).toBe("m3");
    expect(getDefaultSelectedModelId(models, "missing")).toBe("m2");
    expect(getDefaultSelectedModelId([], "missing")).toBe("");
  });
});
