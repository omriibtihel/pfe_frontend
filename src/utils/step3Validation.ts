import type {
  CategoricalEncodingStrategy,
  CategoricalImputationStrategy,
  NumericImputationStrategy,
  NumericPowerTransformStrategy,
  NumericScalingStrategy,
  TrainingColumnType,
  TrainingColumnTypeSelection,
} from "@/types";
import type {
  TrainingPreprocessingCapabilities,
  TrainingValidationIssueDetail,
  TrainingValidationResponse,
} from "@/services/trainingService";

export type Step3IssueSeverity = "error" | "warning";
export type Step3IssueSource = "local" | "server";

export type Step3Issue = {
  id: string;
  column?: string;
  severity: Step3IssueSeverity;
  code: string;
  message: string;
  source: Step3IssueSource;
};

export type Step3IssueBuckets = {
  columnIssues: Record<string, Step3Issue[]>;
  globalIssues: Step3Issue[];
};

export type Step3ColumnValidationState = {
  name: string;
  use: boolean;
  inferredType: TrainingColumnType;
  selectedType: TrainingColumnTypeSelection;
  effectiveType: TrainingColumnType;
  numericImputation: NumericImputationStrategy;
  numericPowerTransform: NumericPowerTransformStrategy;
  numericScaling: NumericScalingStrategy;
  categoricalImputation: CategoricalImputationStrategy;
  categoricalEncoding: CategoricalEncodingStrategy;
  ordinalOrder: string[];
  hasExplicitCategoricalConfig: boolean;
  /** True when the column has negative values — Box-Cox requires X > 0 */
  hasNegativeValues: boolean;
};

function pushIssue(
  target: Step3IssueBuckets,
  issue: Omit<Step3Issue, "id"> & { column?: string | null }
) {
  const column = String(issue.column ?? "").trim() || undefined;
  const code = String(issue.code ?? "").trim() || "unknown";
  const message = String(issue.message ?? "").trim();
  if (!message) return;

  const normalized: Step3Issue = {
    id: `${issue.source}:${issue.severity}:${code}:${column ?? "global"}:${message}`,
    column,
    severity: issue.severity,
    code,
    message,
    source: issue.source,
  };

  if (column) {
    const list = target.columnIssues[column] ?? [];
    if (!list.some((item) => item.id === normalized.id)) {
      target.columnIssues[column] = [...list, normalized];
    }
    return;
  }

  if (!target.globalIssues.some((item) => item.id === normalized.id)) {
    target.globalIssues = [...target.globalIssues, normalized];
  }
}

function findMentionedColumn(message: string, columnNames: string[]): string | undefined {
  const normalized = String(message ?? "").toLowerCase();
  if (!normalized) return undefined;

  const sorted = [...columnNames].sort((a, b) => b.length - a.length);
  for (const column of sorted) {
    if (normalized.includes(column.toLowerCase())) {
      return column;
    }
  }
  return undefined;
}

function isLikelyPreprocessingIssue(message: string, code: string): boolean {
  const haystack = `${String(code ?? "")} ${String(message ?? "")}`.toLowerCase();
  const keywords = [
    "preprocess",
    "column",
    "feature",
    "encoding",
    "imputation",
    "scaling",
    "ordinal",
    "categorical",
    "numeric",
    "nan",
    "null",
    "missing",
  ];
  return keywords.some((key) => haystack.includes(key));
}

function toMessage(detail: TrainingValidationIssueDetail): string {
  return String(detail?.message ?? "").trim();
}

function toSeverity(detail: TrainingValidationIssueDetail): Step3IssueSeverity {
  return String(detail?.severity ?? "").toLowerCase() === "warning" ? "warning" : "error";
}

function toCode(detail: TrainingValidationIssueDetail, severity: Step3IssueSeverity): string {
  const raw = String(detail?.code ?? "").trim();
  return raw || `server_${severity}`;
}

export function createEmptyIssueBuckets(): Step3IssueBuckets {
  return {
    columnIssues: {},
    globalIssues: [],
  };
}

