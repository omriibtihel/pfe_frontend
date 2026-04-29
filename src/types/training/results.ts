import type { TrainingConfig } from './config';

// ── Sub-objects for lightweight ModelResult ───────────────────────────────────

export interface PrimaryMetric {
  name: string;
  value: number | null;
  displayName: string;
  status?: 'success' | 'not_applicable' | 'error';
  direction: 'higher_is_better' | 'lower_is_better';
}

export interface MetricsSummary {
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  rocAuc?: number | null;
  prAuc?: number | null;
  balancedAccuracy?: number | null;
  specificity?: number | null;
  f1Pos?: number | null;
  precisionPos?: number | null;
  recallPos?: number | null;
  precisionMacro?: number | null;
  recallMacro?: number | null;
  f1Macro?: number | null;
  precisionWeighted?: number | null;
  recallWeighted?: number | null;
  f1Weighted?: number | null;
  precisionMicro?: number | null;
  recallMicro?: number | null;
  f1Micro?: number | null;
  r2?: number | null;
  rmse?: number | null;
  mae?: number | null;
  mse?: number | null;
}

export interface SplitSummary {
  method?: string | null;
  trainRows?: number | null;
  valRows?: number | null;
  testRows?: number | null;
}

export interface AutoMLInfo {
  isBest: boolean;
  bestEstimator?: string | null;
  nIterations?: number | null;
  totalTimeS?: number | null;
  timeBudgetS?: number | null;
  metricOptimized?: string | null;
}

// ── EvaluationSource ──────────────────────────────────────────────────────────

export interface EvaluationSource {
  type: 'holdout_test' | 'cv_mean' | 'loo' | 'validation' | 'train_only' | 'unknown';
  label: string;
  isIndependentTest: boolean;
  nSamples: number | null;
}

// ── ModelResult — lightweight, returned by session list/get endpoints ─────────

export interface ModelResult {
  id: string;
  modelType: string;
  taskType: 'classification' | 'regression';
  primaryMetric: PrimaryMetric;
  metrics: MetricsSummary;
  trainScore: number | null;
  testScore: number | null;
  trainingTime: number;
  isSaved: boolean;
  isActive: boolean;
  isCV: boolean;
  hasHoldoutTest: boolean;
  testIsCvMean?: boolean;
  testLabel?: string | null;
  splitInfo?: SplitSummary | null;
  automl?: AutoMLInfo | null;
  evaluationSource: EvaluationSource;
  warnings?: string[];
}

// ── Sub-types used by ModelResultDetail and tab components ────────────────────

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

export interface CalibrationCurveData {
  points: [number, number][];
  brier_score: number;
  n_bins: number;
}

export interface LearningCurveData {
  train_sizes: number[];
  train_mean: (number | null)[];
  train_std: (number | null)[];
  val_mean: (number | null)[];
  val_std: (number | null)[];
  scoring: string;
  n_samples: number;
}

export interface ShapSummaryItem {
  feature: string;
  mean_abs_shap: number;
  mean_shap: number;
}

export interface ShapGlobalData {
  summary: ShapSummaryItem[];
  expected_value: number | null;
  explainer_type: 'tree' | 'linear' | 'kernel';
  n_samples: number;
}

export interface PermutationImportanceItem {
  feature: string;
  mean: number;
  std: number;
}

export interface ResidualStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  skewness: number;
  correlation_with_pred: number;
}

export interface ResidualHistogram {
  bin_edges: number[];
  counts: number[];
}

export interface ResidualAnalysisData {
  stats: ResidualStats;
  histogram: ResidualHistogram;
  qq_points: [number, number][];
  n_samples: number;
}

export interface ArtifactWarning {
  artifact: string;
  error: string;
  detail: string;
}

// ── Sub-objects for ModelResultDetail ─────────────────────────────────────────

export interface CVInfo {
  kFoldsUsed?: number | null;
  nestedCv: boolean;
  cvSummary?: CvMetricsSummary | null;
  cvFoldResults?: CvFoldResult[] | null;
  cvMeanMetrics?: Record<string, number> | null;
  cvTestMetrics?: Record<string, unknown> | null;
}

export interface ThresholdInfo {
  enabled: boolean;
  strategy?: string | null;
  optimalThreshold?: number | null;
  improvementDelta?: number | null;
  warnings: string[];
}

export interface GridSearchResultEntry {
  params: Record<string, unknown>;
  mean_score: number;
  mean_train_score?: number;
  overfit_gap?: number;
  mean_fit_time_s?: number;
  halving_iter?: number;
  n_resources?: number;
}

export interface GridSearchInfo {
  enabled: boolean;
  searchType?: string | null;
  cvBestScore?: number | null;
  cvScoring?: string | null;
  bestParams?: Record<string, unknown> | null;
  cvSplits?: number | null;
  nCandidates?: number | null;
  cvResultsSummary?: GridSearchResultEntry[] | null;
  gridSearchFailed?: boolean;
  gridSearchFailureReason?: string | null;
  warnings?: Array<{ severity: string; code: string; message: string }>;
}

export interface BalancingInfo {
  strategyApplied?: string | null;
  refitMetric?: string | null;
  imbalanceRatio?: number | null;
}

export interface AnalysisBlock {
  crossValidation?: CVInfo | null;
  thresholding?: ThresholdInfo | null;
  gridSearch?: GridSearchInfo | null;
  residualAnalysis?: ResidualAnalysisData | null;
  confusionMatrix?: number[][] | null;
  classDistribution?: Record<string, unknown> | null;
  baseline?: { strategy: string; metrics: Record<string, unknown> } | null;
  metricsWarnings: string[];
  artifactWarnings?: ArtifactWarning[];
}

// ── ModelResultDetail — full, returned by /details endpoint ──────────────────

export interface ModelResultDetail extends ModelResult {
  metricsDetailed: DetailedClassificationMetrics;
  analysis: AnalysisBlock;
  preprocessing?: Record<string, unknown> | null;
  balancing?: BalancingInfo | null;
  hyperparams?: Record<string, unknown> | null;
}

// ── Explainability — returned by /explainability endpoint ────────────────────

export interface ExplainabilityData {
  featureImportance: { feature: string; importance: number }[];
  permutationImportance?: PermutationImportanceItem[] | null;
  shapGlobal?: ShapGlobalData | null;
  artifactWarnings?: ArtifactWarning[];
}

// ── Curves — returned by /curves endpoint ────────────────────────────────────

export interface CurvesData {
  roc?: [number, number][] | null;
  pr?: [number, number][] | null;
  calibration?: CalibrationCurveData | null;
  learningCurves?: LearningCurveData | null;
  artifactWarnings?: ArtifactWarning[];
}

// ── TrainingSession ───────────────────────────────────────────────────────────

export interface TrainingSession {
  id: string;
  projectId: string;
  datasetVersionId?: string | null;
  name?: string | null;
  activeModelId?: string | null;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  progress?: number;
  currentModel?: string | null;
  errorMessage?: string | null;
  config: TrainingConfig;
  results: ModelResult[];
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}
