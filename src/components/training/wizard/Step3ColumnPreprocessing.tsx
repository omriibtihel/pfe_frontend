import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Columns3, Info, Search, SlidersHorizontal, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { dataService } from "@/services/dataService";
import {
  FALLBACK_PREPROCESSING_CAPABILITIES,
  trainingService,
  type TrainingPreprocessingCapabilities,
  type TrainingValidationPreviewMode,
  type TrainingValidationPreviewSubset,
} from "@/services/trainingService";
import { useColumnIssues } from "@/hooks/useColumnIssues";
import { useDebouncedValidation } from "@/hooks/useDebouncedValidation";
import type {
  DatasetColumn,
  TrainingColumnType,
  TrainingColumnTypeSelection,
  TrainingConfig,
  TrainingPreprocessingColumnConfig,
  TrainingPreprocessingConfig,
  TrainingPreprocessingDefaults,
} from "@/types";
import { DEFAULT_TRAINING_PREPROCESSING } from "@/types";
import {
  createEmptyIssueBuckets,
  toServerIssueBuckets,
  validateLocal,
  type Step3ColumnValidationState,
} from "@/utils/step3Validation";
import { BulkActionsBar } from "@/components/training/wizard/step3/BulkActionsBar";
import { ColumnRow } from "@/components/training/wizard/step3/ColumnRow";
import {
  cleanColumnConfig,
  clonePreprocessingConfig,
  inferTypeFromDataset,
  labelForMethod,
  normalizePreprocessing,
  parseOrdinalOrder,
  withNoneFirst,
} from "@/components/training/wizard/step3/helpers";
import { IssuesPanel } from "@/components/training/wizard/step3/IssuesPanel";
import type {
  Step3ColumnRowData,
  Step3Options,
  Step3StatusFilter,
  Step3TypeFilter,
} from "@/components/training/wizard/step3/types";

interface Step3Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
  onValidationStateChange?: (state: Step3ValidationState) => void;
}

export type Step3ValidationState = {
  hasErrors: boolean;
  errorCount: number;
  warningCount: number;
  isValidating: boolean;
};

const AUTO_TYPE = "auto" as const;
const PAGE_SIZE = 80;
const SERVER_VALIDATION_DEBOUNCE_MS = 500;
const PREVIEW_RANDOM_SEED = 42;
const PREVIEW_SAMPLE_SIZE_OPTIONS: number[] = [50, 100, 200];
const STATUS_FILTERS: Array<{ value: Step3StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "dropped", label: "Dropped" },
  { value: "errors", label: "With errors" },
  { value: "warnings", label: "With warnings" },
];

type BaseRow = Omit<Step3ColumnRowData, "issues" | "errorCount" | "warningCount" | "status">;

function toValidationRows(rows: BaseRow[]): Step3ColumnValidationState[] {
  return rows.map((row) => ({
    name: row.columnName,
    use: row.use,
    inferredType: row.inferredType,
    selectedType: row.selectedType,
    effectiveType: row.effectiveType,
    numericImputation: row.numericImputation,
    numericScaling: row.numericScaling,
    categoricalImputation: row.categoricalImputation,
    categoricalEncoding: row.categoricalEncoding,
    ordinalOrder: row.ordinalOrder,
    hasExplicitCategoricalConfig: row.hasExplicitCategoricalConfig,
  }));
}

