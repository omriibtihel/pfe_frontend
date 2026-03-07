import apiClient, { type RequestOptions } from "@/services/apiClient";
import type {
  TrainingBalanceAnalysis,
  TrainingBalancingConfig,
  TrainingBalancingStrategy,
  CategoricalEncodingStrategy,
  CategoricalImputationStrategy,
  ModelHyperparams,
  ModelResult,
  NumericImputationStrategy,
  NumericScalingStrategy,
  TrainingThresholdStrategy,
  TrainingHyperparamFieldSchema,
  TrainingColumnType,
  TrainingConfig,
  TrainingPreprocessingConfig,
  TrainingPreprocessingDefaults,
  TrainingSession,
  TrainingValidationPreviewSubset,
  TrainingValidationPreviewMode,
  SavedModelSummary,
} from "@/types";
export type { TrainingValidationPreviewSubset, TrainingValidationPreviewMode };
import {
  DEFAULT_TRAINING_BALANCING,
  DEFAULT_TRAINING_PREPROCESSING,
  DEFAULT_TRAINING_PREPROCESSING_DEFAULTS,
} from "@/types";

export type { TrainingSession, ModelResult };

type SaveModelResponse = {
  success: boolean;
  message?: string;
  isNowActive?: boolean;
  modelId?: string | number;
  previousActiveModelId?: string | number | null;
};

type RawRecord = Record<string, unknown>;

function _toSaveModelResponse(raw: RawRecord): SaveModelResponse {
  return {
    success: Boolean(raw["success"]),
    message: raw["message"] != null ? String(raw["message"]) : undefined,
    isNowActive: Boolean(raw["isNowActive"] ?? raw["is_now_active"]),
    modelId: (raw["modelId"] ?? raw["model_id"]) as string | number | undefined,
    previousActiveModelId: (raw["previousActiveModelId"] ?? raw["previous_active_model_id"]) as
      | string
      | number
      | null
      | undefined,
  };
}

function _toSavedModelSummary(raw: RawRecord): SavedModelSummary {
  return {
    id: String(raw["id"] ?? raw["modelId"] ?? raw["model_id"] ?? ""),
    modelType: String(raw["modelType"] ?? raw["model_type"] ?? ""),
    taskType:
      (raw["taskType"] as "classification" | "regression") ??
      (raw["task_type"] as "classification" | "regression") ??
      "classification",
    sessionId: String(raw["sessionId"] ?? raw["session_id"] ?? ""),
    datasetVersionId:
      raw["datasetVersionId"] != null
        ? String(raw["datasetVersionId"])
        : raw["dataset_version_id"] != null
          ? String(raw["dataset_version_id"])
          : null,
    datasetVersionName:
      raw["datasetVersionName"] != null
        ? String(raw["datasetVersionName"])
        : raw["dataset_version_name"] != null
          ? String(raw["dataset_version_name"])
          : null,
    isActive: Boolean(raw["isActive"] ?? raw["is_active"]),
    isSaved: Boolean(raw["isSaved"] ?? raw["is_saved"]),
    featureNames:
      ((raw["featureNames"] ?? raw["feature_names"]) as string[] | undefined) ?? [],
    threshold: (raw["threshold"] as number) ?? 0.5,
    trainedAt: String(raw["trainedAt"] ?? raw["trained_at"] ?? ""),
    testScore:
      raw["testScore"] != null
        ? (raw["testScore"] as number)
        : raw["test_score"] != null
          ? (raw["test_score"] as number)
          : undefined,
    primaryMetric:
      raw["primaryMetric"] != null
        ? String(raw["primaryMetric"])
        : raw["primary_metric"] != null
          ? String(raw["primary_metric"])
          : null,
    trainingTime:
      raw["trainingTime"] != null
        ? (raw["trainingTime"] as number)
        : raw["training_time"] != null
          ? (raw["training_time"] as number)
          : undefined,
  };
}

export type TrainingPreprocessingCapabilities = {
  numericImputation: NumericImputationStrategy[];
  numericScaling: NumericScalingStrategy[];
  categoricalImputation: CategoricalImputationStrategy[];
  categoricalEncoding: CategoricalEncodingStrategy[];
  defaults: TrainingPreprocessingDefaults;
  supportsPerColumn: boolean;
  columnTypes: TrainingColumnType[];
};

