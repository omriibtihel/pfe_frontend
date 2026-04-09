// src/services/dataService.ts
import apiClient from "@/services/apiClient";
import type { ProcessingOperation, DataVersion, DatasetColumn } from "@/types";

/**
 * Processing "Prepare" module should be CLEANING ONLY (avoid leakage).
 * Keep legacy types for older parts of app, but NettoyagePage must use cleaning payload.
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

export type ColumnKind = "numeric" | "categorical" | "datetime" | "binary" | "text" | "id" | "other";

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

  // Numeric-only stats (null for non-numeric columns)
  skewness?: number | null;
  outlier_count?: number | null;
  outlier_ratio?: number | null;
  has_negative?: boolean | null;
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

  stored_name?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;

  operations?: string[] | null;
  created_at?: string | null;

  // IMPORTANT: versions.py returns target_column
  target_column?: string | null;
  targetColumn?: string | null;

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
  sizeBytes?: number | null;

  // training convenience
  targetColumn?: string | null;
};

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeVersion(v: DatasetVersionOut): VersionUI {
  const id = toNum(v?.id) ?? 0;
  const targetColumn = (v as any)?.targetColumn ?? (v as any)?.target_column ?? null;

  return {
    id,
    projectId: toNum((v as any)?.project_id),
    sourceDatasetId: toNum((v as any)?.source_dataset_id),
    name: String(v?.name ?? `Version #${id}`),
    filePath: (v as any)?.file_path ?? null,
    operations: Array.isArray(v?.operations) ? (v.operations as string[]) : [],
    createdAt: (v as any)?.created_at ?? null,
    canPredict: Boolean((v as any)?.canPredict ?? (v as any)?.can_predict),
    sizeBytes: toNum((v as any)?.size_bytes),
    targetColumn: targetColumn ? String(targetColumn) : null,
  };
}

function processingBase(projectId: string | number, datasetId: number) {
  return `/projects/${projectId}/datasets/${datasetId}/nettoyage`;
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

// Helper: map ColumnMeta -> DatasetColumn (complete shape)
// ✅ This fixes your Step1 type mismatch (nullCount/uniqueCount/sampleValues)
function toDatasetColumn(c: ColumnMeta): DatasetColumn {
  const t = String((c as any)?.override_kind ?? (c as any)?.inferred_kind ?? (c as any)?.kind ?? (c as any)?.dtype ?? "other");

  return {
    name: c.name,
    type: t,

    // defaults/derived (depends on your DatasetColumn definition)
    nullCount: Number((c as any)?.missing ?? 0),
    uniqueCount: Number((c as any)?.unique ?? 0),
    sampleValues: Array.isArray((c as any)?.sample) ? (c as any)?.sample : [],
  } as DatasetColumn;
}

export const dataService = {
  // -------------------------
  // Version schema/meta helpers (used in version edit workspace + training)
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
    return apiClient.postJson<{ ok: boolean }>(`/projects/${projectId}/versions/${versionId}/column-kinds`, { overrides });
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

  async getProcessingPreview(projectId: string | number, datasetId: number, page = 1, pageSize = 25): Promise<ProcessingPreviewOut> {
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

  async saveCleanedAsVersion(projectId: string | number, datasetId: number, payload: SaveProcessedVersionPayload = {}): Promise<SaveProcessedVersionOut> {
    return apiClient.postJson<SaveProcessedVersionOut>(`${processingBase(projectId, datasetId)}/save`, payload);
  },

  // -------------------------
  // Versions (list/delete only; download exists in backend too)
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

  async renameVersion(projectId: string | number, versionId: number | string, name: string): Promise<void> {
    const vid = toNum(versionId);
    if (!vid) throw new Error("Invalid version id");
    await apiClient.patch<unknown>(`${versionsBase(projectId)}/${vid}`, { name });
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

  // -------------------------
  // ✅ Training helpers (NO NEW BACKEND ROUTE)
  // We reuse: GET /versions/{id}/columns-meta
  // -------------------------
  async getVersionTrainingSummary(
    projectId: string | number,
    versionId: number | string
  ): Promise<{ rowCount: number; columnCount: number }> {
    const meta = await this.getVersionColumnsMeta(projectId, versionId);
    const rowCount = Number(meta?.total_rows ?? 0);
    const columnCount = Array.isArray(meta?.columns) ? meta.columns.length : 0;
    return { rowCount, columnCount };
  },

  async getVersionTrainingColumns(projectId: string | number, versionId: number | string): Promise<DatasetColumn[]> {
    const meta = await this.getVersionColumnsMeta(projectId, versionId);
    const cols = Array.isArray(meta?.columns) ? meta.columns : [];
    return cols.map(toDatasetColumn);
  },

  async getVersionColumnValues(
    projectId: string | number,
    versionId: number | string,
    column: string
  ): Promise<string[]> {
    const res = await apiClient.get<{ column: string; values: string[]; total: number }>(
      `${versionsBase(projectId)}/${versionId}/column-values?column=${encodeURIComponent(column)}`
    );
    return res.values ?? [];
  },

  async getVersionColumnDistribution(
    projectId: string | number,
    versionId: number | string,
    column: string
  ): Promise<{ type: "categorical" | "histogram"; total: number; bars: { label: string; count: number }[] }> {
    return apiClient.get(
      `${versionsBase(projectId)}/${versionId}/column-distribution?column=${encodeURIComponent(column)}`
    );
  },
};

export default dataService;
