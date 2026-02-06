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

export type ModelResult = {
  id: string;
  modelType: string;
  status: string; // "completed" | ...
  metrics: ModelMetrics;
  trainScore: number;
  testScore: number;
  featureImportance: any[];
  confusionMatrix: any[];
  trainingTime: number;
};

export type TrainingSession = {
  id: string;
  projectId: string;
  datasetVersionId: string;
  status: string; // "running" | "succeeded" | "failed"
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
    return apiClient.post<TrainingSession>(
      `${trainingBase(projectId)}/versions/${versionId}/sessions`,
      config
    );
  },

  async getSession(projectId: string, sessionId: string): Promise<TrainingSession> {
    return apiClient.get<TrainingSession>(`${trainingBase(projectId)}/sessions/${sessionId}`);
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
