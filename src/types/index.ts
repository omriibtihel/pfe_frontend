// User & Auth Types
export type UserRole = 'admin' | 'doctor';
export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  specialty?: string;
  qualification?: string;
  experience?: number;
  phone?: string;
  address?: string;
  hospital?: string;
  dateOfBirth?: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  specialty: string;
  qualification: string;
  experience: number;
  phone: string;
  address: string;
  hospital: string;
  dateOfBirth: string;
  profilePhoto?: File;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Project Types
export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
  datasetName?: string;
  targetColumn?: string;
  accuracy?: number;
}

export interface ProjectStats {
  activeProjects: number;
  averageAccuracy: number;
  performanceGrowth: number;
  totalPredictions: number;
}

// Dataset Types
export interface DatasetColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text';
  nullCount: number;
  uniqueCount: number;
  sampleValues: (string | number)[];
}

export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumn[];
  uploadedAt: string;
  data: Record<string, unknown>[];
}

export interface DataVersion {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  operations: string[];
  canPredict: boolean;
}

// Processing Types
export type ImputationMethod = 'mean' | 'median' | 'mode' | 'constant' | 'knn';
export type NormalizationMethod = 'minmax' | 'zscore' | 'robust';
export type EncodingMethod = 'onehot' | 'label' | 'frequency';

export type ProcessingOperation = {
  id: number;
  project_id: number;
  dataset_id: number;
  user_id?: number | null;

  op_type: "cleaning" | "imputation" | "normalization" | "encoding" | "other" | string;
  description: string;

  columns: string[];
  params: Record<string, any>;
  created_at: string;

  result?: Record<string, any> | null;
};


// Training Types
export type TaskType = 'classification' | 'regression';
export type ModelType =
  | 'lightgbm'
  | 'xgboost'
  | 'randomforest'
  | 'svm'
  | 'knn'
  | 'decisiontree'
  | 'logreg'
  | 'logisticregression'
  | 'naivebayes';
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
export type SplitMethod = 'holdout' | 'kfold';
export type NumericImputationStrategy = 'none' | 'mean' | 'median' | 'most_frequent' | 'constant' | 'knn';
export type CategoricalImputationStrategy = 'none' | 'most_frequent' | 'constant';
export type CategoricalEncodingStrategy = 'none' | 'onehot' | 'ordinal' | 'label';
export type NumericScalingStrategy = 'none' | 'standard' | 'minmax' | 'robust' | 'maxabs';
export type TrainingColumnType = 'numeric' | 'categorical' | 'ordinal';
export type TrainingColumnTypeSelection = 'auto' | TrainingColumnType;

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

export type ModelHyperparamScalar = string | number | boolean | null;
export type ModelHyperparamValue = ModelHyperparamScalar | ModelHyperparamScalar[];
export type ModelHyperparams = Record<string, Record<string, ModelHyperparamValue>>;

export interface TrainingHyperparamFieldSchema {
  type: 'int' | 'int_or_none' | 'float' | 'float_or_enum' | 'enum' | 'str';
  default: ModelHyperparamValue;
  min?: number;
  max?: number;
  gt?: number;
  ge?: number;
  lt?: number;
  le?: number;
  enum?: string[];
  help?: string;
}

export const DEFAULT_TRAINING_PREPROCESSING_DEFAULTS: TrainingPreprocessingDefaults = {
  numericImputation: 'none',
  numericScaling: 'none',
  categoricalImputation: 'none',
  categoricalEncoding: 'none',
};

export const DEFAULT_TRAINING_PREPROCESSING: TrainingPreprocessingConfig = {
  defaults: { ...DEFAULT_TRAINING_PREPROCESSING_DEFAULTS },
  columns: {},
};

export interface TrainingConfig {
  datasetVersionId: string;
  targetColumn: string;
  taskType: TaskType;
  models: ModelType[];
  useGridSearch: boolean;
  useClassWeight?: boolean;
  gridCvFolds: number;
  gridScoring: string;
  useSmote: boolean;
  splitMethod: SplitMethod;
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  kFolds: number;
  metrics: MetricType[];
  positiveLabel?: string | number | null;
  trainingDebug?: boolean;
  preprocessing: TrainingPreprocessingConfig;
  modelHyperparams?: ModelHyperparams;
  customCode?: string;
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
  method?: 'holdout' | 'kfold' | string;
  train_rows?: number;
  val_rows?: number;
  test_rows?: number;
  folds?: number;
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
  val_source?: string;
  threshold?: number;
  score_kind?: string;
  val_precision_pos?: number;
  val_recall_pos?: number;
  val_f1_pos?: number;
  applied_on_test?: boolean;
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
    cvBestScore?: number | null;
    cvScoring?: string | null;
    bestParams?: Record<string, unknown> | null;
    cvSplits?: number | null;
  } | null;
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
  preprocessing?: Record<string, unknown> | null;
  balancing?: Record<string, unknown> | null;
  thresholding?: TrainingThresholdingInfo | null;
  smote?: Record<string, unknown> | null;
  hyperparams?: {
    requested?: Record<string, unknown>;
    effective?: Record<string, unknown>;
    param_grid?: Record<string, unknown>;
    best?: Record<string, unknown>;
  } | null;
  trainingTime: number;
}

export interface TrainingSession {
  id: string;
  projectId: string;
  datasetVersionId?: string | null;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  progress?: number;
  errorMessage?: string | null;
  config: TrainingConfig;
  results: ModelResult[];
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

// Prediction Types
export interface PredictionInput {
  mode: 'manual' | 'file';
  data: Record<string, unknown>[] | File;
  applyPreprocessing: boolean;
  versionId?: string;
}

export interface PredictionResult {
  id: string;
  sessionId: string;
  prediction: string | number;
  confidence?: number;
  inputData: Record<string, unknown>;
}

export interface PredictionSession {
  id: string;
  projectId: string;
  modelId: string;
  results: PredictionResult[];
  accuracy?: number;
  createdAt: string;
}

// Admin Types
export interface AdminStats {
  weeklySignups: number;
  approvedUsers: number;
  pendingUsers: number;
  dailyConnections: number;
  specialtyDistribution: { specialty: string; count: number }[];
}

export interface PendingUser {
  id: string;
  fullName: string;
  email: string;
  specialty: string;
  hospital: string;
  createdAt: string;
}
