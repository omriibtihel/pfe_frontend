// src/services/datasetService.ts
import apiClient from "@/services/apiClient";

/**
 * Types
 */
export type DatasetOut = {
  id: number;
  project_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  content_type?: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type DatasetPreviewOut = {
  dataset: DatasetOut;
  shape: { rows: number; cols: number };
  columns: string[];
  dtypes: Record<string, string>;
  rows: Record<string, unknown>[];
};

export type DatasetOverviewOut = {
  dataset: DatasetOut;
  shape: { rows: number; cols: number };
  columns: string[];
  dtypes: Record<string, string>;
  missing: Record<string, number>;
  preview: Record<string, unknown>[];
};

/**
 * Base path helper
 */
function base(projectId: string | number) {
  return `/projects/${projectId}/datasets`;
}

export const datasetService = {
  list(projectId: string | number) {
    return apiClient.get<DatasetOut[]>(`${base(projectId)}`);
  },

  upload(projectId: string | number, file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiClient.postFormData<DatasetOut>(`${base(projectId)}/upload`, form);
  },

  delete(projectId: string | number, datasetId: number) {
    return apiClient.delete<void>(`${base(projectId)}/${datasetId}`);
  },

  preview(projectId: string | number, datasetId: number, rows = 5) {
    return apiClient.get<DatasetPreviewOut>(
      `${base(projectId)}/${datasetId}/preview?rows=${rows}`
    );
  },

  overview(projectId: string | number, datasetId: number, rows = 5) {
    return apiClient.get<DatasetOverviewOut>(
      `${base(projectId)}/${datasetId}/overview?rows=${rows}`
    );
  },
};

export default datasetService;
