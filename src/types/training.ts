export type TaskType = 'classification' | 'regression';
export type ModelType =
  | 'automl'
  | 'lightgbm'
  | 'xgboost'
  | 'randomforest'
  | 'extratrees'
  | 'gradientboosting'
  | 'svm'
  | 'knn'
  | 'decisiontree'
  | 'logreg'
  | 'logisticregression'
  | 'naivebayes'
  | 'ridge';
export type MetricType =
  | 'accuracy'
  | 'precision'
  | 'recall'
  | 'f1'
  | 'precision_macro'
  | 'recall_macro'
  | 'f1_macro'
  | 'precision_weighted'
  | 'recall_weighted'
  | 'f1_weighted'
  | 'precision_micro'
  | 'recall_micro'
  | 'f1_micro'
  | 'roc_auc'
  | 'pr_auc'
  | 'f1_pos'
  | 'confusion_matrix'
  | 'mse'
  | 'rmse'
  | 'mae'
  | 'r2';
export type SplitMethod = 'holdout' | 'kfold' | 'stratified_kfold';
export type NumericImputationStrategy = 'none' | 'mean' | 'median' | 'most_frequent' | 'constant' | 'knn';
export type CategoricalImputationStrategy = 'none' | 'most_frequent' | 'constant';
export type CategoricalEncodingStrategy = 'none' | 'onehot' | 'ordinal' | 'label';
export type NumericScalingStrategy = 'none' | 'standard' | 'minmax' | 'robust' | 'maxabs';
export type TrainingColumnType = 'numeric' | 'categorical' | 'ordinal';
export type TrainingColumnTypeSelection = 'auto' | TrainingColumnType;
export type TrainingBalancingStrategy =
  | 'none'
  | 'class_weight'
  | 'smote'
  | 'smote_tomek'
  | 'random_undersampling'
  | 'threshold_optimization';
export type TrainingThresholdStrategy =
  | 'maximize_f1'
  | 'maximize_f2'
  | 'min_recall'
  | 'precision_recall_balance';
export type TrainingImbalanceLevel = 'balanced' | 'mild' | 'moderate' | 'severe' | 'critical';
export type GridScoringOption = 'auto' | 'roc_auc' | 'average_precision' | 'f1_weighted' | 'r2';
export type SearchType = 'none' | 'grid' | 'random';
export type TrainingDatasetScale = 'tiny' | 'small' | 'medium' | 'large';

export interface TrainingPreprocessingDefaults {
  numericImputation: NumericImputationStrategy;
  numericScaling: NumericScalingStrategy;
  categoricalImputation: CategoricalImputationStrategy;
  categoricalEncoding: CategoricalEncodingStrategy;
}

export interface TrainingPreprocessingColumnConfig {
  use?: boolean;
  type?: TrainingColumnType;
  numericImputation?: NumericImputationStrategy;
  numericScaling?: NumericScalingStrategy;
  categoricalImputation?: CategoricalImputationStrategy;
  categoricalEncoding?: CategoricalEncodingStrategy;
  ordinalOrder?: string[];
}

export interface TrainingPreprocessingConfig {
  defaults: TrainingPreprocessingDefaults;
  columns: Record<string, TrainingPreprocessingColumnConfig>;
}

export interface TrainingBalancingConfig {
  strategy: TrainingBalancingStrategy;
  applyThreshold: boolean;
  thresholdStrategy: TrainingThresholdStrategy;
  minRecallConstraint?: number | null;
}

export interface TrainingAvailableBalancingStrategy {
  id: TrainingBalancingStrategy;
  label: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  recommended: boolean;
  feasible: boolean;
  infeasible_reason?: string | null;
}

export interface TrainingBalanceClassProfile {
  label: string | number;
  count: number;
  ratio: number;
  role: 'majority' | 'minority';
}

export interface TrainingBalanceAnalysis {
  needs_balancing: boolean;
  imbalance_level: TrainingImbalanceLevel;
  imbalance_ratio: number;
  minority_ratio: number;
  n_samples: number;
  dataset_scale: TrainingDatasetScale;
  majority: TrainingBalanceClassProfile;
  minority: TrainingBalanceClassProfile;
  summary_message: string;
  warnings: string[];
  metric_advice: string[];
  available_strategies: TrainingAvailableBalancingStrategy[];
  default_recommendation: TrainingBalancingStrategy;
}

export type ModelHyperparamScalar = string | number | boolean | null;
export type ModelHyperparamValue = ModelHyperparamScalar | ModelHyperparamScalar[];
export type ModelHyperparams = Record<string, Record<string, ModelHyperparamValue>>;

export interface TrainingHyperparamFieldSchema {
  type: 'int' | 'int_or_none' | 'float' | 'float_or_enum' | 'enum' | 'enum_or_null' | 'str';
  default: ModelHyperparamValue;
  min?: number;
  max?: number;
  gt?: number;
  ge?: number;
  lt?: number;
  le?: number;
  enum?: string[];
  /** Task types for which this field is applicable (e.g. ['classification']). */
  supported_in?: string[];
  help?: string;
}

export interface ClassWeightModelCapability {
  supported: boolean;
  supportedIn: string[];
  options: Array<string | null>;
  default: string | null;
  help: string;
}

export const DEFAULT_TRAINING_PREPROCESSING_DEFAULTS: TrainingPreprocessingDefaults = {
  numericImputation: 'median',
  numericScaling: 'standard',
  categoricalImputation: 'most_frequent',
  categoricalEncoding: 'onehot',
};

export const DEFAULT_TRAINING_PREPROCESSING: TrainingPreprocessingConfig = {
  defaults: { ...DEFAULT_TRAINING_PREPROCESSING_DEFAULTS },
  columns: {},
};