function formatPreviewCell(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function Step3ColumnPreprocessing({
  projectId,
  config,
  onConfigChange,
  onValidationStateChange,
}: Step3Props) {
  const [capabilities, setCapabilities] = useState<TrainingPreprocessingCapabilities>(
    FALLBACK_PREPROCESSING_CAPABILITIES
  );
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Step3StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<Step3TypeFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIssueRows, setExpandedIssueRows] = useState<Set<string>>(new Set());
  const [previewSubset, setPreviewSubset] = useState<TrainingValidationPreviewSubset>("train");
  const [previewMode, setPreviewMode] = useState<TrainingValidationPreviewMode>("head");
  const [previewN, setPreviewN] = useState<number>(100);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const lastBulkSnapshotRef = useRef<TrainingPreprocessingConfig | null>(null);

  const preprocessing = useMemo(() => normalizePreprocessing(config.preprocessing), [config.preprocessing]);
  const featureColumns = useMemo(
    () => columns.filter((col) => col.name !== config.targetColumn),
    [columns, config.targetColumn]
  );

  useEffect(() => {
    const raw = config.preprocessing as { defaults?: unknown; columns?: unknown } | null | undefined;
    const isValidShape =
      raw &&
      typeof raw === "object" &&
      raw.defaults &&
      typeof raw.defaults === "object" &&
      raw.columns &&
      typeof raw.columns === "object";
    if (isValidShape) return;
    onConfigChange({ preprocessing: { ...DEFAULT_TRAINING_PREPROCESSING } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.preprocessing]);

  useEffect(() => {
    let mounted = true;
    const loadCapabilities = async () => {
      try {
        const caps = await trainingService.getCapabilities(String(projectId));
        if (mounted) {
          setCapabilities(caps.preprocessingCapabilities ?? FALLBACK_PREPROCESSING_CAPABILITIES);
        }
      } catch {
        if (mounted) setCapabilities(FALLBACK_PREPROCESSING_CAPABILITIES);
      }
    };
    loadCapabilities();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    const versionId = String(config.datasetVersionId ?? "").trim();
    if (!versionId) {
      setColumns([]);
      setSelectedColumns(new Set());
      return;
    }

    const loadColumns = async () => {
      setLoadingColumns(true);
      try {
        const out = await dataService.getVersionTrainingColumns(projectId, versionId);
        if (mounted) setColumns(out);
      } catch {
        if (mounted) setColumns([]);
      } finally {
        if (mounted) setLoadingColumns(false);
      }
    };
    loadColumns();
    return () => {
      mounted = false;
    };
  }, [projectId, config.datasetVersionId]);

  useEffect(() => {
    const valid = new Set(featureColumns.map((col) => col.name));
    setSelectedColumns((prev) => new Set([...prev].filter((columnName) => valid.has(columnName))));
  }, [featureColumns]);

  const options: Step3Options = useMemo(
    () => ({
      numericImputation: withNoneFirst(capabilities.numericImputation),
      numericScaling: withNoneFirst(capabilities.numericScaling),
      categoricalImputation: withNoneFirst(capabilities.categoricalImputation),
      categoricalEncoding: withNoneFirst(capabilities.categoricalEncoding),
    }),
    [capabilities]
  );

  const baseRows = useMemo<BaseRow[]>(
    () =>
      featureColumns.map((column) => {
        const cfg = preprocessing.columns[column.name] ?? {};
        const inferredType = inferTypeFromDataset(column);
        const selectedType: TrainingColumnTypeSelection = cfg.type ?? "auto";
        const effectiveType = cfg.type ?? inferredType;
        return {
          column,
          columnName: column.name,
          config: cfg,
          inferredType,
          selectedType,
          effectiveType,
          use: cfg.use ?? true,
          numericImputation: cfg.numericImputation ?? preprocessing.defaults.numericImputation,
          numericScaling: cfg.numericScaling ?? preprocessing.defaults.numericScaling,
          categoricalImputation: cfg.categoricalImputation ?? preprocessing.defaults.categoricalImputation,
          categoricalEncoding: cfg.categoricalEncoding ?? preprocessing.defaults.categoricalEncoding,
          ordinalOrder: Array.isArray(cfg.ordinalOrder) ? cfg.ordinalOrder : [],
          hasExplicitCategoricalConfig:
            typeof cfg.categoricalEncoding === "string" || typeof cfg.categoricalImputation === "string",
        };
      }),
    [featureColumns, preprocessing.columns, preprocessing.defaults]
  );

  const localIssues = useMemo(() => validateLocal(toValidationRows(baseRows), capabilities), [baseRows, capabilities]);
  const valSubsetAvailable = Number(config.valRatio ?? 0) > 0;
  const testSubsetAvailable = Number(config.testRatio ?? 0) > 0;

  useEffect(() => {
    if (previewSubset === "val" && !valSubsetAvailable) {
      setPreviewSubset("train");
      return;
    }
    if (previewSubset === "test" && !testSubsetAvailable) {
      setPreviewSubset("train");
    }
  }, [previewSubset, testSubsetAvailable, valSubsetAvailable]);

  const validateOptions = useMemo(
    () => ({
      include: { preview: true },
      preview: {
        subset: previewSubset,
        mode: previewMode,
        n: previewN,
        seed: PREVIEW_RANDOM_SEED,
      },
    }),
    [previewMode, previewN, previewSubset]
  );

  const { serverResult, isValidating, lastValidatedAt, validationError } = useDebouncedValidation({
    projectId,
    config,
    enabled:
      Boolean(String(projectId ?? "").trim()) &&
      Boolean(String(config.datasetVersionId ?? "").trim()) &&
      Boolean(String(config.targetColumn ?? "").trim()) &&
      featureColumns.length > 0,
    delayMs: SERVER_VALIDATION_DEBOUNCE_MS,
    validateOptions,
  });

  const serverIssues = useMemo(() => {
    const base = toServerIssueBuckets(
      serverResult,
      baseRows.map((row) => row.columnName)
    );
    if (!validationError) return base;
    const out = createEmptyIssueBuckets();
    out.columnIssues = { ...base.columnIssues };
    out.globalIssues = [
      ...base.globalIssues,
      {
        id: `server:warning:validation_unavailable:global:${validationError}`,
        severity: "warning",
        code: "validation_unavailable",
        message: validationError,
        source: "server",
      },
    ];
    return out;
  }, [baseRows, serverResult, validationError]);

  const previewColumns = useMemo(() => {
    const columnsRaw = serverResult?.previewTransformed?.columns;
    if (!Array.isArray(columnsRaw)) return [];
    return columnsRaw.map((value) => String(value ?? ""));
  }, [serverResult]);

  const previewRows = useMemo(() => {
    const rowsRaw = serverResult?.previewTransformed?.rows;
    if (!Array.isArray(rowsRaw)) return [];
    return rowsRaw
      .filter((row) => Array.isArray(row))
      .map((row) =>
        (row as unknown[]).slice(0, previewColumns.length).concat(
          Array.from({ length: Math.max(0, previewColumns.length - (row as unknown[]).length) }).map(() => null)
        )
      );
  }, [previewColumns.length, serverResult]);

  const previewMeta = serverResult?.previewMeta;
  const hasPreviewTable = previewColumns.length > 0;
  const previewSubsetLabel = String(previewMeta?.subset ?? previewSubset).toUpperCase();
  const previewSplitSeed = Number(previewMeta?.splitSeed ?? PREVIEW_RANDOM_SEED);
  const previewFromCache = Boolean(previewMeta?.fromCache);

  const { mergedIssues, counts, columnCounts, issuesList } = useColumnIssues(localIssues, serverIssues);

  useEffect(() => {
    onValidationStateChange?.({
      hasErrors: counts.errors > 0,
      errorCount: counts.errors,
      warningCount: counts.warnings,
      isValidating,
    });
  }, [counts.errors, counts.warnings, isValidating, onValidationStateChange]);

  const rows = useMemo<Step3ColumnRowData[]>(
    () =>
      baseRows.map((row) => {
        const perColumnCounts = columnCounts[row.columnName] ?? { errors: 0, warnings: 0 };
        return {
          ...(row as Step3ColumnRowData),
          issues: mergedIssues.columnIssues[row.columnName] ?? [],
          errorCount: perColumnCounts.errors,
          warningCount: perColumnCounts.warnings,
          status: perColumnCounts.errors > 0 ? "error" : perColumnCounts.warnings > 0 ? "warning" : "ok",
        };
      }),
    [baseRows, columnCounts, mergedIssues.columnIssues]
  );

  const rowsByName = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.columnName, row])) as Record<string, Step3ColumnRowData>,
    [rows]
  );

  const selectedColumnNames = useMemo(
    () => [...selectedColumns].filter((columnName) => rowsByName[columnName]),
    [rowsByName, selectedColumns]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const query = searchQuery.trim().toLowerCase();
        if (query && !row.columnName.toLowerCase().includes(query)) return false;

        if (statusFilter === "active" && !row.use) return false;
        if (statusFilter === "dropped" && row.use) return false;
        if (statusFilter === "errors" && row.errorCount === 0) return false;
        if (statusFilter === "warnings" && row.warningCount === 0) return false;

        if (typeFilter === "auto") return row.selectedType === "auto";
        if (typeFilter !== "all") return row.effectiveType === typeFilter;
        return true;
      }),
    [rows, searchQuery, statusFilter, typeFilter]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter]);

  const shouldPaginate = filteredRows.length > 200;
  const totalPages = shouldPaginate ? Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)) : 1;
  const visibleRows = useMemo(() => {
    if (!shouldPaginate) return filteredRows;
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredRows, shouldPaginate]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const setPreprocessing = (next: TrainingPreprocessingConfig) => onConfigChange({ preprocessing: next });
  const setDefaultValue = <K extends keyof TrainingPreprocessingDefaults>(
    key: K,
    value: TrainingPreprocessingDefaults[K]
  ) => setPreprocessing({ ...preprocessing, defaults: { ...preprocessing.defaults, [key]: value } });

  const updateColumnConfig = (
    columnName: string,
    updater: (current: TrainingPreprocessingColumnConfig) => TrainingPreprocessingColumnConfig
  ) => {
    const current = preprocessing.columns[columnName] ?? {};
    const updated = cleanColumnConfig(updater({ ...current }));
    const nextColumns = { ...preprocessing.columns };
    if (updated) nextColumns[columnName] = updated;
    else delete nextColumns[columnName];
    setPreprocessing({ ...preprocessing, columns: nextColumns });
  };

  const withBulkSnapshot = (nextColumns: TrainingPreprocessingConfig["columns"]) => {
    lastBulkSnapshotRef.current = clonePreprocessingConfig(preprocessing);
    setPreprocessing({ ...preprocessing, columns: nextColumns });
  };

  const applyDefaultsToSelected = () => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const columnName of selectedColumnNames) {
      const current = nextColumns[columnName] ?? {};
      const updated = cleanColumnConfig({
        ...current,
        use: current.use ?? true,
        numericImputation: preprocessing.defaults.numericImputation,
        numericScaling: preprocessing.defaults.numericScaling,
        categoricalImputation: preprocessing.defaults.categoricalImputation,
        categoricalEncoding: preprocessing.defaults.categoricalEncoding,
      });
      if (updated) nextColumns[columnName] = updated;
      else delete nextColumns[columnName];
    }
    withBulkSnapshot(nextColumns);
  };

  const resetSelectedColumns = () => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const columnName of selectedColumnNames) delete nextColumns[columnName];
    withBulkSnapshot(nextColumns);
  };

  const setUseForSelected = (use: boolean) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const columnName of selectedColumnNames) {
      const updated = cleanColumnConfig({ ...(nextColumns[columnName] ?? {}), use });
      if (updated) nextColumns[columnName] = updated;
      else delete nextColumns[columnName];
    }
    withBulkSnapshot(nextColumns);
  };

  const setTypeForSelected = (type: TrainingColumnTypeSelection) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const columnName of selectedColumnNames) {
      const row = rowsByName[columnName];
      const next = { ...(nextColumns[columnName] ?? {}) };
      if (type === "auto") delete next.type;
      else next.type = type;
      if ((type === "auto" ? row?.inferredType : type) !== "ordinal") delete next.ordinalOrder;
      const updated = cleanColumnConfig(next);
      if (updated) nextColumns[columnName] = updated;
      else delete nextColumns[columnName];
    }
    withBulkSnapshot(nextColumns);
  };

  const setEncodingForSelected = (encoding: TrainingPreprocessingDefaults["categoricalEncoding"]) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const columnName of selectedColumnNames) {
      if (rowsByName[columnName]?.effectiveType === "numeric") continue;
      const next = { ...(nextColumns[columnName] ?? {}), categoricalEncoding: encoding };
      if (encoding !== "ordinal") delete next.ordinalOrder;
      const updated = cleanColumnConfig(next);
      if (updated) nextColumns[columnName] = updated;
      else delete nextColumns[columnName];
    }
    withBulkSnapshot(nextColumns);
  };

  const filteredSelectedCount = filteredRows.filter((row) => selectedColumns.has(row.columnName)).length;
  const activeRowsCount = rows.filter((row) => row.use).length;
  const droppedRowsCount = rows.length - activeRowsCount;
  const autoTypeRowsCount = rows.filter((row) => row.selectedType === AUTO_TYPE).length;
  const manualTypeRowsCount = rows.length - autoTypeRowsCount;
  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== "all" || typeFilter !== "all";
  const statusFilterCounts = {
    all: rows.length,
    active: activeRowsCount,
    dropped: droppedRowsCount,
    errors: rows.filter((row) => row.errorCount > 0).length,
    warnings: rows.filter((row) => row.warningCount > 0).length,
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="gradient-subtle border-primary/20">
          <CardContent className="py-5 space-y-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="rounded-lg bg-primary/10 p-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                  </span>
                  Configuration preprocessing
                </p>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  Definissez d'abord les defaults puis ajustez rapidement les colonnes problematiques via filtres et
                  actions en lot.
                </p>
              </div>
              <Badge variant={counts.errors > 0 ? "destructive" : "secondary"} className="ml-auto text-xs">
                {counts.errors > 0 ? "Correction requise" : "Configuration exploitable"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                <p className="text-[11px] text-muted-foreground">Features</p>
                <p className="text-sm font-semibold">{rows.length}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                <p className="text-[11px] text-muted-foreground">Actives</p>
                <p className="text-sm font-semibold text-emerald-700">{activeRowsCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                <p className="text-[11px] text-muted-foreground">Droppees</p>
                <p className="text-sm font-semibold text-amber-700">{droppedRowsCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                <p className="text-[11px] text-muted-foreground">Types auto</p>
                <p className="text-sm font-semibold">{autoTypeRowsCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                <p className="text-[11px] text-muted-foreground">Types forces</p>
                <p className="text-sm font-semibold">{manualTypeRowsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </div>
            Defaults (templates)
            <Badge variant="secondary" className="ml-auto text-xs">
              Aucune activation auto
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Numerique</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Imputation numerique</p>
                  <Select
                    value={preprocessing.defaults.numericImputation}
                    onValueChange={(v) =>
                      setDefaultValue("numericImputation", v as TrainingPreprocessingDefaults["numericImputation"])
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.numericImputation.map((m) => (
                        <SelectItem key={m} value={m}>
                          {labelForMethod(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Scaling numerique</p>
                  <Select
                    value={preprocessing.defaults.numericScaling}
                    onValueChange={(v) =>
                      setDefaultValue("numericScaling", v as TrainingPreprocessingDefaults["numericScaling"])
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.numericScaling.map((m) => (
                        <SelectItem key={m} value={m}>
                          {labelForMethod(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoriel</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Imputation categorielle</p>
                  <Select
                    value={preprocessing.defaults.categoricalImputation}
                    onValueChange={(v) =>
                      setDefaultValue(
                        "categoricalImputation",
                        v as TrainingPreprocessingDefaults["categoricalImputation"]
                      )
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.categoricalImputation.map((m) => (
                        <SelectItem key={m} value={m}>
                          {labelForMethod(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Encodage categoriel</p>
                  <Select
                    value={preprocessing.defaults.categoricalEncoding}
                    onValueChange={(v) =>
                      setDefaultValue("categoricalEncoding", v as TrainingPreprocessingDefaults["categoricalEncoding"])
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.categoricalEncoding.map((m) => (
                        <SelectItem key={m} value={m}>
                          {labelForMethod(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-4 space-y-4">
          <IssuesPanel
            counts={counts}
            issues={issuesList}
            isValidating={isValidating}
            lastValidatedAt={lastValidatedAt}
            validationError={validationError}
            onIssueClick={(columnName) => {
              if (!filteredRows.some((row) => row.columnName === columnName)) {
                setSearchQuery("");
                setStatusFilter("all");
                setTypeFilter("all");
              }
              const rowIndex = rows.findIndex((row) => row.columnName === columnName);
              if (rowIndex >= 0 && rows.length > 200) setCurrentPage(Math.floor(rowIndex / PAGE_SIZE) + 1);
              setExpandedIssueRows((prev) => new Set(prev).add(columnName));
              window.setTimeout(
                () => rowRefs.current[columnName]?.scrollIntoView({ behavior: "smooth", block: "center" }),
                40
              );
            }}
          />

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-dashed border-border/70">
              <CardContent className="py-4 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Rappel</p>
                    <p>
                      Aucun preprocessing n'est applique par defaut. Les defaults servent uniquement de templates
                      reutilisables colonne par colonne.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="xl:col-span-8">
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Columns3 className="h-4 w-4 text-primary" />
                </div>
                Preview (transformed)
                <Badge variant="secondary" className="ml-auto text-xs">
                  fit sur TRAIN uniquement
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Subset</span>
                  <select
                    aria-label="preview-subset"
                    data-testid="preview-subset"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={previewSubset}
                    onChange={(event) => setPreviewSubset(event.target.value as TrainingValidationPreviewSubset)}
                  >
                    <option value="train">Train</option>
                    <option value="val" disabled={!valSubsetAvailable}>
                      Val
                    </option>
                    <option value="test" disabled={!testSubsetAvailable}>
                      Test
                    </option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Mode</span>
                  <select
                    aria-label="preview-mode"
                    data-testid="preview-mode"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={previewMode}
                    onChange={(event) => setPreviewMode(event.target.value as TrainingValidationPreviewMode)}
                  >
                    <option value="head">Head</option>
                    <option value="random">Random</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Rows</span>
                  <select
                    aria-label="preview-n"
                    data-testid="preview-n"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={String(previewN)}
                    onChange={(event) => setPreviewN(Number(event.target.value))}
                  >
                    {PREVIEW_SAMPLE_SIZE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Badge variant="outline" className="text-xs" data-testid="preview-meta-badge">
                Preview fitted on TRAIN (seed={previewSplitSeed}) - subset: {previewSubsetLabel} - fromCache:{" "}
                {previewFromCache ? "true" : "false"}
              </Badge>

              {hasPreviewTable ? (
                <div className="space-y-2">
                  {isValidating && (
                    <p className="text-xs text-muted-foreground" data-testid="preview-updating">
                      Updating preview...
                    </p>
                  )}
                  {validationError && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700">
                      Latest preview update failed. Showing previous preview.
                    </div>
                  )}
                  <div
                    className="rounded-lg border border-border/60 overflow-auto"
                    data-testid="preview-transformed-table"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {previewColumns.map((column) => (
                            <TableHead key={column}>{column}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.length ? (
                          previewRows.map((row, rowIndex) => (
                            <TableRow key={`preview-row-${rowIndex}`}>
                              {previewColumns.map((column, colIndex) => (
                                <TableCell key={`${column}-${rowIndex}-${colIndex}`} className="font-mono text-xs">
                                  {formatPreviewCell(row[colIndex])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={Math.max(1, previewColumns.length)}
                              className="text-xs text-muted-foreground"
                            >
                              Preview returned no rows.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : isValidating ? (
                <div className="rounded-lg border border-border/60 p-3 space-y-2" data-testid="preview-loading">
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-full rounded bg-muted animate-pulse" />
                  <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
                </div>
              ) : validationError ? (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  data-testid="preview-error"
                >
                  {validationError}
                </div>
              ) : (
                <div
                  className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground"
                  data-testid="preview-empty"
                >
                  No preview data yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-secondary/10">
              <Columns3 className="h-4 w-4 text-secondary" />
            </div>
            Preprocessing par colonne
            <Badge variant="outline" className="ml-auto text-xs">
              use=false (drop)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {counts.errors > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5" />
              <span>Configuration invalide: corrigez les erreurs avant de continuer.</span>
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full lg:flex-1 lg:min-w-[280px]">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search columns..."
                  className="pl-8"
                />
              </div>

              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as Step3TypeFilter)}>
                <SelectTrigger className="h-9 w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Type: all</SelectItem>
                  <SelectItem value="numeric">Type: numeric</SelectItem>
                  <SelectItem value="categorical">Type: categorical</SelectItem>
                  <SelectItem value="ordinal">Type: ordinal</SelectItem>
                  <SelectItem value="auto">Type: auto</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {STATUS_FILTERS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={statusFilter === item.value ? "secondary" : "ghost"}
                  onClick={() => setStatusFilter(item.value)}
                  className="gap-1.5"
                >
                  {item.label}
                  <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">
                    {statusFilterCounts[item.value]}
                  </Badge>
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="font-normal">
                {filteredRows.length} / {rows.length} colonne(s) affichee(s)
              </Badge>
              <Badge variant="outline" className="font-normal">
                {filteredSelectedCount} selectionnee(s) dans le filtre courant
              </Badge>
              {counts.errors > 0 ? (
                <Badge variant="destructive" className="font-normal">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {counts.errors} erreur(s)
                </Badge>
              ) : (
                <Badge variant="secondary" className="font-normal">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Aucune erreur bloquante
                </Badge>
              )}
            </div>
          </div>

          <BulkActionsBar
            selectedCount={selectedColumnNames.length}
            filteredCount={filteredRows.length}
            canUndo={Boolean(lastBulkSnapshotRef.current)}
            onSelectAllFiltered={() =>
              setSelectedColumns((prev) => {
                const next = new Set(prev);
                for (const row of filteredRows) next.add(row.columnName);
                return next;
              })
            }
            onClearSelection={() => setSelectedColumns(new Set())}
            onApplyDefaults={applyDefaultsToSelected}
            onResetSelected={resetSelectedColumns}
            onUndoLastBulk={() => {
              if (!lastBulkSnapshotRef.current) return;
              const snapshot = lastBulkSnapshotRef.current;
              lastBulkSnapshotRef.current = null;
              setPreprocessing(snapshot);
            }}
            onSetUse={setUseForSelected}
            onSetType={setTypeForSelected}
            onSetEncoding={setEncodingForSelected}
          />

          {loadingColumns ? (
            <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
              Chargement des colonnes...
            </div>
          ) : !rows.length ? (
            <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
              Aucune feature disponible. Selectionnez une version et une cible.
            </div>
          ) : !visibleRows.length ? (
            <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
              Aucun resultat pour ce filtre.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 sticky top-0 z-20 bg-background/95 backdrop-blur">Status</TableHead>
                        <TableHead className="w-12 sticky top-0 z-20 bg-background/95 backdrop-blur">Sel.</TableHead>
                        <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur">Colonne</TableHead>
                        <TableHead className="w-24 sticky top-0 z-20 bg-background/95 backdrop-blur">Use</TableHead>
                        <TableHead className="w-44 sticky top-0 z-20 bg-background/95 backdrop-blur">Type</TableHead>
                        <TableHead className="w-48 sticky top-0 z-20 bg-background/95 backdrop-blur">Imputation</TableHead>
                        <TableHead className="w-48 sticky top-0 z-20 bg-background/95 backdrop-blur">
                          Scaling / Encoding
                        </TableHead>
                        <TableHead className="w-56 sticky top-0 z-20 bg-background/95 backdrop-blur">
                          Ordinal order
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((row) => (
                        <ColumnRow
                          key={row.columnName}
                          row={row}
                          options={options}
                          autoTypeValue={AUTO_TYPE}
                          isSelected={selectedColumns.has(row.columnName)}
                          isExpanded={expandedIssueRows.has(row.columnName)}
                          labelForMethod={labelForMethod}
                          onRegisterRowRef={(node) => {
                            rowRefs.current[row.columnName] = node;
                          }}
                          onToggleSelected={(checked) =>
                            setSelectedColumns((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(row.columnName);
                              else next.delete(row.columnName);
                              return next;
                            })
                          }
                          onToggleUse={(checked) =>
                            updateColumnConfig(row.columnName, (current) => ({ ...current, use: checked }))
                          }
                          onTypeChange={(value) =>
                            updateColumnConfig(row.columnName, (current) => {
                              const next = { ...current };
                              if (value === AUTO_TYPE) delete next.type;
                              else next.type = value;
                              if ((next.type ?? row.inferredType) !== "ordinal") delete next.ordinalOrder;
                              return next;
                            })
                          }
                          onNumericImputationChange={(value) =>
                            updateColumnConfig(row.columnName, (current) => ({ ...current, numericImputation: value }))
                          }
                          onCategoricalImputationChange={(value) =>
                            updateColumnConfig(row.columnName, (current) => ({
                              ...current,
                              categoricalImputation: value,
                            }))
                          }
                          onNumericScalingChange={(value) =>
                            updateColumnConfig(row.columnName, (current) => ({ ...current, numericScaling: value }))
                          }
                          onCategoricalEncodingChange={(value) =>
                            updateColumnConfig(row.columnName, (current) => {
                              const next = { ...current, categoricalEncoding: value };
                              if (value !== "ordinal") delete next.ordinalOrder;
                              return next;
                            })
                          }
                          onOrdinalOrderChange={(rawInput) =>
                            updateColumnConfig(row.columnName, (current) => {
                              const parsed = parseOrdinalOrder(rawInput);
                              return { ...current, ordinalOrder: parsed.length ? parsed : undefined };
                            })
                          }
                          onToggleExpanded={() =>
                            setExpandedIssueRows((prev) => {
                              const next = new Set(prev);
                              if (next.has(row.columnName)) next.delete(row.columnName);
                              else next.add(row.columnName);
                              return next;
                            })
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {shouldPaginate && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Step3ColumnPreprocessing;
