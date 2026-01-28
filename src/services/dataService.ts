import apiClient from "@/services/apiClient";
import { ProcessingOperation } from "@/types";

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

function base(projectId: string | number, datasetId: number) {
  return `/projects/${projectId}/datasets/${datasetId}/processing`;
}

export const dataService = {
  async getOperations(projectId: string | number, datasetId: number): Promise<OperationOut[]> {
    return apiClient.get<OperationOut[]>(`${base(projectId, datasetId)}/operations`);
  },

  async applyOperation(
    projectId: string | number,
    datasetId: number,
    payload: ApplyOperationPayload
  ): Promise<OperationOut> {
    return apiClient.postJson<OperationOut>(`${base(projectId, datasetId)}/operations`, payload);
  },

  async undoLastOperation(projectId: string | number, datasetId: number): Promise<{ ok: boolean }> {
    return apiClient.postJson<{ ok: boolean }>(`${base(projectId, datasetId)}/undo`, {});
  },

  async getProcessingPreview(
    projectId: string | number,
    datasetId: number,
    page = 1,
    pageSize = 25
  ): Promise<ProcessingPreviewOut> {
    const p = encodeURIComponent(String(page));
    const ps = encodeURIComponent(String(pageSize));
    return apiClient.get<ProcessingPreviewOut>(`${base(projectId, datasetId)}/preview?page=${p}&page_size=${ps}`);
  },
};

export default dataService;
