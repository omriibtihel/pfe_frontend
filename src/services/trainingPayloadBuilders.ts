import type {
  AutoMLConfig,
  FeatureEngineeringConfig,
  TrainingBalancingConfig,
  TrainingBalancingStrategy,
  TrainingConfig,
  TrainingPreprocessingConfig,
  TrainingThresholdStrategy,
  ModelHyperparams,
} from "@/types";
import {
  DEFAULT_TRAINING_BALANCING,
  DEFAULT_TRAINING_PREPROCESSING,
} from "@/types";

// ── Payload types ─────────────────────────────────────────────────────────────

export type TrainingStartPayload = {
  datasetVersionId: number;
  targetColumn: string;
  taskType: TrainingConfig["taskType"];
  models: string[];
  searchType: string;
  nIterRandomSearch: number;
  useGridSearch: boolean;  // backward compat
  gridCvFolds: number;
  gridScoring: string;
  useSmote: boolean;
  balancing: {
    strategy: TrainingBalancingStrategy;
    apply_threshold: boolean;
    threshold_strategy: TrainingThresholdStrategy;
    min_recall_constraint?: number | null;
  };
  splitMethod: TrainingConfig["splitMethod"];
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  kFolds: number;
  shuffle?: boolean;
  nRepeats?: number;
  groupColumn?: string;
  metrics: string[];
  positiveLabel?: string | number | null;
  preprocessing: TrainingPreprocessingConfig;
  modelHyperparams: ModelHyperparams;
  customCode: string;
  featureEngineering: FeatureEngineeringConfig;
};

export type AutoMLStartPayload = {
  datasetVersionId: number;
  targetColumn: string;
  taskType: AutoMLConfig["taskType"];
  timeBudget: number;
  metric: string | null;
  testRatio: number;
  positiveLabel: string | number | null;
};

// ── Private helpers ───────────────────────────────────────────────────────────

function normalizeVersionId(versionId: string): string {
  return String(versionId ?? "").trim();
}

function clonePreprocessing(preprocessing: TrainingPreprocessingConfig | null | undefined): TrainingPreprocessingConfig {
  if (!preprocessing) {
    return {
      defaults: { ...DEFAULT_TRAINING_PREPROCESSING.defaults },
      columns: {},
    };
  }

  const defaults = {
    ...DEFAULT_TRAINING_PREPROCESSING.defaults,
    ...(preprocessing.defaults ?? {}),
  };
  const columnsSource = preprocessing.columns ?? {};
  const columns = Object.fromEntries(
    Object.entries(columnsSource).map(([column, cfg]) => [
      String(column),
      {
        ...(cfg ?? {}),
        ...(Array.isArray(cfg?.ordinalOrder) ? { ordinalOrder: [...cfg.ordinalOrder] } : {}),
      },
    ])
  );
  return { defaults, columns };
}

function cloneModelHyperparams(modelHyperparams: ModelHyperparams | null | undefined): ModelHyperparams {
  const src = modelHyperparams ?? {};
  const out: ModelHyperparams = {};
  for (const [model, fields] of Object.entries(src)) {
    const modelKey = String(model ?? "").trim();
    if (!modelKey || !fields || typeof fields !== "object") continue;
    const clonedFields: Record<string, string | number | boolean | null | Array<string | number | boolean | null>> = {};
    for (const [field, value] of Object.entries(fields)) {
      const fieldKey = String(field ?? "").trim();
      if (!fieldKey) continue;
      if (Array.isArray(value)) {
        clonedFields[fieldKey] = [...value] as Array<string | number | boolean | null>;
      } else {
        clonedFields[fieldKey] = (value ?? null) as string | number | boolean | null;
      }
    }
    out[modelKey] = clonedFields;
  }
  return out;
}

const BALANCING_STRATEGIES: TrainingBalancingStrategy[] = [
  "none",
  "class_weight",
  "smote",
  "smote_tomek",
  "random_undersampling",
  "threshold_optimization",
];
const THRESHOLD_STRATEGIES: TrainingThresholdStrategy[] = [
  "maximize_f1",
  "maximize_f2",
  "min_recall",
  "precision_recall_balance",
];

