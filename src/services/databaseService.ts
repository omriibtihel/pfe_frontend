import apiClient from "@/services/apiClient";

// ---------------------------------------------------------------------------
// NOTE: Some apiClient implementations are typed as Promise<unknown>.
// These tiny helpers force the expected return type at the service boundary.
// ---------------------------------------------------------------------------
const typedGet = <T,>(url: string) => apiClient.get(url) as unknown as Promise<T>;
const typedPostJson = <T,>(url: string, body: any) =>
  apiClient.postJson(url, body) as unknown as Promise<T>;
const typedPutJson = <T,>(url: string, body: any) =>
  apiClient.putJson(url, body) as unknown as Promise<T>;

export type CorrelationOut = {
  columns: string[];
  matrix: number[][];
};

export type DatasetOut = {
  id: number;
  project_id: number;
  original_name: string;
  stored_name: string;
  content_type?: string | null;
  size_bytes?: number | null;
  created_at: string;
};

export type DatasetOverviewOut = {
  dataset: DatasetOut;
  shape: { rows: number; cols: number };
  columns: string[];
  dtypes: Record<string, string>;
  missing: Record<string, number>;
  preview: Record<string, any>[];
};

export type DatasetProfileOut = {
  dataset: DatasetOut;
  shape: { rows: number; cols: number };
  profiles: Array<{
    name: string;
    kind: "numeric" | "categorical" | "text" | "datetime" | "unknown";
    dtype: string;

    missing: number;
    missing_pct: number;
    unique: number;
    unique_pct: number;

    numeric?: {
      count: number;
      mean?: number | null;
      std?: number | null;
      min?: number | null;
      p25?: number | null;
      p50?: number | null;
      p75?: number | null;
      max?: number | null;
    } | null;

    categorical?: {
      unique: number;
      top_values: Array<{ value: string; count: number }>;
    } | null;
  }>;
};

export type ActiveDatasetOut = { active_dataset_id: number | null };
export type ActiveDatasetIn = { dataset_id: number };

export type DatasetTargetOut = { target_column: string | null };
export type DatasetTargetIn = { target_column: string | null };

// -------------------------
// CHARTS
// -------------------------
export type AggFn = "count" | "sum" | "avg" | "min" | "max" | "median";
export type SortOrder = "asc" | "desc";

export type HistBin = { x0: number; x1: number; count: number };
export type HistogramOut = { col: string; bins: number; rows: HistBin[] };

export type AggregatePoint = { x: string; y: number };
export type AggregateOut = {
  x: string;
  y: string | null;
  agg: AggFn;
  top_k: number;
  order: SortOrder;
  rows: AggregatePoint[];
};

export type ValueCountItem = { value: string; count: number };

// ✅ IMPORTANT: backend returns totals for "Others"
export type ValueCountsOut = {
  col: string;
  top_k: number;
  total_count: number;
  others_count: number;
  rows: ValueCountItem[];
};

export type SampleOut = {
  cols: string[];
  rows: Record<string, any>[];
};

export const databaseService = {
  async getOverview(projectId: string | number, datasetId: number, rows = 10) {
    return typedGet<DatasetOverviewOut>(
      `/projects/${projectId}/datasets/${datasetId}/overview?rows=${rows}`
    );
  },

  async getProfile(projectId: string | number, datasetId: number, topK = 5) {
    return typedGet<DatasetProfileOut>(
      `/projects/${projectId}/datasets/${datasetId}/profile?top_k=${topK}`
    );
  },

  async getActiveDataset(projectId: string | number) {
    return typedGet<ActiveDatasetOut>(`/projects/${projectId}/datasets/active`);
  },

  async setActiveDataset(projectId: string | number, datasetId: number) {
    return typedPostJson<ActiveDatasetOut>(`/projects/${projectId}/datasets/active`, {
      dataset_id: datasetId,
    } satisfies ActiveDatasetIn);
  },

  async getDatasetTarget(projectId: string, datasetId: number): Promise<DatasetTargetOut> {
    return typedGet<DatasetTargetOut>(`/projects/${projectId}/datasets/${datasetId}/target`);
  },

  async setDatasetTarget(
    projectId: string,
    datasetId: number,
    target: string | null
  ): Promise<DatasetTargetOut> {
    return typedPutJson<DatasetTargetOut>(`/projects/${projectId}/datasets/${datasetId}/target`, {
      target_column: target,
    } satisfies DatasetTargetIn);
  },

  async correlation(projectId: string | number, datasetId: string | number, columns: string[]) {
    const qs = columns.map((c) => `columns=${encodeURIComponent(c)}`).join("&");
    return typedGet<CorrelationOut>(
      `/projects/${projectId}/datasets/${datasetId}/correlation?${qs}`
    );
  },

  // -------------------------
  // Charts endpoints
  // -------------------------
  async aggregate(
    projectId: string | number,
    datasetId: number,
    params: {
      x: string;
      y?: string; // ✅ optional (count)
      agg: AggFn;
      top_k?: number;
      order?: SortOrder;
      dropna?: boolean;
    }
  ) {
    const { x, y, agg, top_k = 15, order = "desc", dropna = true } = params;
    const qs = new URLSearchParams();
    qs.set("x", x);
    if (y) qs.set("y", y);
    qs.set("agg", agg);
    qs.set("top_k", String(top_k));
    qs.set("order", order);
    qs.set("dropna", String(dropna));

    return typedGet<AggregateOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/aggregate?${qs.toString()}`
    );
  },

  async valueCounts(
    projectId: string | number,
    datasetId: number,
    params: { col: string; top_k?: number; dropna?: boolean }
  ) {
    const { col, top_k = 15, dropna = true } = params;
    const qs = new URLSearchParams();
    qs.set("col", col);
    qs.set("top_k", String(top_k));
    qs.set("dropna", String(dropna));

    return typedGet<ValueCountsOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/value-counts?${qs.toString()}`
    );
  },

  async sample(projectId: string | number, datasetId: number, params: { cols: string[]; n?: number }) {
    const { cols, n = 400 } = params;
    const qs = new URLSearchParams();
    cols.forEach((c) => qs.append("cols", c));
    qs.set("n", String(n));

    return typedGet<SampleOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/sample?${qs.toString()}`
    );
  },

  async hist(projectId: string | number, datasetId: number, params: { col: string; bins?: number; dropna?: boolean }) {
    const { col, bins = 20, dropna = true } = params;
    const qs = new URLSearchParams();
    qs.set("col", col);
    qs.set("bins", String(bins));
    qs.set("dropna", String(dropna));

    return typedGet<HistogramOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/hist?${qs.toString()}`
    );
  },
};

export default databaseService;