export const DEFAULT_TRAINING_BALANCING: TrainingBalancingConfig = {
  strategy: 'none',
  applyThreshold: false,
  thresholdStrategy: 'maximize_f1',
  minRecallConstraint: null,
};

export type TrainingMode = 'intelligent' | 'manual' | 'automl';

export interface TrainingConfig {
  datasetVersionId: string;
  targetColumn: string;
  taskType: TaskType;
  models: ModelType[];
  /** "none" | "grid" | "random" — replaces useGridSearch. Defaults to "none". */
  searchType: SearchType;
  nIterRandomSearch: number;
  /** @deprecated Use searchType instead. Kept for backward compat. */
  useGridSearch: boolean;
  useClassWeight?: boolean;
  gridCvFolds: number;
  gridScoring: GridScoringOption;
  useSmote: boolean;
  balancing?: TrainingBalancingConfig;
  splitMethod: SplitMethod;
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  kFolds: number;
  shuffle?: boolean;
  metrics: MetricType[];
  positiveLabel?: string | number | null;
  trainingDebug?: boolean;
  preprocessing: TrainingPreprocessingConfig;
  modelHyperparams?: ModelHyperparams;
  customCode?: string;
  /** Whether the config was generated by the intelligent engine or manually. */
  configMode?: TrainingMode;
  /** Keys overridden by the user in intelligent mode. */
  userOverrides?: string[];
}

// ── AutoML mode ───────────────────────────────────────────────────────────────

export interface AutoMLConfig {
  datasetVersionId: string;
  targetColumn: string;
  taskType: TaskType;
  /** Budget temps en secondes (10–3600). */
  timeBudget: number;
  /** Métrique principale à optimiser. undefined = auto. */
  metric?: MetricType;
  /** Ratio du test set final (0–0.4). */
  testRatio: number;
  positiveLabel?: string | number | null;
}

export interface AutoMLResult {
  isAutoML: true;
  bestEstimator: string;
  nIterations: number | null;
  totalTimeS: number | null;
  timeBudgetS: number | null;
  metricOptimized: string | null;
}

// ── Intelligent mode — Dataset profile ────────────────────────────────────────

export interface DatasetFeatureTypes {
  numeric: number;
  categorical: number;
  text: number;
}

export interface DatasetProfile {
  n_samples: number;
  n_features: number;
  n_classes: number | null;
  task_type: string;
  imbalance_ratio: number | null;
  minority_ratio: number | null;
  has_missing_values: boolean;
  missing_ratio: number;
  feature_types: DatasetFeatureTypes;
  dimensionality_ratio: number;
  dataset_size_category: 'tiny' | 'small' | 'medium' | 'large';
  estimated_training_speed: 'fast' | 'moderate' | 'slow';
  recommended_cv_strategy: string;
  recommended_resampling: string | null;
  recommended_metric: string;
  meta_features: Record<string, unknown>;
}

export interface TrainingRecommendation {
  mode: 'intelligent';
  recommended_models: string[];
  recommended_resampling: string | null;
  apply_threshold: boolean;
  recommended_metric: string;
  secondary_metrics: string[];
  recommended_cv_strategy: string;
  recommended_k_folds: number;
  recommended_search_type: string;
  recommended_time_budget_s: number | null;
  recommended_class_weight: string | null;
  recommended_split: { trainRatio: number; valRatio: number; testRatio: number };
  reasoning: Record<string, string>;
  training_config_payload: Record<string, unknown>;
  warnings: string[];
  profile: DatasetProfile;
}

// ── CV result types ──────────────────────────────────────────────────────────

export interface CvFoldResult {
  fold: number;
  status: 'ok' | 'failed' | string;
  train_size?: number;
  val_size?: number;
  metrics?: Record<string, number | null | unknown>;
  balancing_strategy?: string;
  smote_samples_added?: number | null;
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
      | 'specificity',
      number
    >
  >;
  trainScore: number;
  testScore: number;
  primaryMetric?: string | null;
  splitInfo?: ModelSplitInfo | null;
  gridSearch?: {
    enabled?: boolean;
    /** "grid" pour GridSearchCV, "random" pour RandomizedSearchCV. */
    searchType?: 'grid' | 'random' | null;
    cvBestScore?: number | null;
    cvScoring?: string | null;
    bestParams?: Record<string, unknown> | null;
    cvSplits?: number | null;
    /** Nombre de combinaisons testées (grid) ou d'itérations (random). */
    nCandidates?: number | null;
    /** Top N candidats testés avec leur score CV (optionnel, produit par le backend). */
    cvResultsSummary?: Array<{ params: Record<string, unknown>; mean_score: number }> | null;
  } | null;
  // Cross-validation result fields (populated when splitMethod != 'holdout')
  cvFoldResults?: CvFoldResult[] | null;
  cvSummary?: CvMetricsSummary | null;
  isCV?: boolean;
  kFoldsUsed?: number | null;
  /** True when a holdout test set was separated before CV (testRatio > 0). */
  hasHoldoutTest?: boolean;
  /** Aggregated CV val metrics (mean/std/min/max) — always the cross-validation estimate. */
  cvMeanMetrics?: Record<string, number> | null;
  /** Final holdout test metrics (only present when hasHoldoutTest=true). */
  cvTestMetrics?: Record<string, number | null | unknown> | null;
  featureImportance: { feature: string; importance: number }[];
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

export type TrainingValidationPreviewSubset = 'train' | 'val' | 'test';
export type TrainingValidationPreviewMode = 'head' | 'random';