export type TrainingCapabilities = {
  engine?: string;
  preprocessingCapabilities: TrainingPreprocessingCapabilities;
  preprocessingExecution?: {
    stage?: string;
    requiresSplit?: boolean;
    fitOn?: string;
    transformOn?: string[];
    antiLeakage?: boolean;
  };
  supportedSplitMethods?: TrainingConfig["splitMethod"][];
  availableModels?: Array<{
    key?: string;
    name: string;
    label?: string;
    aliases?: string[];
    tasks?: string[];
    installed: boolean;
  }>;
  modelHyperparamsSchema?: Record<string, Record<string, TrainingHyperparamFieldSchema>>;
  availableMetrics?: {
    classification?: string[];
    regression?: string[];
  };
  balancingCapabilities?: {
    strategies?: TrainingBalancingStrategy[];
    thresholdStrategies?: TrainingThresholdStrategy[];
    requiresExplicitConfirmation?: boolean;
  };
};

export type TrainingValidationResponse = {
  normalized_config: Record<string, unknown>;
  effective_preprocessing_by_column: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  error_details?: TrainingValidationIssueDetail[];
  previewTransformed?: TrainingValidationPreviewTable;
  previewMeta?: TrainingValidationPreviewMeta;
};

export type TrainingValidationPreviewRequest = {
  subset?: TrainingValidationPreviewSubset;
  mode?: TrainingValidationPreviewMode;
  n?: number;
  seed?: number;
};

export type TrainingValidationPreviewTable = {
  columns: string[];
  rows: unknown[][];
};

export type TrainingValidationPreviewMeta = {
  fittedOn: "train";
  subset: TrainingValidationPreviewSubset;
  mode: TrainingValidationPreviewMode;
  n: number;
  splitSeed: number;
  fromCache: boolean;
  trainSize: number;
  valSize: number;
  testSize: number;
};

export type ValidateTrainingOptions = RequestOptions & {
  include?: {
    preview?: boolean;
  };
  preview?: TrainingValidationPreviewRequest;
};

export type TrainingValidationIssueDetail = {
  column?: string | null;
  model?: string | null;
  severity?: "error" | "warning" | string;
  code?: string;
  message?: string;
};

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
  metrics: string[];
  positiveLabel?: string | number | null;
  debug?: boolean;
  trainingDebug?: boolean;
  preprocessing: TrainingPreprocessingConfig;
  modelHyperparams: ModelHyperparams;
  customCode: string;
};

export type AnalyzeBalancePayload = {
  version_id: number;
  target_column: string;
};

export const FALLBACK_PREPROCESSING_CAPABILITIES: TrainingPreprocessingCapabilities = {
  numericImputation: ["none", "median", "mean", "most_frequent", "constant", "knn"],
  numericScaling: ["none", "standard", "minmax", "robust", "maxabs"],
  categoricalImputation: ["none", "most_frequent", "constant"],
  categoricalEncoding: ["none", "onehot", "ordinal", "label"],
  defaults: { ...DEFAULT_TRAINING_PREPROCESSING_DEFAULTS },
  supportsPerColumn: true,
  columnTypes: ["numeric", "categorical", "ordinal"],
};

function normalizeVersionId(versionId: string): string {
  return String(versionId ?? "").trim();
}

function toUniqueStringList(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const value of values) {
    const item = String(value ?? "").trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

function sanitizeEnumList<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const out: T[] = [];
  for (const value of values) {
    const typed = value as T;
    if (allowed.includes(typed) && !out.includes(typed)) out.push(typed);
  }
  return out;
}

function sanitizeColumnTypes(values: string[]): TrainingColumnType[] {
  return sanitizeEnumList(values, ["numeric", "categorical", "ordinal"]);
}

