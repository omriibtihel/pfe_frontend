import type {
  DatasetColumn,
  TrainingColumnType,
  TrainingColumnTypeSelection,
  TrainingPreprocessingAdvancedParams,
  TrainingPreprocessingColumnConfig,
  TrainingPreprocessingDefaults,
} from "@/types";
import type { Step3Issue } from "@/utils/step3Validation";

export type Step3ValidationState = {
  hasErrors: boolean;
  errorCount: number;
  warningCount: number;
  isValidating: boolean;
};

export type Step3StatusFilter = "all" | "active" | "dropped" | "errors" | "warnings";
export type Step3TypeFilter = "all" | "numeric" | "categorical" | "ordinal" | "auto";

export type Step3Options = {
  numericImputation: TrainingPreprocessingDefaults["numericImputation"][];
  numericPowerTransform: TrainingPreprocessingDefaults["numericPowerTransform"][];
  numericScaling: TrainingPreprocessingDefaults["numericScaling"][];
  categoricalImputation: TrainingPreprocessingDefaults["categoricalImputation"][];
  categoricalEncoding: TrainingPreprocessingDefaults["categoricalEncoding"][];
};

export type Step3ColumnRowData = {
  column: DatasetColumn;
  columnName: string;
  config: TrainingPreprocessingColumnConfig;
  inferredType: TrainingColumnType;
  selectedType: TrainingColumnTypeSelection;
  effectiveType: TrainingColumnType;
  use: boolean;
  numericImputation: TrainingPreprocessingDefaults["numericImputation"];
  numericPowerTransform: TrainingPreprocessingDefaults["numericPowerTransform"];
  numericScaling: TrainingPreprocessingDefaults["numericScaling"];
  /** True when the column has at least one negative value — used to warn against Box-Cox */
  hasNegativeValues: boolean;
  categoricalImputation: TrainingPreprocessingDefaults["categoricalImputation"];
  categoricalEncoding: TrainingPreprocessingDefaults["categoricalEncoding"];
  hasExplicitCategoricalConfig: boolean;
  /** Per-column advanced param overrides (undefined = uses global default) */
  knnNeighbors: number | undefined;
  constantFillNumeric: number | undefined;
  constantFillCategorical: string | undefined;
  /** Global advanced params for placeholder / fallback display */
  globalAdvancedParams: TrainingPreprocessingAdvancedParams;
  issues: Step3Issue[];
  errorCount: number;
  warningCount: number;
  status: "ok" | "warning" | "error";
};
