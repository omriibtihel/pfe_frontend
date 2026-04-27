import apiClient from './apiClient';
import type { ActiveModelInfo, PredictionResponse, SavedModelSummary } from '@/types';

const base = (projectId: string) => `/projects/${projectId}/training`;

function _toString(value: unknown): string {
  return String(value ?? '').trim();
}

export const predictionService = {
  /**
   * Get the project's currently active (saved) model info.
   * Throws if no model has been saved yet (backend returns 404).
   */
  async getActiveModel(projectId: string): Promise<ActiveModelInfo> {
    const raw = await apiClient.get<Record<string, unknown>>(
      `${base(projectId)}/active-model`,
    );
    return _mapActiveModel(raw);
  },

  /**
   * Return all saved models for the project (used by the prediction dropdown).
   */
  async getSavedModels(projectId: string): Promise<SavedModelSummary[]> {
    const raw = await apiClient.get<Record<string, unknown>[]>(
      `${base(projectId)}/saved-models`,
    );
    return raw.map(_mapSavedModel);
  },

  /**
   * Run inference using the active model on an uploaded file (CSV/JSON/Parquet).
   */
  async predictWithFile(projectId: string, file: File): Promise<PredictionResponse> {
    const form = new FormData();
    form.append('file', file);
    const raw = await apiClient.postFormData<Record<string, unknown>>(
      `${base(projectId)}/predict`,
      form,
    );
    return _mapPredictionResponse(raw);
  },

  /**
   * Run inference using a specific saved model on an uploaded file.
   */
  async predictWithSavedModel(projectId: string, modelId: string | number, file: File): Promise<PredictionResponse> {
    const form = new FormData();
    form.append('file', file);
    const raw = await apiClient.postFormData<Record<string, unknown>>(
      `${base(projectId)}/models/${encodeURIComponent(String(modelId))}/predict`,
      form,
    );
    return _mapPredictionResponse(raw);
  },

  /**
   * Run inference using the active model on manually-entered rows (JSON).
   */
  async predictManual(
    projectId: string,
    rows: Record<string, unknown>[],
  ): Promise<PredictionResponse> {
    const raw = await apiClient.postJson<Record<string, unknown>>(
      `${base(projectId)}/predict/json`,
      { rows },
    );
    return _mapPredictionResponse(raw);
  },

  /**
   * Run inference using a specific saved model on manually-entered rows (JSON).
   */
  async predictManualWithSavedModel(
    projectId: string,
    modelId: string | number,
    rows: Record<string, unknown>[],
  ): Promise<PredictionResponse> {
    const raw = await apiClient.postJson<Record<string, unknown>>(
      `${base(projectId)}/models/${encodeURIComponent(String(modelId))}/predict/json`,
      { rows },
    );
    return _mapPredictionResponse(raw);
  },

  /**
   * Run inference with local SHAP explanations (manual rows, saved model).
   * Each row in the response includes a "shap" key with per-feature contributions.
   */
  async predictManualWithSavedModelExplain(
    projectId: string,
    modelId: string | number,
    rows: Record<string, unknown>[],
  ): Promise<PredictionResponse> {
    const raw = await apiClient.postJson<Record<string, unknown>>(
      `${base(projectId)}/models/${encodeURIComponent(String(modelId))}/predict/json/explain`,
      { rows },
    );
    return _mapPredictionResponse(raw);
  },

  /**
   * Export already-computed prediction rows as a CSV file (server-side formatting).
   * No re-inference: just converts the rows returned by any /predict endpoint.
   */
  async exportResultsCsv(
    projectId: string,
    modelId: string | number,
    modelType: string,
    rows: import('@/types').PredictionRow[],
  ): Promise<{ blob: Blob; filename?: string }> {
    const payload = {
      model_type: modelType,
      rows: rows.map((r) => ({
        row_index: r.rowIndex,
        prediction: r.prediction,
        score: r.score ?? null,
        input_data: r.inputData,
      })),
    };
    return apiClient.postJsonBlob(
      `${base(projectId)}/models/${encodeURIComponent(String(modelId))}/predict/results/export`,
      payload,
    );
  },

  /**
   * Run inference and download results as a CSV file.
   * Returns a Blob that can be directly passed to URL.createObjectURL().
   */
  async exportCsv(
    projectId: string,
    file: File,
  ): Promise<{ blob: Blob; filename?: string }> {
    const form = new FormData();
    form.append('file', file);
    return apiClient.postFormDataBlob(
      `${base(projectId)}/predict/export`,
      form,
    );
  },

  /**
   * Run inference using a specific saved model and download as CSV.
   */
  async exportCsvWithSavedModel(
    projectId: string,
    modelId: string | number,
    file: File,
  ): Promise<{ blob: Blob; filename?: string }> {
    const form = new FormData();
    form.append('file', file);
    return apiClient.postFormDataBlob(
      `${base(projectId)}/models/${encodeURIComponent(String(modelId))}/predict/export`,
      form,
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Response mappers (snake_case → camelCase)
// ─────────────────────────────────────────────────────────────────────────────

function _mapActiveModel(raw: Record<string, unknown>): ActiveModelInfo {
  return {
    modelId: (raw['modelId'] as number) ?? (raw['model_id'] as number),
    sessionId: (raw['sessionId'] as number) ?? (raw['session_id'] as number),
    modelType: (raw['modelType'] as string) ?? (raw['model_type'] as string),
    taskType:
      ((raw['taskType'] as 'classification' | 'regression') ??
        (raw['task_type'] as 'classification' | 'regression')) ??
      'classification',
    featureNames: ((raw['featureNames'] ?? raw['feature_names']) as string[]) ?? [],
    threshold: (raw['threshold'] as number) ?? 0.5,
    trainedAt: String(raw['trainedAt'] ?? raw['trained_at'] ?? ''),
  };
}

function _mapSavedModel(raw: Record<string, unknown>, index: number): SavedModelSummary {
  const sessionId = _toString(raw['sessionId'] ?? raw['session_id']);
  const modelType = _toString(raw['modelType'] ?? raw['model_type']);
  const trainedAt = _toString(raw['trainedAt'] ?? raw['trained_at']);
  const rawId = _toString(raw['id'] ?? raw['modelId'] ?? raw['model_id'] ?? raw['saved_model_id']);
  const id = rawId || [sessionId || 'session', modelType || 'model', trainedAt || String(index)].join(':');

  return {
    id,
    modelType,
    taskType:
      ((raw['taskType'] as 'classification' | 'regression') ??
        (raw['task_type'] as 'classification' | 'regression')) ??
      'classification',
    sessionId,
    datasetVersionId:
      raw['datasetVersionId'] != null
        ? String(raw['datasetVersionId'])
        : raw['dataset_version_id'] != null
          ? String(raw['dataset_version_id'])
          : null,
    datasetVersionName:
      raw['datasetVersionName'] != null
        ? String(raw['datasetVersionName'])
        : raw['dataset_version_name'] != null
          ? String(raw['dataset_version_name'])
          : null,
    isActive: Boolean(raw['isActive'] ?? raw['is_active']),
    isSaved: Boolean(raw['isSaved'] ?? raw['is_saved'] ?? true),
    featureNames: ((raw['featureNames'] ?? raw['feature_names']) as string[]) ?? [],
    threshold: (raw['threshold'] as number) ?? 0.5,
    trainedAt,
    testScore:
      raw['testScore'] != null
        ? (raw['testScore'] as number)
        : raw['test_score'] != null
          ? (raw['test_score'] as number)
          : null,
    primaryMetric: (() => {
      const pm = raw['primaryMetric'] ?? raw['primary_metric'];
      if (pm != null && typeof pm === 'object') return pm as import('@/types/training/results').PrimaryMetric;
      return null;
    })(),
    trainingTime:
      raw['trainingTime'] != null
        ? (raw['trainingTime'] as number)
        : raw['training_time'] != null
          ? (raw['training_time'] as number)
          : undefined,
  };
}

function _mapPredictionResponse(raw: Record<string, unknown>): PredictionResponse {
  const rows = ((raw['rows'] as unknown[]) ?? []).map((r: unknown) => {
    const row = r as Record<string, unknown>;
    return {
      rowIndex: row['row_index'] as number,
      prediction: row['prediction'] as string | number,
      score: row['score'] != null ? (row['score'] as number) : null,
      inputData: (row['input_data'] as Record<string, unknown>) ?? {},
      shap: row['shap'] != null ? (row['shap'] as import('@/types').ShapLocalItem[]) : undefined,
    };
  });

  const summary = (raw['summary'] as Record<string, unknown>) ?? {};

  return {
    modelId: raw['model_id'] as number,
    sessionId: raw['session_id'] as number,
    modelType: raw['model_type'] as string,
    taskType: raw['task_type'] as 'classification' | 'regression',
    timestamp: raw['timestamp'] as string,
    nRows: raw['n_rows'] as number,
    featureCountReceived: raw['feature_count_received'] as number,
    featureCountExpected: raw['feature_count_expected'] as number | null,
    featureNamesExpected: (raw['feature_names_expected'] as string[]) ?? [],
    thresholdUsed: (raw['threshold_used'] as number) ?? 0.5,
    rows,
    summary: {
      classDistribution:
        (summary['class_distribution'] as Record<string, number> | null) ?? null,
      avgScore: summary['avg_score'] != null ? (summary['avg_score'] as number) : null,
      mean: summary['mean'] as number | undefined,
      min: summary['min'] as number | undefined,
      max: summary['max'] as number | undefined,
      std: summary['std'] as number | undefined,
    },
  };
}

export default predictionService;
