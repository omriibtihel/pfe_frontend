// src/demo/fixtures.ts
//
// Pre-baked data returned by the demo adapter when in demo mode.
// These shapes mirror the real backend responses 1:1 so the existing pages
// consume them without modification.

import type { DatasetOut, DatasetPreviewOut } from "@/services/datasetService";

export const DEMO_PROJECT_ID = "demo";
export const DEMO_DATASET_ID = 1;
export const DEMO_USER_TOKEN = "__demo_token__";

/** Synthetic cardio dataset used in the upload scene. */
export const DEMO_DATASET_CSV = [
  "age,sex,chest_pain,resting_bp,cholesterol,fasting_bs,max_heart_rate,exercise_angina,target",
  "63,1,3,145,233,1,150,0,1",
  "37,1,2,130,250,0,187,0,1",
  "41,0,1,130,204,0,172,0,1",
  "56,1,1,120,236,0,178,0,1",
  "57,0,0,120,354,0,163,1,0",
  "57,1,0,140,192,0,148,0,0",
  "56,0,1,140,294,0,153,0,1",
  "44,1,1,120,263,0,173,0,1",
  "52,1,2,172,199,1,162,0,1",
  "57,1,2,150,168,0,174,0,1",
].join("\n");

const demoDataset: DatasetOut = {
  id: DEMO_DATASET_ID,
  project_id: 1,
  original_name: "cardio_demo.csv",
  stored_name: "cardio_demo.csv",
  file_path: "/demo/cardio_demo.csv",
  content_type: "text/csv",
  size_bytes: DEMO_DATASET_CSV.length,
  created_at: new Date().toISOString(),
};

const demoColumns = [
  "age",
  "sex",
  "chest_pain",
  "resting_bp",
  "cholesterol",
  "fasting_bs",
  "max_heart_rate",
  "exercise_angina",
  "target",
];

const demoRows: Record<string, unknown>[] = DEMO_DATASET_CSV.split("\n")
  .slice(1)
  .map((line) => {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};
    demoColumns.forEach((col, i) => {
      const v = cells[i];
      const n = Number(v);
      row[col] = Number.isFinite(n) ? n : v;
    });
    return row;
  });

const demoPreview: DatasetPreviewOut = {
  dataset: demoDataset,
  shape: { rows: demoRows.length, cols: demoColumns.length },
  columns: demoColumns,
  dtypes: demoColumns.reduce<Record<string, string>>((acc, c) => {
    acc[c] = "int64";
    return acc;
  }, {}),
  rows: demoRows,
};

/** Demo user returned by /auth/me when in demo mode. */
export const DEMO_ME = {
  id: 999,
  full_name: "Demo Doctor",
  email: "demo@mediq.io",
  role: "DOCTOR",
  status: "APPROVED",
  profile_photo: null,
  phone: null,
  address: null,
  date_of_birth: null,
  specialty: "Cardiology",
  hospital: "Mediq Demo Hospital",
};

