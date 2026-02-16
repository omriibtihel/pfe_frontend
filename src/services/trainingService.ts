// src/services/trainingService.ts
import apiClient from "@/services/apiClient";
import type { TrainingConfig } from "@/types";

/**
 * API routes (backend):
 * - POST   /projects/:projectId/training/versions/:versionId/sessions
 * - GET    /projects/:projectId/training/sessions/:sessionId
 * - GET    /projects/:projectId/training/sessions
 * - POST   /projects/:projectId/training/sessions/:sessionId/models/:modelId/save
 * - GET    /projects/:projectId/training/sessions/:sessionId/download  (blob)
 */

export type ModelMetrics = Record<string, number>;

export type SplitInfo = {
  method?: "holdout" | "kfold";
  train_rows?: number;
  val_rows?: number;
  test_rows?: number;
  folds?: number;
  rows?: number;
  [k: string]: any;
};

export type FeatureImportanceItem = { feature: string; importance: number };

export type ClassDistribution = {
  all?: Record<string, number>;
  train?: Record<string, number>;
  val?: Record<string, number>;
  test?: Record<string, number>;
};

export type BaselineMajority = {
  majority_label?: string;
  majority_support_train?: number;
  train_size?: number;
  eval_size?: number;
  metrics?: Record<string, number>;
};

export type ThresholdingInfo = {
  enabled?: boolean;
  reason?: string;
  threshold?: number;
  val_source?: "user_val" | "inner_val_from_train" | string;
  score_kind?: "proba" | "score" | "hard" | string;
  val_precision_pos?: number;
  val_recall_pos?: number;
  val_f1_pos?: number;
  [k: string]: any;
};

export type ModelResult = {
  id: string;
  modelType: string;
  status: string;

  metrics: ModelMetrics;

  trainScore: number;
  testScore: number;

  primaryMetric?: string | null;
  splitInfo?: SplitInfo | null;

  gridSearch?: {
    enabled?: boolean;
    cvBestScore?: number | null;
    cvScoring?: string | null;
    bestParams?: Record<string, any> | null;
    cvSplits?: number | null;
  } | null;

  featureImportance: FeatureImportanceItem[];
  confusionMatrix: number[][];

  // ✅ Step 1 visibility
  classDistribution?: ClassDistribution | null;
  baselineMajority?: BaselineMajority | null;

  // ✅ new: thresholding
  thresholding?: ThresholdingInfo | null;

  trainingTime: number;
};

export type TrainingSession = {
  id: string;
  projectId: string;
  datasetVersionId: string | null;
  status: string;
  progress: number;
  errorMessage: string | null;
  config: any;

  results: ModelResult[];

  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
};

function trainingBase(projectId: string) {
  return `/projects/${projectId}/training`;
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const trainingService = {
  async startTraining(projectId: string, versionId: string, config: TrainingConfig): Promise<TrainingSession> {
    return apiClient.post<TrainingSession>(`${trainingBase(projectId)}/versions/${versionId}/sessions`, config);
  },

  async getSession(projectId: string, sessionId: string): Promise<any> {
    // keep any because backend may return "future format"
    return apiClient.get<any>(`${trainingBase(projectId)}/sessions/${sessionId}`);
  },

  async getSessions(projectId: string): Promise<TrainingSession[]> {
    return apiClient.get<TrainingSession[]>(`${trainingBase(projectId)}/sessions`);
  },

  async saveModel(projectId: string, sessionId: string, modelId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(
      `${trainingBase(projectId)}/sessions/${sessionId}/models/${modelId}/save`
    );
  },

  async downloadResults(projectId: string, sessionId: string): Promise<Blob> {
    const { blob } = await apiClient.getBlob(`${trainingBase(projectId)}/sessions/${sessionId}/download`);
    return blob;
  },

  async downloadResultsAndSaveToDisk(projectId: string, sessionId: string) {
    const { blob, filename } = await apiClient.getBlob(`${trainingBase(projectId)}/sessions/${sessionId}/download`);
    triggerBrowserDownload(blob, filename ?? `training_session_${sessionId}.json`);
  },
};

export default trainingService;
