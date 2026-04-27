import { useEffect, useMemo, useRef, useState } from "react";

import { dataService } from "@/services/dataService";
import {
  FALLBACK_PREPROCESSING_CAPABILITIES,
  trainingService,
  type TrainingPreprocessingCapabilities,
} from "@/services/trainingService";
import { useColumnIssues } from "@/hooks/useColumnIssues";
import { useDebouncedValidation } from "@/hooks/useDebouncedValidation";
import type {
  DatasetColumn,
  DatasetProfile,
  TrainingColumnTypeSelection,
  TrainingConfig,
  TrainingPreprocessingAdvancedParams,
  TrainingPreprocessingColumnConfig,
  TrainingPreprocessingConfig,
  TrainingPreprocessingDefaults,
} from "@/types";
import { DEFAULT_ADVANCED_PARAMS, DEFAULT_TRAINING_PREPROCESSING } from "@/types";
import {
  createEmptyIssueBuckets,
  toServerIssueBuckets,
  validateLocal,
} from "@/utils/step3Validation";
import {
  cleanColumnConfig,
  clonePreprocessingConfig,
  inferTypeFromDataset,
  normalizePreprocessing,
  toValidationRows,
  withNoneFirst,
  type BaseRow,
} from "./helpers";
import type {
  Step3ColumnRowData,
  Step3Options,
  Step3StatusFilter,
  Step3TypeFilter,
  Step3ValidationState,
} from "./types";

const PAGE_SIZE = 80;
const SERVER_VALIDATION_DEBOUNCE_MS = 500;

interface UseStep3Params {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
  onValidationStateChange?: (state: Step3ValidationState) => void;
  serverValidationEnabled?: boolean;
}

