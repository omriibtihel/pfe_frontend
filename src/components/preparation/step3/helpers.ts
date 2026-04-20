import type {
  DatasetColumn,
  TrainingColumnType,
  TrainingConfig,
  TrainingPreprocessingColumnConfig,
  TrainingPreprocessingConfig,
} from "@/types";
import { DEFAULT_TRAINING_PREPROCESSING, DEFAULT_TRAINING_PREPROCESSING_DEFAULTS } from "@/types";
import type { Step3ColumnValidationState } from "@/utils/step3Validation";
import type { Step3ColumnRowData } from "./types";

/** Local row type before issue/count fields are merged in. */
export type BaseRow = Omit<Step3ColumnRowData, "issues" | "errorCount" | "warningCount" | "status">;

export function toValidationRows(rows: BaseRow[]): Step3ColumnValidationState[] {
  return rows.map((row) => ({
    name: row.columnName,
    use: row.use,
    inferredType: row.inferredType,
    selectedType: row.selectedType,
    effectiveType: row.effectiveType,
    numericImputation: row.numericImputation,
    numericPowerTransform: row.numericPowerTransform,
    numericScaling: row.numericScaling,
    categoricalImputation: row.categoricalImputation,
    categoricalEncoding: row.categoricalEncoding,
    ordinalOrder: row.ordinalOrder,
    hasExplicitCategoricalConfig: row.hasExplicitCategoricalConfig,
    hasNegativeValues: row.hasNegativeValues,
  }));
}

export function labelForMethod(value: string): string {
  if (value === "none") return "Aucun";
  const map: Record<string, string> = {
    most_frequent: "Most Frequent",
    standard: "Standard (z-score)",
    minmax: "MinMax",
    maxabs: "MaxAbs",
    onehot: "One-Hot",
    knn: "KNN",
    yeo_johnson: "Yeo-Johnson (λ optimal)",
    box_cox: "Box-Cox (X > 0)",
  };
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function withNoneFirst<T extends string>(values: T[]): T[] {
  const unique = Array.from(new Set(values));
  const noneValue = "none" as T;
  const others = unique.filter((v) => v !== noneValue);
  return unique.includes(noneValue) ? [noneValue, ...others] : unique;
}

export function inferTypeFromDataset(column: DatasetColumn): TrainingColumnType {
  const t = String(column.type || "").toLowerCase();
  if (t === "numeric" || t === "binary") return "numeric";
  return "categorical";
}

export function normalizePreprocessing(
  preprocessing: TrainingConfig["preprocessing"] | null | undefined
): TrainingPreprocessingConfig {
  if (!preprocessing || typeof preprocessing !== "object") {
    return {
      defaults: { ...DEFAULT_TRAINING_PREPROCESSING_DEFAULTS },
      columns: {},
    };
  }

  return {
    defaults: {
      ...DEFAULT_TRAINING_PREPROCESSING.defaults,
      ...(preprocessing.defaults ?? {}),
    },
    columns: { ...(preprocessing.columns ?? {}) },
  };
}

export function clonePreprocessingConfig(
  preprocessing: TrainingPreprocessingConfig
): TrainingPreprocessingConfig {
  return {
    defaults: { ...preprocessing.defaults },
    columns: Object.fromEntries(
      Object.entries(preprocessing.columns).map(([columnName, cfg]) => [
        columnName,
        {
          ...(cfg ?? {}),
          ...(Array.isArray(cfg?.ordinalOrder) ? { ordinalOrder: [...cfg.ordinalOrder] } : {}),
        },
      ])
    ),
  };
}

export function cleanColumnConfig(
  cfg: TrainingPreprocessingColumnConfig
): TrainingPreprocessingColumnConfig | null {
  const next: TrainingPreprocessingColumnConfig = { ...cfg };
  if (!Array.isArray(next.ordinalOrder) || next.ordinalOrder.length === 0) {
    delete next.ordinalOrder;
  }

  if (next.use === undefined) delete next.use;
  if (next.type === undefined) delete next.type;
  if (next.numericImputation === undefined) delete next.numericImputation;
  if (next.numericPowerTransform === undefined) delete next.numericPowerTransform;
  if (next.numericScaling === undefined) delete next.numericScaling;
  if (next.categoricalImputation === undefined) delete next.categoricalImputation;
  if (next.categoricalEncoding === undefined) delete next.categoricalEncoding;

  return Object.keys(next).length ? next : null;
}

export function parseOrdinalOrder(value: string): string[] {
  const out: string[] = [];
  for (const part of String(value ?? "").split(",")) {
    const item = part.trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}