export function validateLocal(
  columnsState: Step3ColumnValidationState[],
  _capabilities: TrainingPreprocessingCapabilities
): Step3IssueBuckets {
  const out = createEmptyIssueBuckets();

  for (const column of columnsState) {
    if (!column.use) continue;

    const isCategoricalLike =
      column.effectiveType === "categorical" || column.effectiveType === "ordinal";

    if (
      column.effectiveType === "numeric" &&
      column.numericPowerTransform === "box_cox" &&
      column.hasNegativeValues
    ) {
      pushIssue(out, {
        column: column.name,
        severity: "error",
        code: "box_cox_negative_values",
        message: "Box-Cox requiert des valeurs strictement positives (X > 0). Cette colonne contient des valeurs négatives — utilisez Yeo-Johnson à la place.",
        source: "local",
      });
    }

    if (isCategoricalLike && column.categoricalEncoding === "none") {
      pushIssue(out, {
        column: column.name,
        severity: "error",
        code: "categorical_encoding_none",
        message:
          "Encodage 'none' invalide pour une colonne categorielle/ordinale active. Choisissez onehot ou ordinal.",
        source: "local",
      });
    }

    if (column.effectiveType === "ordinal" && column.categoricalEncoding !== "ordinal") {
      pushIssue(out, {
        column: column.name,
        severity: "warning",
        code: "ordinal_encoding_recommended",
        message: "Type ordinal detecte: l'encodage 'ordinal' est recommande.",
        source: "local",
      });
    }

    if (
      column.effectiveType === "ordinal" &&
      column.categoricalEncoding === "ordinal" &&
      column.ordinalOrder.length === 0
    ) {
      pushIssue(out, {
        column: column.name,
        severity: "error",
        code: "ordinal_order_missing",
        message: "Encodage ordinal actif sans ordre explicite (ordinalOrder).",
        source: "local",
      });
    }

    if (
      column.effectiveType === "categorical" &&
      !column.hasExplicitCategoricalConfig &&
      column.categoricalImputation === "none" &&
      column.categoricalEncoding !== "none"
    ) {
      pushIssue(out, {
        column: column.name,
        severity: "warning",
        code: "categorical_no_column_config",
        message:
          "Aucun override colonne defini pour cette feature categorielle. Verifiez imputation/encoding.",
        source: "local",
      });
    }
  }

  return out;
}

export function toServerIssueBuckets(
  response: TrainingValidationResponse | null | undefined,
  columnNames: string[]
): Step3IssueBuckets {
  const out = createEmptyIssueBuckets();
  if (!response) return out;

  const safeColumns = [...columnNames].map((value) => String(value ?? "").trim()).filter(Boolean);
  const details = Array.isArray(response.error_details) ? response.error_details : [];

  for (const detail of details) {
    const severity = toSeverity(detail);
    const message = toMessage(detail);
    if (!message) continue;

    const explicitColumn = String(detail?.column ?? "").trim();
    const inferredColumn = safeColumns.includes(explicitColumn)
      ? explicitColumn
      : findMentionedColumn(message, safeColumns);

    if (inferredColumn) {
      pushIssue(out, {
        column: inferredColumn,
        severity,
        code: toCode(detail, severity),
        message,
        source: "server",
      });
      continue;
    }

    if (isLikelyPreprocessingIssue(message, toCode(detail, severity))) {
      pushIssue(out, {
        severity,
        code: toCode(detail, severity),
        message,
        source: "server",
      });
    }
  }

  for (const message of Array.isArray(response.errors) ? response.errors : []) {
    const safeMessage = String(message ?? "").trim();
    if (!safeMessage) continue;
    const column = findMentionedColumn(safeMessage, safeColumns);
    if (column) {
      pushIssue(out, {
        column,
        severity: "error",
        code: "server_error",
        message: safeMessage,
        source: "server",
      });
    } else if (isLikelyPreprocessingIssue(safeMessage, "server_error")) {
      pushIssue(out, {
        severity: "error",
        code: "server_error",
        message: safeMessage,
        source: "server",
      });
    }
  }

  for (const message of Array.isArray(response.warnings) ? response.warnings : []) {
    const safeMessage = String(message ?? "").trim();
    if (!safeMessage) continue;
    const column = findMentionedColumn(safeMessage, safeColumns);
    if (column) {
      pushIssue(out, {
        column,
        severity: "warning",
        code: "server_warning",
        message: safeMessage,
        source: "server",
      });
    } else if (isLikelyPreprocessingIssue(safeMessage, "server_warning")) {
      pushIssue(out, {
        severity: "warning",
        code: "server_warning",
        message: safeMessage,
        source: "server",
      });
    }
  }

  return out;
}
