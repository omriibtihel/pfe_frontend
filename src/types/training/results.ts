import type { ModelType, MetricType } from './base';
import type { TrainingConfig } from './config';

// ── CV result types ──────────────────────────────────────────────────────────

export interface CvFoldResult {
  fold: number;
  status: 'ok' | 'failed' | string;
  train_size?: number;
  val_size?: number;
  metrics?: Record<string, number | null | unknown>;
  balancing_strategy?: string;
  smote_samples_added?: number | null;
  best_inner_params?: Record<string, unknown> | null;
  error?: string;
}

export interface CvMetricsSummary {
  mean: Record<string, number>;
  std: Record<string, number>;
  min: Record<string, number>;
  max: Record<string, number>;
  n_folds_ok: number;
}

export interface DetailedAverageMetrics {
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  support?: number | null;
}

export interface DetailedPerClassMetrics {
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  support?: number | null;
}

export interface DetailedClassificationMetrics {
  global?: {
    accuracy?: number | null;
    balanced_accuracy?: number | null;
    roc_auc?: number | null;
    pr_auc?: number | null;
    specificity?: number | null;
  };
  binary?: {
    positive_label?: string | number | null;
    precision_pos?: number | null;
    recall_pos?: number | null;
    f1_pos?: number | null;
  };
  averaged?: {
    macro?: DetailedAverageMetrics;
    weighted?: DetailedAverageMetrics;
    micro?: DetailedAverageMetrics;
  };
  per_class?: Record<string, DetailedPerClassMetrics>;
  confusion_matrix?: {
    labels?: Array<string | number>;
    matrix?: number[][];
  };
  warnings?: string[];
  meta?: {
    classification_type?: string;
    labels?: Array<string | number>;
    positive_label?: string | number | null;
    averaging_defaults?: Record<string, unknown>;
    score_shapes?: Record<string, unknown>;
  };
  legacy_flat?: Record<string, number | null | undefined>;
}

export interface ModelSplitInfo {
  method?: 'holdout' | 'kfold' | 'stratified_kfold' | string;
  train_rows?: number;
  val_rows?: number;
  test_rows?: number | null;
  folds?: number;
  k_folds?: number;
  n_samples?: number;
  /** Number of samples used for CV (= n_samples when testRatio=0). */
  n_samples_cv?: number;
  /** True when a stratified holdout test set was carved out before CV. */
  has_holdout_test?: boolean;
  folds_ok?: number;
  folds_failed?: number;
  avg_train_size?: number;
  avg_val_size?: number;
  rows?: number;
}

export interface TrainingClassDistribution {
  all?: Record<string, number>;
  train?: Record<string, number>;
  val?: Record<string, number>;
  test?: Record<string, number>;
}

export interface TrainingThresholdingInfo {
  enabled?: boolean;
  strategy?: string;
  optimal_threshold?: number;
  improvement_delta?: number;
  val_source?: string;
  threshold?: number;
  score_kind?: string;
  val_precision_pos?: number;
  val_recall_pos?: number;
  val_f1_pos?: number;
  applied_on_test?: boolean;
  warnings?: string[];
  note?: string;
  [key: string]: unknown;
}

export interface ModelPreprocessingArtifact {
  droppedColumns?: string[];
  effectiveByColumn?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ModelBalancingArtifact {
  strategy_applied?: string;
  refit_metric?: string;
  imbalance_ratio?: number;
  [key: string]: unknown;
}

// Sprint 1/2 — probability calibration & confidence
export interface CalibrationCurveData {
  /** [[mean_predicted_prob, fraction_of_positives], ...] */
  points: [number, number][];
  brier_score: number;
  n_bins: number;
}

export interface BootstrapCIEntry {
  mean: number;
  ci_low: number;
  ci_high: number;
  std: number;
}

export interface BootstrapCIResult {
  ci_level: number;
  n_bootstrap: number;
  n_samples: number;
  metrics: Partial<Record<string, BootstrapCIEntry>>;
  warning?: string;
}

// Sprint 2 — learning curves
export interface LearningCurveData {
  train_sizes: number[];
  train_mean: (number | null)[];
  train_std: (number | null)[];
  val_mean: (number | null)[];
  val_std: (number | null)[];
  scoring: string;
  n_samples: number;
}

// Sprint 2 — SHAP global
export interface ShapSummaryItem {
  feature: string;
  /** Mean absolute SHAP value — primary ranking criterion. */
  mean_abs_shap: number;
  /** Signed mean SHAP — positive = pushes prediction up, negative = down. */
  mean_shap: number;
}

export interface ShapGlobalData {
  summary: ShapSummaryItem[];
  expected_value: number | null;
  explainer_type: 'tree' | 'linear' | 'kernel';
  n_samples: number;
}

// Sprint 3 — permutation importance
export interface PermutationImportanceItem {
  feature: string;
  /** Mean importance (drop in score when feature is shuffled). */
  mean: number;
  /** Standard deviation across n_repeats shuffles. */
  std: number;
}

// Sprint 3 — residual analysis (regression only)
export interface ResidualStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  skewness: number;
  /** Pearson correlation between predictions and residuals (ideal: ≈ 0). */
  correlation_with_pred: number;
}

export interface ResidualHistogram {
  bin_edges: number[];
  counts: number[];
}

