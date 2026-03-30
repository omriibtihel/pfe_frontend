import type { DatasetProfileOut } from "@/services/databaseService";

export type UiColumn = {
  name: string;
  kind: DatasetProfileOut["profiles"][number]["kind"];
  dtype: string;
  missing: number;
  numeric?: { mean?: number | null; std?: number | null };
};

export type ChartKind =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "doughnut"
  | "hist"
  | "boxplot"
  | "scatter"
  | "bubble"
  | "radar"
  | "heatmap";

/** Row shape produced by the boxplotInfo memo in ChartsPage */
export type BoxplotRow = {
  name: string;
  value: number;
  s_min: number; s_p25: number; s_p50: number; s_p75: number; s_max: number;
  _min: number; _p25: number; _p50: number; _p75: number; _max: number;
  fill: string;
};
