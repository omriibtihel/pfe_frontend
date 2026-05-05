import type { PrimaryMetric } from '@/types/training/results';

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
  primaryMetric: PrimaryMetric | null;
  testScore: number | null;
  trainingTime?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prediction result structures
// ─────────────────────────────────────────────────────────────────────────────

/** One SHAP contribution for a specific feature on a specific row. */
export interface ShapLocalItem {
  feature: string;
  shap_value: number;
  data: number | string | null;
}

/** One LIME contribution for a specific feature on a specific row. */
export interface LimeLocalItem {
  feature: string;
  contribution: number;
  data: number | string | null;
}

/** Method requested when calling the /explain endpoints. */
export type ExplanationMethod = 'shap' | 'lime' | 'both';

/** One row of prediction output. */
export interface PredictionRow {
  rowIndex: number;
  prediction: string | number;
  /** Probability of the positive class (classification) or null (regression). */
  score: number | null;
  /** Original input values for this row. */
  inputData: Record<string, unknown>;
  /** Local SHAP values — present only when /explain endpoint is used with method=shap|both. */
  shap?: ShapLocalItem[] | null;
  /** Local LIME values — present only when /explain endpoint is used with method=lime|both. */
  lime?: LimeLocalItem[] | null;
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

export interface DriftWarning {
  column: string;
  type: 'mean_shift' | 'std_shift' | 'new_categories';
  severity: 'warning' | 'critical';
  detail: string;
}

/** Full prediction response returned by the API. */
export interface PredictionResponse {
  modelId: number;
  sessionId: number;
  modelType: string;
  taskType: 'classification' | 'regression';
  timestamp: string;
  nRows: number;
  featureCountReceived: number;
  featureCountExpected: number | null;
  featureNamesExpected: string[];
  /** Top-K most informative original feature names (from SHAP / fallback alphabetical), used for the inline "Variables clés du modèle" column. */
  topFeatures: string[];
  thresholdUsed: number;
  rows: PredictionRow[];
  summary: PredictionSummary;
  /** Data drift warnings detected at prediction time (empty = no drift). */
  driftWarnings?: DriftWarning[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface PredictionInput {
  mode: 'manual' | 'file';
  data: Record<string, unknown>[] | File;
}

// ─────────────────────────────────────────────────────────────────────────────
// Counterfactual explanations
// ─────────────────────────────────────────────────────────────────────────────

/** One changed feature in a DiCE counterfactual explanation. */
export interface CounterfactualItem {
  feature: string;
  original_value: number | null;
  suggested_value: number | null;
  delta: number | null;
}

/** Full response from POST .../predict/json/counterfactual. */
export interface CounterfactualResult {
  model_id: number;
  task_type: string;
  original_prediction: unknown;
  original_score: number | null;
  /** List of changed features sorted by |delta| descending, or null when no flip was found. */
  counterfactual: CounterfactualItem[] | null;
  /** Human-readable fallback when counterfactual is null. */
  message: string | null;
}

/** Per-feature range used to bound an interactive slider (GET .../feature-ranges). */
export interface FeatureRange {
  type: 'numeric' | 'categorical' | 'unknown';
  /** Numeric only */
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  /** Categorical only */
  categories?: string[];
}

export type FeatureRangesMap = Record<string, FeatureRange>;

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
