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

// -------------------------
// NORMALITY TEST
// -------------------------
export type NormalityColResult = {
  col: string;
  n: number;
  mean: number;
  std: number;
  skewness: number;
  kurtosis: number;
  test_used: "shapiro" | "dagostino";
  stat: number;
  p_value: number;
  is_normal: boolean;
};

export type NormalityTestOut = {
  results: NormalityColResult[];
};

// ── Private QS builders (reused by both dataset and version methods) ──────────

type AggParams = {
  x: string; y?: string; agg: AggFn;
  top_k?: number; order?: SortOrder; dropna?: boolean;
};
type VcParams  = { col: string; top_k?: number; dropna?: boolean };
type HistParams = { col: string; bins?: number; dropna?: boolean };
type SampleParams = { cols: string[]; n?: number };

function aggQs({ x, y, agg, top_k = 15, order = "desc", dropna = true }: AggParams): string {
  const q = new URLSearchParams({ x, agg, top_k: String(top_k), order, dropna: String(dropna) });
  if (y) q.set("y", y);
  return q.toString();
}
function vcQs({ col, top_k = 15, dropna = true }: VcParams): string {
  return new URLSearchParams({ col, top_k: String(top_k), dropna: String(dropna) }).toString();
}
function histQs({ col, bins = 20, dropna = true }: HistParams): string {
  return new URLSearchParams({ col, bins: String(bins), dropna: String(dropna) }).toString();
}
function sampleQs({ cols, n = 400 }: SampleParams): string {
  const q = new URLSearchParams({ n: String(n) });
  cols.forEach((c) => q.append("cols", c));
  return q.toString();
}

// ── Analytics types without the `dataset` field — used for both dataset and version views ──

export type AnalyticsOverview = {
  shape: { rows: number; cols: number };
  columns: string[];
  dtypes: Record<string, string>;
  missing: Record<string, number>;
  preview: Record<string, any>[];
};

export type AnalyticsProfile = {
  shape: { rows: number; cols: number };
  profiles: DatasetProfileOut["profiles"];
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
  async aggregate(projectId: string | number, datasetId: number, params: AggParams) {
    return typedGet<AggregateOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/aggregate?${aggQs(params)}`
    );
  },

  async valueCounts(projectId: string | number, datasetId: number, params: VcParams) {
    return typedGet<ValueCountsOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/value-counts?${vcQs(params)}`
    );
  },

  async sample(projectId: string | number, datasetId: number, params: SampleParams) {
    return typedGet<SampleOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/sample?${sampleQs(params)}`
    );
  },

  async hist(projectId: string | number, datasetId: number, params: HistParams) {
    return typedGet<HistogramOut>(
      `/projects/${projectId}/datasets/${datasetId}/charts/hist?${histQs(params)}`
    );
  },

  async normalityTest(
    projectId: string | number,
    datasetId: number,
    columns: string[]
  ) {
    return typedPostJson<NormalityTestOut>(
      `/projects/${projectId}/datasets/${datasetId}/normality-test`,
      { columns }
    );
  },

  // -------------------------
  // Version analytics (mirrors dataset endpoints)
  // -------------------------
  async getVersionOverview(projectId: string | number, versionId: number, rows = 10) {
    return typedGet<AnalyticsOverview>(
      `/projects/${projectId}/versions/${versionId}/overview?rows=${rows}`
    );
  },

  async getVersionProfile(projectId: string | number, versionId: number, topK = 5) {
    return typedGet<AnalyticsProfile>(
      `/projects/${projectId}/versions/${versionId}/profile?top_k=${topK}`
    );
  },

  async versionCorrelation(projectId: string | number, versionId: number, columns: string[]) {
    const qs = columns.map((c) => `columns=${encodeURIComponent(c)}`).join("&");
    return typedGet<CorrelationOut>(`/projects/${projectId}/versions/${versionId}/correlation?${qs}`);
  },

  async versionAggregate(projectId: string | number, versionId: number, params: AggParams) {
    return typedGet<AggregateOut>(
      `/projects/${projectId}/versions/${versionId}/charts/aggregate?${aggQs(params)}`
    );
  },

  async versionValueCounts(projectId: string | number, versionId: number, params: VcParams) {
    return typedGet<ValueCountsOut>(
      `/projects/${projectId}/versions/${versionId}/charts/value-counts?${vcQs(params)}`
    );
  },

  async versionSample(projectId: string | number, versionId: number, params: SampleParams) {
    return typedGet<SampleOut>(
      `/projects/${projectId}/versions/${versionId}/charts/sample?${sampleQs(params)}`
    );
  },

  async versionHist(projectId: string | number, versionId: number, params: HistParams) {
    return typedGet<HistogramOut>(
      `/projects/${projectId}/versions/${versionId}/charts/hist?${histQs(params)}`
    );
  },

  async versionNormalityTest(projectId: string | number, versionId: number, columns: string[]) {
    return typedPostJson<NormalityTestOut>(
      `/projects/${projectId}/versions/${versionId}/normality-test`,
      { columns }
    );
  },
};

export default databaseService;
