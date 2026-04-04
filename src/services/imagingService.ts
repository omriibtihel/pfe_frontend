import apiClient from "@/services/apiClient";
import type {
  ImagingConfig,
  ImagingModelResult,
  ImagingPredictionResult,
  ImagingSession,
  ImageListResponse,
  ImagingCapabilities,
} from "@/types/imaging";

const BASE = (projectId: string | number) =>
  `/projects/${projectId}/imaging`;

// ── Images ────────────────────────────────────────────────────────────────────

async function uploadImages(
  projectId: string | number,
  className: string,
  files: File[]
): Promise<{ uploaded: number; skipped: number; class_name: string }> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return apiClient.postMultipart(
    `${BASE(projectId)}/upload?class_name=${encodeURIComponent(className)}`,
    form,
  );
}

async function listImages(
  projectId: string | number
): Promise<ImageListResponse> {
  return apiClient.get(`${BASE(projectId)}/images`);
}

async function deleteImageClass(
  projectId: string | number,
  className: string
): Promise<void> {
  return apiClient.delete(
    `${BASE(projectId)}/images/${encodeURIComponent(className)}`
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────

async function startSession(
  projectId: string | number,
  config: ImagingConfig
): Promise<ImagingSession> {
  return apiClient.postJson(`${BASE(projectId)}/sessions`, config);
}

async function listSessions(
  projectId: string | number
): Promise<ImagingSession[]> {
  return apiClient.get(`${BASE(projectId)}/sessions`);
}

async function getSession(
  projectId: string | number,
  sessionId: number
): Promise<ImagingSession> {
  return apiClient.get(`${BASE(projectId)}/sessions/${sessionId}`);
}

async function deleteSession(
  projectId: string | number,
  sessionId: number
): Promise<void> {
  return apiClient.delete(`${BASE(projectId)}/sessions/${sessionId}`);
}

// ── SSE Events ────────────────────────────────────────────────────────────────

function subscribeEvents(
  projectId: string | number,
  sessionId: number,
  lastSeq = -1
): EventSource {
  const token = localStorage.getItem("auth_token") ?? "";
  const url = `http://127.0.0.1:8000/api/projects/${projectId}/imaging/sessions/${sessionId}/events?last_seq=${lastSeq}`;
  return new EventSource(url + (token ? `&token=${token}` : ""));
}

// ── Modèles ───────────────────────────────────────────────────────────────────

async function saveModel(
  projectId: string | number,
  sessionId: number,
  modelId: number
): Promise<ImagingModelResult> {
  return apiClient.patch(
    `${BASE(projectId)}/sessions/${sessionId}/models/${modelId}/save`,
    {}
  );
}

async function unsaveModel(
  projectId: string | number,
  sessionId: number,
  modelId: number
): Promise<ImagingModelResult> {
  return apiClient.patch(
    `${BASE(projectId)}/sessions/${sessionId}/models/${modelId}/unsave`,
    {}
  );
}

// ── Prédiction ────────────────────────────────────────────────────────────────

async function listSavedModels(
  projectId: string | number
): Promise<ImagingModelResult[]> {
  return apiClient.get(`${BASE(projectId)}/models/saved`);
}

async function predictImage(
  projectId: string | number,
  modelId: number,
  imageFile: File
): Promise<ImagingPredictionResult> {
  const form = new FormData();
  form.append("file", imageFile);
  return apiClient.postMultipart(
    `${BASE(projectId)}/predict?model_id=${modelId}`,
    form,
    { timeout: 120_000 }, // first call loads model from disk — allow up to 2 min
  );
}

// ── Capacités ─────────────────────────────────────────────────────────────────

async function getCapabilities(
  projectId: string | number
): Promise<ImagingCapabilities> {
  return apiClient.get(`${BASE(projectId)}/capabilities`);
}

export const imagingService = {
  uploadImages,
  listImages,
  deleteImageClass,
  startSession,
  listSessions,
  getSession,
  deleteSession,
  subscribeEvents,
  saveModel,
  unsaveModel,
  listSavedModels,
  predictImage,
  getCapabilities,
};
