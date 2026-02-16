// src/services/dataService.ts
import apiClient from "@/services/apiClient";
import type { ProcessingOperation, DataVersion } from "@/types";

/**
 * Processing "Prepare" module should be CLEANING ONLY (avoid leakage).
 * Keep legacy types for older parts of app, but ProcessingPage must use cleaning payload.
 */
export type OperationType = "cleaning" | "imputation" | "normalization" | "encoding" | "other";
export type CleaningOperationType = "cleaning";

export type CleaningAction =
  | "drop_columns"
  | "drop_duplicates"
  | "drop_empty_rows"
  | "rename_columns"
  | "strip_whitespace"
  | "substitute_values";

export type ApplyOperationPayload = {
  type: OperationType;
  description: string;
  columns: string[];
  params?: Record<string, any>;
};

export type ApplyCleaningPayload = {
  type: CleaningOperationType; // "cleaning"
  description: string;
  columns: string[]; // can be [] for drop_duplicates / drop_empty_rows
  params: Record<string, any> & { action: CleaningAction };
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

export type ColumnKind = "numeric" | "categorical" | "datetime" | "boolean" | "text" | "id" | "other";

export type ColumnMeta = {
  name: string;
  dtype: string;
  kind: ColumnKind | string;

  inferred_kind?: ColumnKind | string;
  override_kind?: ColumnKind | string | null;
  confidence?: number;

  missing: number;
  unique: number;
  total: number;
  sample: string[];
};

export type ColumnsMetaOut = {
  columns: ColumnMeta[];
  counts: Record<string, number>;
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

function clampPage(page?: number) {
  const p = Number(page);
  return Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
}

function clampPageSize(pageSize?: number) {
  const ps = Number(pageSize);
  const v = Number.isFinite(ps) && ps > 0 ? Math.floor(ps) : 25;
  return Math.min(Math.max(1, v), 200);
}

export const dataService = {
  // -------------------------
  // Version schema/meta helpers (used in version edit workspace)
  // -------------------------
  async getVersionColumnsMeta(
    projectId: string | number,
    versionId: number | string,
    workspaceDatasetId?: number | null
  ): Promise<ColumnsMetaOut> {
    const qs = workspaceDatasetId ? `?workspace_dataset_id=${encodeURIComponent(String(workspaceDatasetId))}` : "";
    return apiClient.get<ColumnsMetaOut>(`/projects/${projectId}/versions/${versionId}/columns-meta${qs}`);
  },

  async saveVersionColumnKinds(
    projectId: string | number,
    versionId: number | string,
    overrides: Record<string, string | null>
  ): Promise<{ ok: boolean }> {
    return apiClient.postJson<{ ok: boolean }>(`/projects/${projectId}/versions/${versionId}/column-kinds`, {
      overrides,
    });
  },

  // -------------------------
  // Processing (dataset/workspace)
  // -------------------------
  async getOperations(projectId: string | number, datasetId: number): Promise<OperationOut[]> {
    return apiClient.get<OperationOut[]>(`${processingBase(projectId, datasetId)}/operations`);
  },

  /**
   * Legacy method (kept).
   */
  async applyOperation(projectId: string | number, datasetId: number, payload: ApplyOperationPayload): Promise<OperationOut> {
    return apiClient.postJson<OperationOut>(`${processingBase(projectId, datasetId)}/operations`, payload);
  },

  /**
   * ✅ Cleaning-only helper (strict contract)
   */
  async applyCleaningOperation(
    projectId: string | number,
    datasetId: number,
    payload: Omit<ApplyCleaningPayload, "type"> & { type?: "cleaning" }
  ): Promise<OperationOut> {
    const params = payload.params ?? ({} as any);
    if (!params.action || typeof params.action !== "string") {
      throw new Error("applyCleaningOperation: params.action is required");
    }

    const safe: ApplyCleaningPayload = {
      type: "cleaning",
      description: payload.description,
      columns: payload.columns ?? [],
      params: params as any,
    };

    return apiClient.postJson<OperationOut>(`${processingBase(projectId, datasetId)}/operations`, safe);
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
    const p = clampPage(page);
    const ps = clampPageSize(pageSize);
    return apiClient.get<ProcessingPreviewOut>(`${processingBase(projectId, datasetId)}/preview?page=${p}&page_size=${ps}`);
  },

  async getProcessingColumnsMeta(projectId: string | number, datasetId: number): Promise<ColumnsMetaOut> {
    return apiClient.get<ColumnsMetaOut>(`${processingBase(projectId, datasetId)}/columns-meta`);
  },
  

  async exportCleaned(projectId: string | number, datasetId: number) {
    return apiClient.getBlob(`${processingBase(projectId, datasetId)}/export`);
  },

  async saveCleanedAsVersion(
    projectId: string | number,
    datasetId: number,
    payload: SaveProcessedVersionPayload = {}
  ): Promise<SaveProcessedVersionOut> {
    return apiClient.postJson<SaveProcessedVersionOut>(`${processingBase(projectId, datasetId)}/save`, payload);
  },

  // -------------------------
  // Versions (list/delete only; no "view/preview/download" mode)
  // -------------------------
  async getVersions(projectId: string | number): Promise<VersionUI[]> {
    const out = await apiClient.get<DatasetVersionOut[]>(`${versionsBase(projectId)}`);
    const list = Array.isArray(out) ? out.map(normalizeVersion) : [];
    return list.filter((v) => v.id > 0);
  },

  async deleteVersion(projectId: string | number, versionId: number | string): Promise<void> {
    const vid = toNum(versionId);
    if (!vid) throw new Error("Invalid version id");
    await apiClient.delete<unknown>(`${versionsBase(projectId)}/${vid}`);
  },

  // -------------------------
  // Workspace for version edit
  // -------------------------
  async getOrCreateVersionWorkspace(projectId: string | number, versionId: number) {
    return apiClient.postJson<{ workspace_dataset_id: number }>(`${versionsBase(projectId)}/${versionId}/workspace`, {});
  },

  async commitVersionWorkspace(projectId: string | number, versionId: number, workspaceDatasetId: number) {
    return apiClient.postJson<{ ok: boolean }>(`${versionsBase(projectId)}/${versionId}/commit-workspace`, {
      workspace_dataset_id: workspaceDatasetId,
    });
  },

  async closeVersionWorkspace(projectId: string | number, versionId: number) {
    return apiClient.delete<{ ok: boolean }>(`${versionsBase(projectId)}/${versionId}/workspace`);
  },
};

export default dataService;
