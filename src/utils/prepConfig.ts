import type {
  TrainingBalancingConfig,
  TrainingPreprocessingConfig,
  SplitMethod,
  TaskType,
} from "@/types";
import { DEFAULT_TRAINING_BALANCING, DEFAULT_TRAINING_PREPROCESSING } from "@/types";

export interface PrepConfig {
  datasetVersionId: string;
  targetColumn: string;
  taskType: TaskType;
  splitMethod: SplitMethod;
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  kFolds: number;
  shuffle?: boolean;
  preprocessing: TrainingPreprocessingConfig;
  balancing: TrainingBalancingConfig;
  useSmote: boolean;
}

export const DEFAULT_PREP_CONFIG: PrepConfig = {
  datasetVersionId: "",
  targetColumn: "",
  taskType: "classification",
  splitMethod: "holdout",
  trainRatio: 70,
  valRatio: 15,
  testRatio: 15,
  kFolds: 5,
  shuffle: true,
  preprocessing: { ...DEFAULT_TRAINING_PREPROCESSING },
  balancing: { ...DEFAULT_TRAINING_BALANCING },
  useSmote: false,
};

const storageKey = (projectId: string, versionId: string) =>
  `mv_prep::${projectId}::${versionId}`;

export function savePrepConfig(
  projectId: string,
  versionId: string,
  config: PrepConfig
): void {
  try {
    localStorage.setItem(storageKey(projectId, versionId), JSON.stringify(config));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

export function loadPrepConfig(
  projectId: string,
  versionId: string
): PrepConfig | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId, versionId));
    if (!raw) return null;
    return JSON.parse(raw) as PrepConfig;
  } catch {
    return null;
  }
}

export function clearPrepConfig(projectId: string, versionId: string): void {
  try {
    localStorage.removeItem(storageKey(projectId, versionId));
  } catch {
    // ignore
  }
}