function normalizeBalancingConfig(config: TrainingConfig): TrainingBalancingConfig {
  const source: Partial<TrainingBalancingConfig> = config.balancing ?? {};
  const strategyFallback: TrainingBalancingStrategy = config.useSmote ? "smote" : "none";

  const strategy = BALANCING_STRATEGIES.includes(source.strategy as TrainingBalancingStrategy)
    ? (source.strategy as TrainingBalancingStrategy)
    : strategyFallback;
  const thresholdStrategy = THRESHOLD_STRATEGIES.includes(source.thresholdStrategy as TrainingThresholdStrategy)
    ? (source.thresholdStrategy as TrainingThresholdStrategy)
    : DEFAULT_TRAINING_BALANCING.thresholdStrategy;
  const minRecallRaw = source.minRecallConstraint;
  const minRecallConstraint =
    typeof minRecallRaw === "number" && Number.isFinite(minRecallRaw) && minRecallRaw > 0 && minRecallRaw < 1
      ? minRecallRaw
      : null;
  const applyThreshold = Boolean(source.applyThreshold) || strategy === "threshold_optimization";

  return {
    strategy,
    applyThreshold,
    thresholdStrategy,
    minRecallConstraint,
  };
}

function sanitizeFeatureEngineering(
  fe: FeatureEngineeringConfig | null | undefined
): FeatureEngineeringConfig {
  const features = (fe?.features ?? [])
    .map((f) => ({
      name: String(f?.name ?? "").trim(),
      expression: String(f?.expression ?? "").trim(),
      enabled: f?.enabled ?? true,
    }))
    .filter((f) => f.name.length > 0 && f.expression.length > 0);
  return { features };
}

// ── Exported builders ─────────────────────────────────────────────────────────

export function assertStartConfig(config: TrainingConfig): string {
  const versionId = normalizeVersionId(config.datasetVersionId);
  if (!versionId) throw new Error("datasetVersionId manquant (choisis une version de dataset).");
  const versionNum = Number(versionId);
  if (!Number.isFinite(versionNum) || versionNum <= 0) {
    throw new Error("datasetVersionId invalide.");
  }
  if (!String(config.targetColumn ?? "").trim()) throw new Error("targetColumn manquant.");
  if (!Array.isArray(config.models) || !config.models.length) throw new Error("Selectionne au moins un modele.");
  if (!Array.isArray(config.metrics) || !config.metrics.length)
    throw new Error("Selectionne au moins une metrique.");
  return versionId;
}

export function toTrainingStartPayload(config: TrainingConfig): TrainingStartPayload {
  const versionId = Number(String(config.datasetVersionId ?? "").trim());
  const preprocessing = clonePreprocessing(config.preprocessing);
  const modelHyperparams = cloneModelHyperparams(config.modelHyperparams);
  const balancing = normalizeBalancingConfig(config);
  const useSmote = balancing.strategy === "smote" || balancing.strategy === "smote_tomek";
  return {
    datasetVersionId: versionId,
    targetColumn: String(config.targetColumn ?? "").trim(),
    taskType: config.taskType,
    models: [...(config.models ?? [])].map((m) => String(m).trim()).filter(Boolean),
    searchType: config.searchType ?? "none",
    nIterRandomSearch: Number(config.nIterRandomSearch ?? 40),
    useGridSearch: (config.searchType ?? "none") !== "none",  // backward compat
    gridCvFolds: Number(config.gridCvFolds),
    gridScoring: String(config.gridScoring ?? "auto"),
    useSmote,
    balancing: {
      strategy: balancing.strategy,
      apply_threshold: balancing.applyThreshold,
      threshold_strategy: balancing.thresholdStrategy,
      min_recall_constraint: balancing.minRecallConstraint ?? null,
    },
    splitMethod: config.splitMethod,
    trainRatio: Number(config.trainRatio),
    valRatio: Number(config.valRatio),
    testRatio: Number(config.testRatio),
    kFolds: Number(config.kFolds),
    shuffle: config.shuffle ?? true,
    nRepeats: config.nRepeats ?? 3,
    groupColumn: config.groupColumn ?? undefined,
    metrics: [...(config.metrics ?? [])].map((m) => String(m).trim()).filter(Boolean),
    positiveLabel: config.positiveLabel ?? undefined,
    preprocessing,
    modelHyperparams,
    customCode: config.customCode ?? "",
    featureEngineering: sanitizeFeatureEngineering(config.featureEngineering),
  };
}

export function toAutoMLPayload(cfg: AutoMLConfig): AutoMLStartPayload {
  return {
    datasetVersionId: Number(String(cfg.datasetVersionId ?? "").trim()),
    targetColumn: String(cfg.targetColumn ?? "").trim(),
    taskType: cfg.taskType,
    timeBudget: Number(cfg.timeBudget ?? 60),
    metric: cfg.metric ?? null,
    testRatio: Number(cfg.testRatio ?? 0.2),
    positiveLabel: cfg.positiveLabel ?? null,
  };
}
