// ─────────────────────────────────────────────────────────────────────────────
// Active model
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata about the project's currently active (saved) model. */
export interface ActiveModelInfo {
  modelId: number;
  sessionId: number;
  modelType: string;
  taskType: 'classification' | 'regression';
  featureNames: string[];
  threshold: number;
  trainedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved models list (used by prediction page dropdown)
// ─────────────────────────────────────────────────────────────────────────────

/** One entry in the list of saved models, returned by GET /saved-models. */
export interface SavedModelSummary {
  id: string;
  modelType: string;
  taskType: 'classification' | 'regression';
  sessionId: string;
  datasetVersionId: string | null;
  datasetVersionName: string | null;
  isActive: boolean;
  isSaved: boolean;
  featureNames: string[];
  threshold: number;
  trainedAt: string;
  testScore?: number;
  primaryMetric?: string | null;
  trainingTime?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prediction result structures
// ─────────────────────────────────────────────────────────────────────────────

/** One row of prediction output. */
export interface PredictionRow {
  rowIndex: number;
  prediction: string | number;
  /** Probability of the positive class (classification) or null (regression). */
  score: number | null;
  /** Original input values for this row. */
  inputData: Record<string, unknown>;
}

/** Aggregate statistics across all predicted rows. */
export interface PredictionSummary {
  /** Classification: counts per class label e.g. {"0": 45, "1": 75} */
  classDistribution: Record<string, number> | null;
  /** Mean probability score (classification) or null */
  avgScore: number | null;
  /** Regression stats (only present when taskType=regression) */
  mean?: number;
  min?: number;
  max?: number;
  std?: number;
}

/** Full prediction response returned by the API. */
export interface PredictionResponse {
  modelId: number;
  sessionId: number;
  modelType: string;
  taskType: string;
  timestamp: string;
  nRows: number;
  featureCountReceived: number;
  featureCountExpected: number | null;
  featureNamesExpected: string[];
  thresholdUsed: number;
  rows: PredictionRow[];
  summary: PredictionSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface PredictionInput {
  mode: 'manual' | 'file';
  data: Record<string, unknown>[] | File;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy types kept for backward compatibility (previously used by mock)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use PredictionRow instead */
export interface PredictionResult {
  id: string;
  sessionId: string;
  prediction: string | number;
  confidence?: number;
  inputData: Record<string, unknown>;
}

/** @deprecated Use PredictionResponse instead */
export interface PredictionSession {
  id: string;
  projectId: string;
  modelId: string;
  results: PredictionResult[];
  accuracy?: number;
  createdAt: string;
}
