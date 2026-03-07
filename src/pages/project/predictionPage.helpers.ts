import type { SavedModelSummary } from "@/types";

export type SavedModelVersionGroup = {
  id: string;
  label: string;
  models: SavedModelSummary[];
};

const UNKNOWN_VERSION_ID = "__unknown_version__";
const UNKNOWN_VERSION_LABEL = "Version inconnue";

function toVersionId(value: string | null): string {
  const normalized = String(value ?? "").trim();
  return normalized || UNKNOWN_VERSION_ID;
}

function toVersionLabel(model: SavedModelSummary): string {
  const name = String(model.datasetVersionName ?? "").trim();
  if (name) return name;

  const versionId = String(model.datasetVersionId ?? "").trim();
  if (versionId) return `Version ${versionId}`;

  return UNKNOWN_VERSION_LABEL;
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toComparableScore(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function compareModels(a: SavedModelSummary, b: SavedModelSummary): number {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;

  const trainedAtDiff = toTimestamp(b.trainedAt) - toTimestamp(a.trainedAt);
  if (trainedAtDiff !== 0) return trainedAtDiff;

  const scoreDiff = toComparableScore(b.testScore) - toComparableScore(a.testScore);
  if (scoreDiff !== 0) return scoreDiff;

  return a.modelType.localeCompare(b.modelType);
}

export function buildSavedModelVersionGroups(
  savedModels: SavedModelSummary[],
): SavedModelVersionGroup[] {
  const grouped = new Map<string, SavedModelVersionGroup>();

  for (const model of savedModels) {
    const id = toVersionId(model.datasetVersionId);
    const existing = grouped.get(id);

    if (existing) {
      existing.models.push(model);
      continue;
    }

    grouped.set(id, {
      id,
      label: toVersionLabel(model),
      models: [model],
    });
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      models: [...group.models].sort(compareModels),
    }))
    .sort((a, b) => {
      const aHasActive = a.models.some((model) => model.isActive);
      const bHasActive = b.models.some((model) => model.isActive);
      if (aHasActive !== bHasActive) return aHasActive ? -1 : 1;

      const aLatest = Math.max(...a.models.map((model) => toTimestamp(model.trainedAt)));
      const bLatest = Math.max(...b.models.map((model) => toTimestamp(model.trainedAt)));
      if (aLatest !== bLatest) return bLatest - aLatest;

      return a.label.localeCompare(b.label);
    });
}

export function getDefaultSelectedVersionId(
  groups: SavedModelVersionGroup[],
  currentVersionId: string,
): string {
  if (currentVersionId && groups.some((group) => group.id === currentVersionId)) {
    return currentVersionId;
  }

  return groups[0]?.id ?? "";
}

export function getDefaultSelectedModelId(
  models: SavedModelSummary[],
  currentModelId: string,
): string {
  if (currentModelId && models.some((model) => model.id === currentModelId)) {
    return currentModelId;
  }

  const activeModel = models.find((model) => model.isActive);
  if (activeModel) return activeModel.id;

  return models[0]?.id ?? "";
}
