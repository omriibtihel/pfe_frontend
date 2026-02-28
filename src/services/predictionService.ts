import apiClient from './apiClient';
import type { ActiveModelInfo, PredictionResponse } from '@/types';

const base = (projectId: string) => `/projects/${projectId}/training`;

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
};

// ─────────────────────────────────────────────────────────────────────────────
// Response mappers (snake_case → camelCase)
// ─────────────────────────────────────────────────────────────────────────────

function _mapActiveModel(raw: Record<string, unknown>): ActiveModelInfo {
  return {
    modelId: raw['modelId'] as number,
    sessionId: raw['sessionId'] as number,
    modelType: raw['modelType'] as string,
    taskType: raw['taskType'] as 'classification' | 'regression',
    featureNames: (raw['featureNames'] as string[]) ?? [],
    threshold: (raw['threshold'] as number) ?? 0.5,
    trainedAt: raw['trainedAt'] as string,
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
    };
  });

  const summary = (raw['summary'] as Record<string, unknown>) ?? {};

  return {
    modelId: raw['model_id'] as number,
    sessionId: raw['session_id'] as number,
    modelType: raw['model_type'] as string,
    taskType: raw['task_type'] as string,
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
