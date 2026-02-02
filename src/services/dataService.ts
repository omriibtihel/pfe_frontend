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

  // backend returns created_at (iso str)
  created_at?: string | null;

  // optional future fields
  can_predict?: boolean | null;
  canPredict?: boolean | null;
};

export type VersionUI = {
  id: number;
  projectId: number;
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
    operations: Array.isArray(v?.operations) ? v.operations : [],
    createdAt: (v as any)?.created_at ?? null,
    canPredict: Boolean((v as any)?.canPredict ?? (v as any)?.can_predict),
  };
}


function processingBase(projectId: string | number, datasetId: number) {
  return `/projects/${projectId}/datasets/${datasetId}/processing`;
}

// Versions (stockées séparément, liées au dataset source)
function versionsProjectBase(projectId: string | number) {
  return `/projects/${projectId}/versions`;
}

function versionsBase(projectId: string | number) {
  return `/projects/${projectId}/versions`;
}

export type SaveProcessedVersionPayload = {
  // optionnel si tu veux permettre un nom manuel plus tard
  name?: string;
};

export type SaveProcessedVersionOut =
  | DataVersion
  | {
      id: number;
      name?: string;
      createdAt?: string;
      created_at?: string;
      dataset_id?: number;
      source_dataset_id?: number;
      canPredict?: boolean;
      can_predict?: boolean;
      operations?: string[];
    };

export const dataService = {
  // -------------------------
  // Processing
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
    // nécessite apiClient.getBlob()
    return apiClient.getBlob(`${processingBase(projectId, datasetId)}/export`);
  },

  
  async saveProcessedAsVersion(
    projectId: string | number,
    datasetId: number,
    payload: SaveProcessedVersionPayload = {}
  ): Promise<SaveProcessedVersionOut> {
    const base = processingBase(projectId, datasetId);

    try {
      return await apiClient.postJson<SaveProcessedVersionOut>(`${base}/save`, payload);
    } catch (e) {
      // fallback si tu préfères l’endpoint /versions
      const msg = String((e as Error)?.message ?? "").toLowerCase();
      const shouldTryFallback = msg.includes("not found") || msg.includes("404") || msg.includes("cannot post");
      if (!shouldTryFallback) throw e;

      return apiClient.postJson<SaveProcessedVersionOut>(`${base}/versions`, payload);
    }
  },

  // -------------------------
  // Versions
  // -------------------------
  async getVersions(projectId: string | number): Promise<VersionUI[]> {
    const out = await apiClient.get<DatasetVersionOut[]>(`${versionsBase(projectId)}`);
    const list = Array.isArray(out) ? out.map(normalizeVersion) : [];
    // remove invalid ids (id=0 means unparseable)
    return list.filter((v) => v.id > 0);
  },

  async deleteVersion(projectId: string | number, versionId: number | string): Promise<void> {
    const vid = toNum(versionId);
    if (!vid) throw new Error("Invalid version id");
    await apiClient.delete<unknown>(`${versionsBase(projectId)}/${vid}`);
  },
};

export default dataService;