export interface ResidualAnalysisData {
  stats: ResidualStats;
  histogram: ResidualHistogram;
  /** [[theoretical_z, residual], ...] for a Q-Q plot. */
  qq_points: [number, number][];
  n_samples: number;
}

// ── AutoML result ─────────────────────────────────────────────────────────────

export interface AutoMLResult {
  isAutoML: true;
  isBest: boolean;
  bestEstimator: string;
  nIterations: number | null;
  totalTimeS: number | null;
  timeBudgetS: number | null;
  metricOptimized: string | null;
}

// ── ModelResult ───────────────────────────────────────────────────────────────

export interface ModelResult {
  id: string;
  modelType: ModelType;
  status: 'training' | 'completed' | 'failed' | string;
  metrics: Partial<
    Record<
      | MetricType
      | 'precision_pos'
      | 'recall_pos'
      | 'f1_pos'
      | 'balanced_accuracy'
      | 'specificity'
      | 'brier_score'
      | 'npv'
      | 'mcc',
      number
    >
  >;
  trainScore: number;
  testScore: number;
  primaryMetric?: string | null;
  splitInfo?: ModelSplitInfo | null;
  gridSearch?: {
    enabled?: boolean;
    /** "grid" | "random" | "halving_random" */
    searchType?: 'grid' | 'random' | 'halving_random' | null;
    cvBestScore?: number | null;
    cvScoring?: string | null;
    bestParams?: Record<string, unknown> | null;
    cvSplits?: number | null;
    /** Nombre de combinaisons testées (grid), itérations (random), ou candidats totaux (halving). */
    nCandidates?: number | null;
    /** Top N candidats testés avec leur score CV. Champs optionnels selon le mode de recherche. */
    cvResultsSummary?: Array<{
      params: Record<string, unknown>;
      mean_score: number;
      mean_train_score?: number;
      overfit_gap?: number;
      mean_fit_time_s?: number;
      /** Numéro du round halving où ce candidat a été évalué (HalvingRandomSearchCV uniquement). */
      halving_iter?: number;
      /** Nombre de samples utilisés dans ce round halving. */
      n_resources?: number;
    }> | null;
  } | null;
  // Cross-validation result fields (populated when splitMethod != 'holdout')
  cvFoldResults?: CvFoldResult[] | null;
  cvSummary?: CvMetricsSummary | null;
  isCV?: boolean;
  nestedCv?: boolean;
  kFoldsUsed?: number | null;
  /** True when a holdout test set was separated before CV (testRatio > 0). */
  hasHoldoutTest?: boolean;
  /** Aggregated CV val metrics (mean/std/min/max) — always the cross-validation estimate. */
  cvMeanMetrics?: Record<string, number> | null;
  /** Final holdout test metrics (only present when hasHoldoutTest=true). */
  cvTestMetrics?: Record<string, number | null | unknown> | null;
  featureImportance: { feature: string; importance: number }[];
  /** ROC, PR, and calibration curve data for binary classification. */
  curves?: {
    roc?: [number, number][];         // [[fpr, tpr], ...]
    pr?: [number, number][];          // [[recall, precision], ...]
    calibration?: CalibrationCurveData | null;
  } | null;
  /** Bootstrap confidence intervals computed on the test set (holdout mode). */
  confidenceIntervals?: BootstrapCIResult | null;
  /** Learning curves: training-size vs. cross-validated performance. */
  learningCurves?: LearningCurveData | null;
  /** Permutation feature importance (model-agnostic, test-set based). */
  permutationImportance?: PermutationImportanceItem[] | null;
  /** Residual analysis diagnostics (regression only). */
  residualAnalysis?: ResidualAnalysisData | null;
  /** Global SHAP feature importances (test-set based). */
  shapGlobal?: ShapGlobalData | null;
  confusionMatrix?: number[][];
  metricsDetailed?: DetailedClassificationMetrics | null;
  metricsWarnings?: string[] | null;
  classDistribution?: TrainingClassDistribution | null;
  baselineMajority?: {
    majority_label?: string | number | null;
    metrics?: Record<string, number>;
  } | null;
  splitDebug?: Record<string, unknown> | null;
  preprocessing?: ModelPreprocessingArtifact | null;
  balancing?: ModelBalancingArtifact | null;
  thresholding?: TrainingThresholdingInfo | null;
  /** Seuil de décision effectivement utilisé pour le calcul des métriques test. */
  thresholdUsed?: number | null;
  /** Source du seuil : "disabled" | "default_0.5" | "val_set_optimized" | "train_fallback_optimized" | etc. */
  thresholdSource?: string | null;
  smote?: Record<string, unknown> | null;
  hyperparams?: {
    requested?: Record<string, unknown>;
    effective?: Record<string, unknown>;
    param_grid?: Record<string, unknown>;
    best?: Record<string, unknown>;
  } | null;
  trainingTime: number;
  isSaved?: boolean;
  isActive?: boolean;
  /** Present when the result comes from an AutoML (FLAML) session. */
  automl?: AutoMLResult | null;
}

// ── TrainingSession ───────────────────────────────────────────────────────────

export interface TrainingSession {
  id: string;
  projectId: string;
  datasetVersionId?: string | null;
  activeModelId?: string | null;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  progress?: number;
  /** Label of the model currently being trained, e.g. "randomforest (2/4)". Null when idle. */
  currentModel?: string | null;
  errorMessage?: string | null;
  config: TrainingConfig;
  results: ModelResult[];
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}
