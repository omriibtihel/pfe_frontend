// src/services/dataService.ts
import apiClient from "@/services/apiClient";
import { ProcessingOperation, DataVersion } from "@/types";

export type OperationType = "cleaning" | "imputation" | "normalization" | "encoding" | "other";

export type ApplyOperationPayload = {
  type: OperationType;
  description: string;
  columns: string[];
  params?: Record<string, any>;
};

export type ProcessingPreviewOut = {
  shape: { rows: number; cols: number };
  columns: string[];
  dtypes: Record<string, string>;
  rows: Record<string, unknown>[];
  page: number;
  page_size: number;
  total_rows: number;
};

type OperationOut = ProcessingOperation;

// -----------------------------
// Versions (backend /projects/{project_id}/versions)
// -----------------------------
export type DatasetVersionOut = {
  id: number | string;
  project_id?: number | string | null;
  source_dataset_id?: number | string | null;

  name?: string | null;
  file_path?: string | null;

  operations?: string[] | null;

  created_at?: string | null;

  can_predict?: boolean | null;
  canPredict?: boolean | null;
};

export type VersionUI = {
  id: number;
  projectId: number | null;
  sourceDatasetId: number | null;
  name: string;
  filePath?: string | null;
  operations: string[];
  createdAt: string | null;
  canPredict?: boolean;
};

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeVersion(v: DatasetVersionOut): VersionUI {
  const id = toNum(v?.id) ?? 0;

  return {
    id,
    projectId: toNum((v as any)?.project_id),
    sourceDatasetId: toNum((v as any)?.source_dataset_id),
    name: String(v?.name ?? `Version #${id}`),
    filePath: (v as any)?.file_path ?? null,
    operations: Array.isArray(v?.operations) ? (v.operations as string[]) : [],
    createdAt: (v as any)?.created_at ?? null,
    canPredict: Boolean((v as any)?.canPredict ?? (v as any)?.can_predict),
  };
}

function processingBase(projectId: string | number, datasetId: number) {
  return `/projects/${projectId}/datasets/${datasetId}/processing`;
}

function versionsBase(projectId: string | number) {
  return `/projects/${projectId}/versions`;
}

export type SaveProcessedVersionPayload = {
  name?: string;
};

export type SaveProcessedVersionOut =
  | DataVersion
  | {
      id: number;
      version_id?: number;
      name?: string;
      createdAt?: string;
      created_at?: string;
      dataset_id?: number;
      source_dataset_id?: number;
      canPredict?: boolean;
      can_predict?: boolean;
      operations?: string[];
    };

export async function getVersionColumns(projectId: string, versionId: string): Promise<string[]> {
  const res = await apiClient.get<{ columns: string[] }>(
    `/projects/${projectId}/versions/${versionId}/columns`
  );
  return res.columns ?? [];
};

export const dataService = {
  // -------------------------
  // Processing (dataset/workspace)
  // -------------------------
  async getOperations(projectId: string | number, datasetId: number): Promise<OperationOut[]> {
    return apiClient.get<OperationOut[]>(`${processingBase(projectId, datasetId)}/operations`);
  },

  async applyOperation(
    projectId: string | number,
    datasetId: number,
    payload: ApplyOperationPayload
  ): Promise<OperationOut> {
    return apiClient.postJson<OperationOut>(`${processingBase(projectId, datasetId)}/operations`, payload);
  },

  async undoLastOperation(projectId: string | number, datasetId: number): Promise<{ ok: boolean }> {
    return apiClient.postJson<{ ok: boolean }>(`${processingBase(projectId, datasetId)}/undo`, {});
  },

  async getProcessingPreview(
    projectId: string | number,
    datasetId: number,
    page = 1,
    pageSize = 25
  ): Promise<ProcessingPreviewOut> {
    const p = encodeURIComponent(String(page));
    const ps = encodeURIComponent(String(pageSize));
    return apiClient.get<ProcessingPreviewOut>(
      `${processingBase(projectId, datasetId)}/preview?page=${p}&page_size=${ps}`
    );
  },

  async exportProcessed(projectId: string | number, datasetId: number) {
    return apiClient.getBlob(`${processingBase(projectId, datasetId)}/export`);
  },

  async saveProcessedAsVersion(
    projectId: string | number,
    datasetId: number,
    payload: SaveProcessedVersionPayload = {}
  ): Promise<SaveProcessedVersionOut> {
    const base = processingBase(projectId, datasetId);
    return apiClient.postJson<SaveProcessedVersionOut>(`${base}/save`, payload);
  },

  // -------------------------
  // Versions
  // -------------------------
  async getVersions(projectId: string | number): Promise<VersionUI[]> {
    const out = await apiClient.get<DatasetVersionOut[]>(`${versionsBase(projectId)}`);
    const list = Array.isArray(out) ? out.map(normalizeVersion) : [];
    return list.filter((v) => v.id > 0);
  },

async getVersionPreview(
    projectId: string | number,
    versionId: number | string,
    page = 1,
    pageSize = 25
  ): Promise<ProcessingPreviewOut> {
    const vid = toNum(versionId);
    if (!vid) throw new Error("Invalid version id");

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(Math.max(1, Number(pageSize) || 25), 200);

    // ✅ nécessite backend: GET /versions/{version_id}/preview
    return apiClient.get<ProcessingPreviewOut>(
      `${versionsBase(projectId)}/${vid}/preview?page=${p}&page_size=${ps}`
    );
  },

  async downloadVersion(projectId: string | number, versionId: number | string) {
    const vid = toNum(versionId);
    if (!vid) throw new Error("Invalid version id");
    return apiClient.getBlob(`${versionsBase(projectId)}/${vid}/download`);
  },

  async overwriteVersion(
    projectId: string | number,
    versionId: number,
    payload: {
      content_base64: string;
      content_type?: string | null;
      operations?: any[] | null;
    }
  ) {
    return apiClient.postJson(`${versionsBase(projectId)}/${versionId}/overwrite`, payload);
  },

  async deleteVersion(projectId: string | number, versionId: number | string): Promise<void> {
    const vid = toNum(versionId);
    if (!vid) throw new Error("Invalid version id");
    await apiClient.delete<unknown>(`${versionsBase(projectId)}/${vid}`);
  },

  // -------------------------
  // ✅ Workspace for version edit
  // -------------------------
  async getOrCreateVersionWorkspace(projectId: string | number, versionId: number) {
    // POST /api/projects/{project_id}/versions/{version_id}/workspace
    return apiClient.postJson<{ workspace_dataset_id: number }>(
      `${versionsBase(projectId)}/${versionId}/workspace`,
      {}
    );
  },

  async commitVersionWorkspace(projectId: string | number, versionId: number, workspaceDatasetId: number) {
    // POST /api/projects/{project_id}/versions/{version_id}/commit-workspace
    return apiClient.postJson<{ ok: boolean }>(`${versionsBase(projectId)}/${versionId}/commit-workspace`, {
      workspace_dataset_id: workspaceDatasetId,
    });
  },

  async closeVersionWorkspace(projectId: string | number, versionId: number) {
    // DELETE /api/projects/{project_id}/versions/{version_id}/workspace
    return apiClient.delete<{ ok: boolean }>(`${versionsBase(projectId)}/${versionId}/workspace`);
  },
};

export default dataService;