function toPreprocessingCapabilities(raw: unknown): TrainingPreprocessingCapabilities {
  const fallback = FALLBACK_PREPROCESSING_CAPABILITIES;
  const src = (raw ?? {}) as Record<string, unknown>;

  const flatPresent = [
    "numericImputation",
    "numericScaling",
    "categoricalImputation",
    "categoricalEncoding",
  ].every((key) => key in src);

  if (flatPresent) {
    const numericImputation = sanitizeEnumList(
      toUniqueStringList(src.numericImputation),
      fallback.numericImputation
    );
    const numericScaling = sanitizeEnumList(toUniqueStringList(src.numericScaling), fallback.numericScaling);
    const categoricalImputation = sanitizeEnumList(
      toUniqueStringList(src.categoricalImputation),
      fallback.categoricalImputation
    );
    const categoricalEncoding = sanitizeEnumList(
      toUniqueStringList(src.categoricalEncoding),
      fallback.categoricalEncoding
    );
    const defaultsRawTyped = (src.defaults ?? {}) as Partial<TrainingPreprocessingDefaults>;
    const rawSupportsPerColumn = src.supportsPerColumn;
    const columnTypes = sanitizeColumnTypes(toUniqueStringList(src.columnTypes));

    return {
      numericImputation: numericImputation.length ? numericImputation : fallback.numericImputation,
      numericScaling: numericScaling.length ? numericScaling : fallback.numericScaling,
      categoricalImputation: categoricalImputation.length
        ? categoricalImputation
        : fallback.categoricalImputation,
      categoricalEncoding: categoricalEncoding.length ? categoricalEncoding : fallback.categoricalEncoding,
      defaults: {
        numericImputation: fallback.numericImputation.includes(
          defaultsRawTyped.numericImputation as TrainingPreprocessingDefaults["numericImputation"]
        )
          ? (defaultsRawTyped.numericImputation as TrainingPreprocessingDefaults["numericImputation"])
          : fallback.defaults.numericImputation,
        numericScaling: fallback.numericScaling.includes(
          defaultsRawTyped.numericScaling as TrainingPreprocessingDefaults["numericScaling"]
        )
          ? (defaultsRawTyped.numericScaling as TrainingPreprocessingDefaults["numericScaling"])
          : fallback.defaults.numericScaling,
        categoricalImputation: fallback.categoricalImputation.includes(
          defaultsRawTyped.categoricalImputation as TrainingPreprocessingDefaults["categoricalImputation"]
        )
          ? (defaultsRawTyped.categoricalImputation as TrainingPreprocessingDefaults["categoricalImputation"])
          : fallback.defaults.categoricalImputation,
        categoricalEncoding: fallback.categoricalEncoding.includes(
          defaultsRawTyped.categoricalEncoding as TrainingPreprocessingDefaults["categoricalEncoding"]
        )
          ? (defaultsRawTyped.categoricalEncoding as TrainingPreprocessingDefaults["categoricalEncoding"])
          : fallback.defaults.categoricalEncoding,
      },
      supportsPerColumn:
        typeof rawSupportsPerColumn === "boolean" ? rawSupportsPerColumn : fallback.supportsPerColumn,
      columnTypes: columnTypes.length ? columnTypes : fallback.columnTypes,
    };
  }

  // Legacy backend shape support.
  const legacy = src as {
    imputation?: { numeric?: unknown; categorical?: unknown };
    encoding?: { categorical?: unknown };
    scaling?: { numeric?: unknown };
  };
  const impNum = toUniqueStringList(legacy.imputation?.numeric);
  const impCat = toUniqueStringList(legacy.imputation?.categorical);
  const encCat = toUniqueStringList(legacy.encoding?.categorical);
  const sclNum = toUniqueStringList(legacy.scaling?.numeric);

  return {
    numericImputation: sanitizeEnumList(impNum, fallback.numericImputation).length
      ? sanitizeEnumList(impNum, fallback.numericImputation)
      : fallback.numericImputation,
    numericScaling: sanitizeEnumList(sclNum, fallback.numericScaling).length
      ? sanitizeEnumList(sclNum, fallback.numericScaling)
      : fallback.numericScaling,
    categoricalImputation: sanitizeEnumList(impCat, fallback.categoricalImputation).length
      ? sanitizeEnumList(impCat, fallback.categoricalImputation)
      : fallback.categoricalImputation,
    categoricalEncoding: sanitizeEnumList(encCat, fallback.categoricalEncoding).length
      ? sanitizeEnumList(encCat, fallback.categoricalEncoding)
      : fallback.categoricalEncoding,
    defaults: { ...fallback.defaults },
    supportsPerColumn: fallback.supportsPerColumn,
    columnTypes: [...fallback.columnTypes],
  };
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
    metrics: [...(config.metrics ?? [])].map((m) => String(m).trim()).filter(Boolean),
    positiveLabel: config.positiveLabel ?? undefined,
    debug: Boolean(config.trainingDebug),
    trainingDebug: Boolean(config.trainingDebug),
    preprocessing,
    modelHyperparams,
    customCode: config.customCode ?? "",
  };
}