export function useStep3ColumnPreprocessing({
  projectId,
  config,
  onConfigChange,
  onValidationStateChange,
  serverValidationEnabled = true,
}: UseStep3Params) {
  const [capabilities, setCapabilities] = useState<TrainingPreprocessingCapabilities>(
    FALLBACK_PREPROCESSING_CAPABILITIES
  );
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [columnProfile, setColumnProfile] = useState<DatasetProfile | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Step3StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<Step3TypeFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIssueRows, setExpandedIssueRows] = useState<Set<string>>(new Set());

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
      raw && typeof raw === "object" &&
      raw.defaults && typeof raw.defaults === "object" &&
      raw.columns && typeof raw.columns === "object";
    if (isValidShape) return;
    onConfigChange({ preprocessing: { ...DEFAULT_TRAINING_PREPROCESSING } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.preprocessing]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const caps = await trainingService.getCapabilities(String(projectId));
        if (mounted) setCapabilities(caps.preprocessingCapabilities ?? FALLBACK_PREPROCESSING_CAPABILITIES);
      } catch {
        if (mounted) setCapabilities(FALLBACK_PREPROCESSING_CAPABILITIES);
      }
    };
    load();
    return () => { mounted = false; };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    const versionId = String(config.datasetVersionId ?? "").trim();
    if (!versionId) { setColumns([]); setSelectedColumns(new Set()); return; }
    const load = async () => {
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
    load();
    return () => { mounted = false; };
  }, [projectId, config.datasetVersionId]);

  useEffect(() => {
    const valid = new Set(featureColumns.map((col) => col.name));
    setSelectedColumns((prev) => new Set([...prev].filter((name) => valid.has(name))));
  }, [featureColumns]);

  const options: Step3Options = useMemo(
    () => ({
      numericImputation: withNoneFirst(capabilities.numericImputation),
      numericPowerTransform: withNoneFirst(capabilities.numericPowerTransform),
      numericScaling: withNoneFirst(capabilities.numericScaling),
      categoricalImputation: withNoneFirst(capabilities.categoricalImputation),
      categoricalEncoding: withNoneFirst(capabilities.categoricalEncoding),
    }),
    [capabilities]
  );

  const globalAdvancedParams = preprocessing.advancedParams ?? DEFAULT_ADVANCED_PARAMS;

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
          numericPowerTransform: cfg.numericPowerTransform ?? preprocessing.defaults.numericPowerTransform,
          numericScaling: cfg.numericScaling ?? preprocessing.defaults.numericScaling,
          categoricalImputation: cfg.categoricalImputation ?? preprocessing.defaults.categoricalImputation,
          categoricalEncoding: cfg.categoricalEncoding ?? preprocessing.defaults.categoricalEncoding,
          hasExplicitCategoricalConfig:
            typeof cfg.categoricalEncoding === "string" || typeof cfg.categoricalImputation === "string",
          knnNeighbors: cfg.knnNeighbors,
          constantFillNumeric: cfg.constantFillNumeric,
          constantFillCategorical: cfg.constantFillCategorical,
          globalAdvancedParams,
          hasNegativeValues: columnProfile?.column_distribution?.[column.name]?.has_non_positive ?? false,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featureColumns, preprocessing.columns, preprocessing.defaults, globalAdvancedParams, columnProfile]
  );

  const localIssues = useMemo(() => validateLocal(toValidationRows(baseRows), capabilities), [baseRows, capabilities]);

  const { serverResult, isValidating, lastValidatedAt, validationError } = useDebouncedValidation({
    projectId,
    config,
    enabled:
      serverValidationEnabled &&
      Boolean(String(projectId ?? "").trim()) &&
      Boolean(String(config.datasetVersionId ?? "").trim()) &&
      Boolean(String(config.targetColumn ?? "").trim()) &&
      featureColumns.length > 0,
    delayMs: SERVER_VALIDATION_DEBOUNCE_MS,
  });

  const serverIssues = useMemo(() => {
    const base = toServerIssueBuckets(serverResult, baseRows.map((r) => r.columnName));
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
          ...row,
          issues: mergedIssues.columnIssues[row.columnName] ?? [],
          errorCount: perColumnCounts.errors,
          warningCount: perColumnCounts.warnings,
          status: (perColumnCounts.errors > 0 ? "error" : perColumnCounts.warnings > 0 ? "warning" : "ok") as "error" | "warning" | "ok",
        };
      }),
    [baseRows, columnCounts, mergedIssues.columnIssues]
  );

  const rowsByName = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.columnName, row])),
    [rows]
  );

  const selectedColumnNames = useMemo(
    () => [...selectedColumns].filter((name) => rowsByName[name]),
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

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, typeFilter]);

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

  // ── Preprocessing updaters ────────────────────────────────────────────────

  const setPreprocessing = (next: TrainingPreprocessingConfig) => onConfigChange({ preprocessing: next });

  const setDefaultValue = <K extends keyof TrainingPreprocessingDefaults>(
    key: K,
    value: TrainingPreprocessingDefaults[K]
  ) => setPreprocessing({ ...preprocessing, defaults: { ...preprocessing.defaults, [key]: value } });

  const setAdvancedParams = (params: TrainingPreprocessingAdvancedParams) =>
    setPreprocessing({ ...preprocessing, advancedParams: params });

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

  // ── Bulk action handlers ──────────────────────────────────────────────────

  const applyDefaultsToSelected = () => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) {
      const current = nextColumns[name] ?? {};
      const updated = cleanColumnConfig({
        ...current, use: current.use ?? true,
        numericImputation: preprocessing.defaults.numericImputation,
        numericPowerTransform: preprocessing.defaults.numericPowerTransform,
        numericScaling: preprocessing.defaults.numericScaling,
        categoricalImputation: preprocessing.defaults.categoricalImputation,
        categoricalEncoding: preprocessing.defaults.categoricalEncoding,
      });
      if (updated) nextColumns[name] = updated; else delete nextColumns[name];
    }
    withBulkSnapshot(nextColumns);
  };

  const resetSelectedColumns = () => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) delete nextColumns[name];
    withBulkSnapshot(nextColumns);
  };

  const setUseForSelected = (use: boolean) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) {
      const updated = cleanColumnConfig({ ...(nextColumns[name] ?? {}), use });
      if (updated) nextColumns[name] = updated; else delete nextColumns[name];
    }
    withBulkSnapshot(nextColumns);
  };

  const setTypeForSelected = (type: TrainingColumnTypeSelection) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) {
      const row = rowsByName[name];
      const next = { ...(nextColumns[name] ?? {}) };
      if (type === "auto") delete next.type; else next.type = type;
      const updated = cleanColumnConfig(next);
      if (updated) nextColumns[name] = updated; else delete nextColumns[name];
    }
    withBulkSnapshot(nextColumns);
  };

  const setEncodingForSelected = (encoding: TrainingPreprocessingDefaults["categoricalEncoding"]) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) {
      if (rowsByName[name]?.effectiveType === "numeric") continue;
      const next = { ...(nextColumns[name] ?? {}), categoricalEncoding: encoding };
      const updated = cleanColumnConfig(next);
      if (updated) nextColumns[name] = updated; else delete nextColumns[name];
    }
    withBulkSnapshot(nextColumns);
  };

  // ── Derived callbacks ─────────────────────────────────────────────────────

  const resetFilters = () => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); };

  const clearSelection = () => setSelectedColumns(new Set());

  const selectAllFiltered = () =>
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      for (const row of filteredRows) next.add(row.columnName);
      return next;
    });

  const toggleSelected = (columnName: string, checked: boolean) =>
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(columnName); else next.delete(columnName);
      return next;
    });

  const toggleExpanded = (columnName: string) =>
    setExpandedIssueRows((prev) => {
      const next = new Set(prev);
      if (next.has(columnName)) next.delete(columnName); else next.add(columnName);
      return next;
    });

  const undoBulk = () => {
    if (!lastBulkSnapshotRef.current) return;
    const snapshot = lastBulkSnapshotRef.current;
    lastBulkSnapshotRef.current = null;
    setPreprocessing(snapshot);
  };

  const registerRowRef = (columnName: string, node: HTMLTableRowElement | null) => {
    rowRefs.current[columnName] = node;
  };

  const pageNext = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const pagePrev = () => setCurrentPage((prev) => Math.max(1, prev - 1));

  const applyGlobalDefaults = (
    powerTransform: TrainingPreprocessingDefaults["numericPowerTransform"],
    scaling: TrainingPreprocessingDefaults["numericScaling"],
    imputation: TrainingPreprocessingDefaults["numericImputation"]
  ) => {
    setDefaultValue("numericPowerTransform", powerTransform);
    setDefaultValue("numericScaling", scaling);
    setDefaultValue("numericImputation", imputation);
  };

  const applyPerColumn = (
    configs: Record<string, {
      numericPowerTransform?: TrainingPreprocessingDefaults["numericPowerTransform"];
      numericScaling?: TrainingPreprocessingDefaults["numericScaling"];
      numericImputation?: TrainingPreprocessingDefaults["numericImputation"];
    }>
  ) => {
    const nextColumns = { ...preprocessing.columns };
    for (const [name, cfg] of Object.entries(configs)) {
      const updated = cleanColumnConfig({ ...(nextColumns[name] ?? {}), ...cfg });
      if (updated) nextColumns[name] = updated; else delete nextColumns[name];
    }
    setPreprocessing({ ...preprocessing, columns: nextColumns });
  };

  const navigateToIssue = (columnName: string) => {
    if (!filteredRows.some((r) => r.columnName === columnName)) {
      setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all");
    }
    const rowIndex = rows.findIndex((r) => r.columnName === columnName);
    if (rowIndex >= 0 && rows.length > 200) setCurrentPage(Math.floor(rowIndex / PAGE_SIZE) + 1);
    setExpandedIssueRows((prev) => new Set(prev).add(columnName));
    window.setTimeout(
      () => rowRefs.current[columnName]?.scrollIntoView({ behavior: "smooth", block: "center" }),
      40
    );
  };

  return {
    loadingColumns,
    rows,
    visibleRows,
    filteredRows,
    selectedColumns,
    expandedIssueRows,
    counts,
    issuesList,
    options,
    serverResult,
    preprocessing,
    isValidating,
    lastValidatedAt,
    validationError,
    searchQuery,
    statusFilter,
    typeFilter,
    currentPage,
    totalPages,
    shouldPaginate,
    canUndo: Boolean(lastBulkSnapshotRef.current),
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
    resetFilters,
    clearSelection,
    selectAllFiltered,
    toggleSelected,
    toggleExpanded,
    undoBulk,
    registerRowRef,
    pageNext,
    pagePrev,
    applyDefaultsToSelected,
    resetSelectedColumns,
    setUseForSelected,
    setTypeForSelected,
    setEncodingForSelected,
    setDefaultValue,
    setAdvancedParams,
    updateColumnConfig,
    setColumnProfile,
    applyGlobalDefaults,
    applyPerColumn,
    navigateToIssue,
  };
}
