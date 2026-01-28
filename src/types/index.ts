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

export interface ProcessingOperation {
  id: string;
  type: 'cleaning' | 'imputation' | 'normalization' | 'encoding' | 'other';
  description: string;
  columns: string[];
  timestamp: string;
  parameters?: Record<string, unknown>;
}

// Training Types
export type TaskType = 'classification' | 'regression';
export type ModelType = 'lightgbm' | 'xgboost' | 'randomforest' | 'svm' | 'knn' | 'decisiontree';
export type MetricType = 'accuracy' | 'precision' | 'recall' | 'f1' | 'roc_auc' | 'mse' | 'rmse' | 'mae' | 'r2';

export interface TrainingConfig {
  targetColumn: string;
  taskType: TaskType;
  models: ModelType[];
  useGridSearch: boolean;
  useSmote: boolean;
  splitMethod: 'holdout' | 'kfold';
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  kFolds?: number;
  metrics: MetricType[];
  customCode?: string;
}

export interface ModelResult {
  id: string;
  modelType: ModelType;
  status: 'training' | 'completed' | 'failed';
  metrics: Record<MetricType, number>;
  trainScore: number;
  testScore: number;
  featureImportance: { feature: string; importance: number }[];
  confusionMatrix?: number[][];
  trainingTime: number;
}

export interface TrainingSession {
  id: string;
  projectId: string;
  config: TrainingConfig;
  results: ModelResult[];
  createdAt: string;
  completedAt?: string;
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