/** Demo project returned by /projects endpoints. */
export const DEMO_PROJECT = {
  id: DEMO_PROJECT_ID,
  name: "Cardio Demo",
  description: "Interactive demo project — heart disease prediction.",
  project_type: "tabular",
  owner_id: DEMO_ME.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Demo version used by Preparation / Training pages. */
export const DEMO_VERSION_ID = 1;

const demoVersion = {
  id: DEMO_VERSION_ID,
  project_id: 1,
  source_dataset_id: DEMO_DATASET_ID,
  name: "v1 — cleaned cardio",
  file_path: "/demo/cardio_v1.csv",
  stored_name: "cardio_v1.csv",
  size_bytes: DEMO_DATASET_CSV.length,
  operations: ["drop_na", "encode_categorical"],
  created_at: new Date().toISOString(),
  target_column: "target",
  can_predict: true,
};

/** ColumnsMetaOut shape — used by Step3 column preprocessing UI. */
const demoColumnsMeta = {
  total_rows: demoRows.length,
  counts: { numeric: 8, categorical: 1 },
  columns: demoColumns.map((name, i) => ({
    name,
    dtype: "int64",
    kind: i === demoColumns.length - 1 ? "binary" : "numeric",
    inferred_kind: i === demoColumns.length - 1 ? "binary" : "numeric",
    override_kind: null,
    confidence: 0.95,
    missing: 0,
    unique: name === "target" ? 2 : Math.max(5, demoRows.length - i),
    total: demoRows.length,
    sample: demoRows.slice(0, 3).map((r) => String(r[name])),
    skewness: 0.1,
    outlier_count: 0,
    outlier_ratio: 0,
    has_negative: false,
    min_val: 0,
    max_val: 100,
    mean_val: 50,
    median_val: 50,
    q1_val: 25,
    q3_val: 75,
    parasites: null,
  })),
};

/** Training capabilities shape — mirrors the real /training/capabilities response. */
const demoCapabilities = {
  splitMethods: ["holdout", "kfold", "stratified_kfold"],
  models: {
    classification: ["randomforest", "logisticregression", "xgboost", "svm"],
    regression: ["randomforest", "linearregression", "xgboost"],
  },
  metrics: {
    classification: ["accuracy", "precision", "recall", "f1", "roc_auc"],
    regression: ["mae", "mse", "rmse", "r2"],
  },
  searchTypes: ["none", "grid", "random"],
  balancingStrategies: ["none", "smote", "class_weight", "random_undersampling"],
  classWeightCapabilities: {},
  modelHyperparamsSchema: {},
};

/** Training profile shape — matches the real DatasetProfile (snake_case). */
const demoProfile = {
  n_samples: demoRows.length,
  n_features: demoColumns.length - 1,
  n_classes: 2,
  task_type: "classification",
  imbalance_ratio: 1,
  minority_ratio: 0.5,
  has_missing_values: false,
  missing_ratio: 0,
  feature_types: {
    numeric: demoColumns.slice(0, -1),
    categorical: [],
    datetime: [],
    text: [],
  },
  dimensionality_ratio: 0.8,
  dataset_size_category: "tiny",
  estimated_training_speed: "fast",
  recommended_cv_strategy: "stratified_kfold",
  recommended_resampling: null,
  recommended_metric: "f1",
  meta_features: {},
  non_normal_ratio: 0,
  avg_skewness: 0.1,
  highly_skewed_count: 0,
  columns_capped: false,
  columns_capped_count: 0,
  transform_suggestions: {},
  column_distribution: {},
};

/** Training recommendation shape. */
const demoRecommendation = {
  taskType: "classification",
  splitMethod: "stratified_kfold",
  kFolds: 5,
  models: ["randomforest", "logisticregression"],
  primaryMetric: "f1",
  metrics: ["accuracy", "f1", "roc_auc"],
  balancingStrategy: "class_weight",
  rationale: {
    fr: "Dataset équilibré et de petite taille — Stratified K-Fold (5 plis) avec deux modèles robustes (RF, LR).",
    en: "Balanced small dataset — Stratified K-Fold (5 splits) with two robust models (RF, LR).",
  },
  estimatedDurationSec: 12,
};

/** DatasetOverviewOut — used by DataExploration "Aperçu" tab. */
const demoOverview = {
  dataset: demoDataset,
  shape: { rows: demoRows.length, cols: demoColumns.length },
  columns: demoColumns,
  dtypes: demoColumns.reduce<Record<string, string>>((acc, c) => {
    acc[c] = "int64";
    return acc;
  }, {}),
  missing: demoColumns.reduce<Record<string, number>>((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {}),
  preview: demoRows,
};

/** DatasetProfileOut — used by "Colonnes" tab. */
const demoProfileOut = {
  dataset: demoDataset,
  shape: { rows: demoRows.length, cols: demoColumns.length },
  profiles: demoColumns.map((name) => ({
    name,
    kind: "numeric" as const,
    dtype: "int64",
    missing: 0,
    missing_pct: 0,
    unique: name === "target" ? 2 : 8,
    unique_pct: name === "target" ? 0.2 : 0.8,
    numeric: {
      count: demoRows.length,
      mean: 50,
      std: 20,
      min: 0,
      p25: 30,
      p50: 50,
      p75: 70,
      max: 100,
    },
    categorical: null,
    parasites: null,
  })),
};

/** Correlation matrix — used by "Analyse" tab heatmap. */
const demoCorrelation = {
  columns: demoColumns,
  matrix: demoColumns.map((_, i) =>
    demoColumns.map((__, j) => {
      if (i === j) return 1;
      // Lightly correlated synthetic values
      const v = Math.sin((i + 1) * (j + 1) * 0.7) * 0.5;
      return Math.round(v * 100) / 100;
    }),
  ),
};

/** Histogram payload — used by Charts page. */
const demoHistogram = {
  col: "age",
  bins: 8,
  rows: [
    { x0: 30, x1: 40, count: 1 },
    { x0: 40, x1: 50, count: 2 },
    { x0: 50, x1: 60, count: 4 },
    { x0: 60, x1: 70, count: 2 },
    { x0: 70, x1: 80, count: 1 },
  ],
};

/** value-counts payload — used by Charts page pie/bar. */
const demoValueCounts = {
  col: "sex",
  top_k: 2,
  total_count: demoRows.length,
  others_count: 0,
  rows: [
    { value: "1", count: 7 },
    { value: "0", count: 3 },
  ],
};

/** Aggregate payload. */
const demoAggregate = {
  x: "chest_pain",
  y: "cholesterol",
  agg: "avg" as const,
  top_k: 10,
  order: "desc" as const,
  rows: [
    { x: "0", y: 310 },
    { x: "1", y: 250 },
    { x: "2", y: 215 },
    { x: "3", y: 240 },
  ],
};

/** Nettoyage operations — empty timeline, mock structure. */
const demoOperations: unknown[] = [];

// ── Training results fixtures ────────────────────────────────────────────────

export const DEMO_SESSION_ID = "demo-session";

const buildModelResult = (
  id: string,
  modelType: string,
  primary: number,
  active: boolean,
) => ({
  id,
  modelType,
  taskType: "classification" as const,
  primaryMetric: {
    name: "f1",
    value: primary,
    displayName: "F1 score",
    direction: "higher_is_better" as const,
  },
  metrics: {
    accuracy: 0.85 + Math.random() * 0.05,
    precision: 0.83 + Math.random() * 0.05,
    recall: 0.82 + Math.random() * 0.05,
    f1: primary,
    rocAuc: 0.91 + Math.random() * 0.04,
    prAuc: 0.88 + Math.random() * 0.04,
  },
  trainScore: primary + 0.04,
  testScore: primary,
  trainingTime: 1.2,
  isSaved: active,
  isActive: active,
  isCV: true,
  hasHoldoutTest: false,
  evaluationSource: {
    type: "cv_mean" as const,
    label: "5-Fold CV mean",
    isIndependentTest: false,
    nSamples: 10,
  },
});

const demoSession = {
  id: DEMO_SESSION_ID,
  projectId: DEMO_PROJECT_ID,
  datasetVersionId: String(DEMO_VERSION_ID),
  name: "Demo run — cardio",
  status: "succeeded" as const,
  progress: 100,
  activeModelId: "model-rf",
  config: {
    datasetVersionId: String(DEMO_VERSION_ID),
    targetColumn: "target",
    taskType: "classification",
    models: ["randomforest", "logisticregression"],
    splitMethod: "stratified_kfold",
    kFolds: 5,
    metrics: ["accuracy", "f1", "roc_auc"],
    modelHyperparams: {},
  },
  results: [
    buildModelResult("model-rf", "randomforest", 0.87, true),
    buildModelResult("model-lr", "logisticregression", 0.83, false),
  ],
  createdAt: new Date().toISOString(),
  startedAt: new Date(Date.now() - 12000).toISOString(),
  completedAt: new Date().toISOString(),
};

// ── Saved models / Prediction fixtures ───────────────────────────────────────

const featureNames = demoColumns.slice(0, -1); // all except "target"

const demoSavedModels = [
  {
    id: "model-rf",
    modelType: "randomforest",
    taskType: "classification" as const,
    sessionId: DEMO_SESSION_ID,
    datasetVersionId: String(DEMO_VERSION_ID),
    datasetVersionName: "v1 — cleaned cardio",
    isActive: true,
    isSaved: true,
    featureNames,
    threshold: 0.5,
    trainedAt: new Date().toISOString(),
    primaryMetric: {
      name: "f1",
      value: 0.87,
      displayName: "F1 score",
      direction: "higher_is_better" as const,
    },
    testScore: 0.87,
    trainingTime: 1.2,
  },
];

const demoActiveModel = {
  modelId: demoSavedModels[0].id,
  modelType: demoSavedModels[0].modelType,
  taskType: demoSavedModels[0].taskType,
  featureNames,
  threshold: 0.5,
};

// Prediction response is snake_case for the API path — the service maps it to
// camelCase client-side. We expose BOTH shapes: the adapter returns the
// snake_case raw form (mimicking the backend), and DemoProvider seeds
// sessionStorage with the already-mapped camelCase form so the
// PredictionResultsPage (which reads directly from sessionStorage, no mapper)
// renders without crashes.
const demoPredictionResponseRaw = {
  model_id: 1,
  session_id: 1,
  model_type: "randomforest",
  task_type: "classification" as const,
  timestamp: new Date().toISOString(),
  n_rows: 1,
  feature_count_received: featureNames.length,
  feature_count_expected: featureNames.length,
  feature_names_expected: featureNames,
  top_features: ["chest_pain", "max_heart_rate", "age", "cholesterol"],
  threshold_used: 0.5,
  rows: [
    {
      row_index: 0,
      prediction: 1,
      score: 0.82,
      input_data: {
        age: 55,
        sex: 1,
        chest_pain: 2,
        resting_bp: 140,
        cholesterol: 240,
        fasting_bs: 0,
        max_heart_rate: 160,
        exercise_angina: 0,
      },
    },
  ],
  summary: {
    class_distribution: { "0": 0, "1": 1 },
    avg_score: 0.82,
  },
  drift_warnings: [],
};

/**
 * Local SHAP values for the single demo prediction row. Positive contributions
 * push the prediction toward class 1 (heart disease present), negative toward 0.
 */
const demoShapLocal = [
  { feature: "chest_pain", shap_value: 0.21, data: 2 },
  { feature: "max_heart_rate", shap_value: 0.14, data: 160 },
  { feature: "age", shap_value: 0.09, data: 55 },
  { feature: "cholesterol", shap_value: 0.07, data: 240 },
  { feature: "exercise_angina", shap_value: -0.05, data: 0 },
  { feature: "resting_bp", shap_value: 0.04, data: 140 },
  { feature: "fasting_bs", shap_value: -0.02, data: 0 },
  { feature: "sex", shap_value: 0.01, data: 1 },
];

const demoLimeLocal = [
  { feature: "chest_pain", contribution: 0.18, data: 2 },
  { feature: "max_heart_rate", contribution: 0.12, data: 160 },
  { feature: "age", contribution: 0.08, data: 55 },
  { feature: "cholesterol", contribution: 0.06, data: 240 },
  { feature: "resting_bp", contribution: 0.03, data: 140 },
  { feature: "exercise_angina", contribution: -0.04, data: 0 },
  { feature: "sex", contribution: 0.02, data: 1 },
  { feature: "fasting_bs", contribution: -0.01, data: 0 },
];

/** Snake-case raw shape mirroring backend /predict/json/explain. */
const demoPredictionExplainRaw = {
  ...demoPredictionResponseRaw,
  rows: [
    {
      ...demoPredictionResponseRaw.rows[0],
      shap: demoShapLocal,
      lime: demoLimeLocal,
    },
  ],
};

/** Mapped/camelCase shape mirroring what `predictionService` produces. */
const demoPredictionResponseMapped = {
  modelId: 1,
  sessionId: 1,
  modelType: "randomforest",
  taskType: "classification" as const,
  timestamp: demoPredictionResponseRaw.timestamp,
  nRows: 1,
  featureCountReceived: featureNames.length,
  featureCountExpected: featureNames.length,
  featureNamesExpected: featureNames,
  topFeatures: demoPredictionResponseRaw.top_features,
  thresholdUsed: 0.5,
  rows: [
    {
      rowIndex: 0,
      prediction: 1,
      score: 0.82,
      inputData: demoPredictionResponseRaw.rows[0].input_data,
      shap: demoShapLocal,
      lime: demoLimeLocal,
    },
  ],
  summary: {
    classDistribution: { "0": 0, "1": 1 },
    avgScore: 0.82,
  },
  driftWarnings: [],
};

export const demoFixtures = {
  dataset: demoDataset,
  datasetList: [demoDataset],
  preview: demoPreview,
  project: DEMO_PROJECT,
  projectList: [DEMO_PROJECT],
  me: DEMO_ME,
  version: demoVersion,
  versionList: [demoVersion],
  columnsMeta: demoColumnsMeta,
  datasetTarget: { target_column: "target" },
  prepConfig: null as Record<string, unknown> | null,
  capabilities: demoCapabilities,
  profile: demoProfile,
  recommendation: demoRecommendation,
  trainingSessions: [] as unknown[],
  overview: demoOverview,
  profileOut: demoProfileOut,
  correlation: demoCorrelation,
  histogram: demoHistogram,
  valueCounts: demoValueCounts,
  aggregate: demoAggregate,
  operations: demoOperations,
  session: demoSession,
  savedModels: demoSavedModels,
  activeModel: demoActiveModel,
  predictionResponse: demoPredictionResponseRaw,
  predictionResponseMapped: demoPredictionResponseMapped,
  predictionExplainResponse: demoPredictionExplainRaw,
};

/** File fixtures usable by the `uploadDemoFile` step. */
export const fileFixtures: Record<string, { name: string; content: string; type: string }> = {
  "cardio-csv": {
    name: "cardio_demo.csv",
    content: DEMO_DATASET_CSV,
    type: "text/csv",
  },
};