function assertStartConfig(config: TrainingConfig) {
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

export const trainingService = {
  async getCapabilities(projectId: string): Promise<TrainingCapabilities> {
    const raw = await apiClient.get<Record<string, unknown>>(`/projects/${projectId}/training/capabilities`);
    return {
      ...(raw as Omit<TrainingCapabilities, "preprocessingCapabilities">),
      preprocessingCapabilities: toPreprocessingCapabilities(
        raw.preprocessingCapabilities ?? raw.preprocessing
      ),
    };
  },

  async validateTraining(
    projectId: string,
    config: TrainingConfig,
    opts?: ValidateTrainingOptions
  ): Promise<TrainingValidationResponse> {
    const payload: Record<string, unknown> = {
      ...toTrainingStartPayload(config),
    };
    if (opts?.include) payload.include = opts.include;
    if (opts?.preview) payload.preview = opts.preview;
    const requestOptions: RequestOptions | undefined = opts?.signal ? { signal: opts.signal } : undefined;
    return await apiClient.post<TrainingValidationResponse>(
      `/projects/${projectId}/training/validate`,
      payload,
      requestOptions
    );
  },

  async analyzeBalance(
    projectId: string,
    versionId: string | number,
    targetColumn: string,
    opts?: RequestOptions
  ): Promise<TrainingBalanceAnalysis> {
    const payload: AnalyzeBalancePayload = {
      version_id: Number(versionId),
      target_column: String(targetColumn ?? "").trim(),
    };
    return await apiClient.post<TrainingBalanceAnalysis>(
      `/projects/${projectId}/training/analyze-balance`,
      payload,
      opts
    );
  },

  async startTraining(projectId: string, config: TrainingConfig): Promise<TrainingSession> {
    const versionId = assertStartConfig(config);
    const payload = toTrainingStartPayload(config);
    return await apiClient.post<TrainingSession>(
      `/projects/${projectId}/training/versions/${versionId}/sessions`,
      payload
    );
  },

  async getSession(projectId: string, sessionId: string): Promise<TrainingSession> {
    return await apiClient.get<TrainingSession>(`/projects/${projectId}/training/sessions/${sessionId}`);
  },

  async getSessions(projectId: string): Promise<TrainingSession[]> {
    return await apiClient.get<TrainingSession[]>(`/projects/${projectId}/training/sessions`);
  },

  async saveModel(projectId: string, sessionId: string, modelId: string): Promise<SaveModelResponse> {
    const raw = await apiClient.post<RawRecord>(
      `/projects/${projectId}/training/sessions/${sessionId}/models/${encodeURIComponent(modelId)}/save`
    );
    return _toSaveModelResponse(raw);
  },

  async unsaveModel(projectId: string, sessionId: string, modelId: string): Promise<void> {
    await apiClient.delete(
      `/projects/${projectId}/training/sessions/${sessionId}/models/${encodeURIComponent(modelId)}/save`
    );
  },

  async getSavedModels(projectId: string): Promise<SavedModelSummary[]> {
    const raw = await apiClient.get<RawRecord[]>(
      `/projects/${projectId}/training/saved-models`
    );
    return raw.map(_toSavedModelSummary);
  },

  async downloadResults(projectId: string, sessionId: string): Promise<Blob> {
    try {
      const { blob } = await apiClient.getBlob(`/projects/${projectId}/training/sessions/${sessionId}/download`);
      return blob;
    } catch (primaryError) {
      console.warn('downloadResults: primary /download endpoint failed, trying /export fallback', primaryError);
      const { blob } = await apiClient.getBlob(`/projects/${projectId}/training/sessions/${sessionId}/export`);
      return blob;
    }
  },

  async downloadResultsAndSaveToDisk(projectId: string, sessionId: string, filename?: string): Promise<void> {
    const blob = await this.downloadResults(projectId, sessionId);
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename?.trim() || `training_session_${sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
  },
};

export default trainingService;
