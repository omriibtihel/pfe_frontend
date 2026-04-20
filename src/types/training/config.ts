import type {
  TaskType,
  ModelType,
  MetricType,
  SplitMethod,
  NumericImputationStrategy,
  CategoricalImputationStrategy,
  CategoricalEncodingStrategy,
  NumericScalingStrategy,
  NumericPowerTransformStrategy,
  TrainingColumnType,
  TrainingBalancingStrategy,
  TrainingThresholdStrategy,
  TrainingImbalanceLevel,
  TrainingDatasetScale,
  GridScoringOption,
  SearchType,
  TrainingMode,
} from './base';
import type { ModelHyperparams } from './hyperparams';

export interface TrainingPreprocessingDefaults {
  numericImputation: NumericImputationStrategy;
  numericPowerTransform: NumericPowerTransformStrategy;
  numericScaling: NumericScalingStrategy;
  categoricalImputation: CategoricalImputationStrategy;
  categoricalEncoding: CategoricalEncodingStrategy;
}

export interface TrainingPreprocessingColumnConfig {
  use?: boolean;
  type?: TrainingColumnType;
  numericImputation?: NumericImputationStrategy;
  numericPowerTransform?: NumericPowerTransformStrategy;
  numericScaling?: NumericScalingStrategy;
  categoricalImputation?: CategoricalImputationStrategy;
  categoricalEncoding?: CategoricalEncodingStrategy;
  ordinalOrder?: string[];
  /** Per-column override: k for KNNImputer (overrides global knnNeighbors) */
  knnNeighbors?: number;
  /** Per-column override: fill_value for numeric constant imputation */
  constantFillNumeric?: number;
  /** Per-column override: fill_value for categorical constant imputation */
  constantFillCategorical?: string;
}

export interface TrainingPreprocessingAdvancedParams {
  /** k for KNNImputer — default 5 */
  knnNeighbors: number;
  /** fill_value for numeric constant imputation — default 0 */
  constantFillNumeric: number;
  /** fill_value for categorical constant imputation — default "__missing__" */
  constantFillCategorical: string;
  /** VarianceThreshold threshold — default 0.01 (features with variance < this are dropped) */
  varianceThreshold: number;
}

export const DEFAULT_ADVANCED_PARAMS: TrainingPreprocessingAdvancedParams = {
  knnNeighbors: 5,
  constantFillNumeric: 0,
  constantFillCategorical: '__missing__',
  varianceThreshold: 0.01,
};

export interface TrainingPreprocessingConfig {
  defaults: TrainingPreprocessingDefaults;
  columns: Record<string, TrainingPreprocessingColumnConfig>;
  advancedParams?: TrainingPreprocessingAdvancedParams;
}

export interface TrainingBalancingConfig {
  strategy: TrainingBalancingStrategy;
  applyThreshold: boolean;
  thresholdStrategy: TrainingThresholdStrategy;
  minRecallConstraint?: number | null;
  /** F-beta parameter for maximize_f_beta strategy (default 2.0, range 0.1–10) */
  fBeta?: number;
  /** Cost of a false negative (missed positive) for minimize_cost strategy (default 1.0) */
  costFn?: number;
  /** Cost of a false positive (false alarm) for minimize_cost strategy (default 1.0) */
  costFp?: number;
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

export const DEFAULT_TRAINING_PREPROCESSING_DEFAULTS: TrainingPreprocessingDefaults = {
  numericImputation: 'median',
  numericPowerTransform: 'none',
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

// ── Feature Engineering ──────────────────────────────────────────────────────

export interface FeatureDef {
  name: string;
  enabled: boolean;
  /** Python expression sent to the backend (user-editable, built with operation snippets). */
  expression: string;
}

export interface FeatureEngineeringConfig {
  features: FeatureDef[];
}

export const DEFAULT_FEATURE_ENGINEERING: FeatureEngineeringConfig = { features: [] };

// ── TrainingConfig ────────────────────────────────────────────────────────────

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
  innerCvFolds?: number;
  shuffle?: boolean;
  /** Number of repetitions for repeated_stratified_kfold. Default: 3. */
  nRepeats?: number;
  /** Group column name for group_kfold / stratified_group_kfold (e.g. 'patient_id'). */
  groupColumn?: string;
  metrics: MetricType[];
  positiveLabel?: string | number | null;
  trainingDebug?: boolean;
  preprocessing: TrainingPreprocessingConfig;
  modelHyperparams?: ModelHyperparams;
  customCode?: string;
  /** Training mode: "manual" (with or without recommendations) | "automl" (FLAML). */
  configMode?: TrainingMode;
  /** Keys pre-filled by the recommendation engine that the user may have adjusted. */
  userOverrides?: string[];
  /** User-defined engineered features computed before preprocessing. */
  featureEngineering?: FeatureEngineeringConfig;
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

// ── Intelligent mode — Dataset profile ────────────────────────────────────────

export interface DatasetFeatureTypes {
  numeric: number;
  categorical: number;
  text: number;
}

export interface ColumnDistributionStat {
  is_normal: boolean;
  skewness: number;
  abs_skewness: number;
  n: number;
  test_used: 'shapiro' | 'dagostino';
  p_value: number;
  has_missing: boolean;
  has_negative: boolean;
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
  // Distribution analysis
  non_normal_ratio: number;
  avg_skewness: number;
  highly_skewed_count: number;
  // Per-column stats: {colName: {is_normal, skewness, abs_skewness, n, test_used, p_value, has_missing}}
  column_distribution: Record<string, ColumnDistributionStat>;
}

export interface TrainingRecommendation {
  mode: 'recommendation';
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
  recommended_power_transform: string;
  recommended_scaling: string;
  recommended_preprocessing: Record<string, unknown>;
  recommended_column_configs: Record<string, { numericPowerTransform?: string; numericScaling?: string; numericImputation?: string }>;
  warnings: string[];
  profile: DatasetProfile;
}
