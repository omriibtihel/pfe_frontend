import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Columns3, Info, SlidersHorizontal, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  TrainingColumnTypeSelection,
  TrainingConfig,
  TrainingPreprocessingColumnConfig,
  TrainingPreprocessingConfig,
  TrainingPreprocessingDefaults,
  TrainingValidationPreviewMode,
  TrainingValidationPreviewSubset,
} from "@/types";
import { DEFAULT_TRAINING_PREPROCESSING } from "@/types";
import {
  createEmptyIssueBuckets,
  toServerIssueBuckets,
  validateLocal,
  type Step3ColumnValidationState,
} from "@/utils/step3Validation";
import { BulkActionsBar } from "./step3/BulkActionsBar";
import { ColumnFilterBar } from "./step3/ColumnFilterBar";
import { ColumnRow } from "./step3/ColumnRow";
import { DefaultsPanel } from "./step3/DefaultsPanel";
import { IssuesPanel } from "./step3/IssuesPanel";
import { PreviewPanel } from "./step3/PreviewPanel";
import {
  cleanColumnConfig,
  clonePreprocessingConfig,
  inferTypeFromDataset,
  normalizePreprocessing,
  parseOrdinalOrder,
  withNoneFirst,
} from "./step3/helpers";
import type {
  Step3ColumnRowData,
  Step3Options,
  Step3StatusFilter,
  Step3TypeFilter,
} from "./step3/types";

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
        if (mounted) setCapabilities(caps.preprocessingCapabilities ?? FALLBACK_PREPROCESSING_CAPABILITIES);
      } catch {
        if (mounted) setCapabilities(FALLBACK_PREPROCESSING_CAPABILITIES);
      }
    };
    loadCapabilities();
    return () => { mounted = false; };
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
    return () => { mounted = false; };
  }, [projectId, config.datasetVersionId]);

  useEffect(() => {
    const valid = new Set(featureColumns.map((col) => col.name));
    setSelectedColumns((prev) => new Set([...prev].filter((name) => valid.has(name))));
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
    if (previewSubset === "val" && !valSubsetAvailable) { setPreviewSubset("train"); return; }
    if (previewSubset === "test" && !testSubsetAvailable) setPreviewSubset("train");
  }, [previewSubset, testSubsetAvailable, valSubsetAvailable]);

  const validateOptions = useMemo(
    () => ({
      include: { preview: true },
      preview: { subset: previewSubset, mode: previewMode, n: previewN, seed: PREVIEW_RANDOM_SEED },
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

  const previewColumns = useMemo(() => {
    const columnsRaw = serverResult?.previewTransformed?.columns;
    if (!Array.isArray(columnsRaw)) return [];
    return columnsRaw.map((v) => String(v ?? ""));
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
    for (const name of selectedColumnNames) {
      const current = nextColumns[name] ?? {};
      const updated = cleanColumnConfig({
        ...current,
        use: current.use ?? true,
        numericImputation: preprocessing.defaults.numericImputation,
        numericScaling: preprocessing.defaults.numericScaling,
        categoricalImputation: preprocessing.defaults.categoricalImputation,
        categoricalEncoding: preprocessing.defaults.categoricalEncoding,
      });
      if (updated) nextColumns[name] = updated;
      else delete nextColumns[name];
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
      if (updated) nextColumns[name] = updated;
      else delete nextColumns[name];
    }
    withBulkSnapshot(nextColumns);
  };

  const setTypeForSelected = (type: TrainingColumnTypeSelection) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) {
      const row = rowsByName[name];
      const next = { ...(nextColumns[name] ?? {}) };
      if (type === "auto") delete next.type;
      else next.type = type;
      if ((type === "auto" ? row?.inferredType : type) !== "ordinal") delete next.ordinalOrder;
      const updated = cleanColumnConfig(next);
      if (updated) nextColumns[name] = updated;
      else delete nextColumns[name];
    }
    withBulkSnapshot(nextColumns);
  };

  const setEncodingForSelected = (encoding: TrainingPreprocessingDefaults["categoricalEncoding"]) => {
    if (!selectedColumnNames.length) return;
    const nextColumns = { ...preprocessing.columns };
    for (const name of selectedColumnNames) {
      if (rowsByName[name]?.effectiveType === "numeric") continue;
      const next = { ...(nextColumns[name] ?? {}), categoricalEncoding: encoding };
      if (encoding !== "ordinal") delete next.ordinalOrder;
      const updated = cleanColumnConfig(next);
      if (updated) nextColumns[name] = updated;
      else delete nextColumns[name];
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
              {[
                { label: "Features", value: rows.length, className: "" },
                { label: "Actives", value: activeRowsCount, className: "text-emerald-700" },
                { label: "Droppees", value: droppedRowsCount, className: "text-amber-700" },
                { label: "Types auto", value: autoTypeRowsCount, className: "" },
                { label: "Types forces", value: manualTypeRowsCount, className: "" },
              ].map(({ label, value, className }) => (
                <div key={label} className="rounded-lg border border-border/60 bg-background/70 p-2">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className={`text-sm font-semibold ${className}`}>{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <DefaultsPanel
        preprocessing={preprocessing}
        options={options}
        onSetDefault={setDefaultValue}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-8">
          <IssuesPanel
            counts={counts}
            issues={issuesList}
            isValidating={isValidating}
            lastValidatedAt={lastValidatedAt}
            validationError={validationError}
            onIssueClick={(columnName) => {
              if (!filteredRows.some((r) => r.columnName === columnName)) {
                setSearchQuery("");
                setStatusFilter("all");
                setTypeFilter("all");
              }
              const rowIndex = rows.findIndex((r) => r.columnName === columnName);
              if (rowIndex >= 0 && rows.length > 200) setCurrentPage(Math.floor(rowIndex / PAGE_SIZE) + 1);
              setExpandedIssueRows((prev) => new Set(prev).add(columnName));
              window.setTimeout(
                () => rowRefs.current[columnName]?.scrollIntoView({ behavior: "smooth", block: "center" }),
                40
              );
            }}
          />
        </div>

        <div className="xl:col-span-4">
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
      </div>

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-secondary/10">
              <Columns3 className="h-4 w-4 text-secondary" />
            </div>
            Preprocessing par colonne
            <Badge variant="outline" className="ml-auto text-xs">use=false (drop)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {counts.errors > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5" />
              <span>Configuration invalide: corrigez les erreurs avant de continuer.</span>
            </div>
          )}

          <ColumnFilterBar
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            statusFilterCounts={statusFilterCounts}
            filteredCount={filteredRows.length}
            totalCount={rows.length}
            filteredSelectedCount={filteredSelectedCount}
            counts={counts}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            onResetFilters={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}
          />

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
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="space-y-0 divide-y divide-border/40">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-4 w-16 shrink-0" />
                    <Skeleton className="h-4 w-4 shrink-0" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16 shrink-0" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              </div>
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
                        {["Status", "Sel.", "Colonne", "Use", "Type", "Imputation", "Scaling / Encoding", "Ordinal order"].map((header, i) => (
                          <TableHead
                            key={header}
                            className={`sticky top-0 z-20 bg-background/95 backdrop-blur ${
                              i === 0 ? "w-20" : i === 1 ? "w-12" : i === 3 ? "w-24" : i === 4 ? "w-44" : i === 5 ? "w-48" : i === 6 ? "w-48" : i === 7 ? "w-56" : ""
                            }`}
                          >
                            {header}
                          </TableHead>
                        ))}
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
                          labelForMethod={(m) => m}
                          onRegisterRowRef={(node) => { rowRefs.current[row.columnName] = node; }}
                          onToggleSelected={(checked) =>
                            setSelectedColumns((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(row.columnName);
                              else next.delete(row.columnName);
                              return next;
                            })
                          }
                          onToggleUse={(checked) =>
                            updateColumnConfig(row.columnName, (c) => ({ ...c, use: checked }))
                          }
                          onTypeChange={(value) =>
                            updateColumnConfig(row.columnName, (c) => {
                              const next = { ...c };
                              if (value === AUTO_TYPE) delete next.type;
                              else next.type = value;
                              if ((next.type ?? row.inferredType) !== "ordinal") delete next.ordinalOrder;
                              return next;
                            })
                          }
                          onNumericImputationChange={(value) =>
                            updateColumnConfig(row.columnName, (c) => ({ ...c, numericImputation: value }))
                          }
                          onCategoricalImputationChange={(value) =>
                            updateColumnConfig(row.columnName, (c) => ({ ...c, categoricalImputation: value }))
                          }
                          onNumericScalingChange={(value) =>
                            updateColumnConfig(row.columnName, (c) => ({ ...c, numericScaling: value }))
                          }
                          onCategoricalEncodingChange={(value) =>
                            updateColumnConfig(row.columnName, (c) => {
                              const next = { ...c, categoricalEncoding: value };
                              if (value !== "ordinal") delete next.ordinalOrder;
                              return next;
                            })
                          }
                          onOrdinalOrderChange={(rawInput) =>
                            updateColumnConfig(row.columnName, (c) => {
                              const parsed = parseOrdinalOrder(rawInput);
                              return { ...c, ordinalOrder: parsed.length ? parsed : undefined };
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
                    type="button" size="sm" variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {currentPage} / {totalPages}</span>
                  <Button
                    type="button" size="sm" variant="outline"
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

      <PreviewPanel
        previewColumns={previewColumns}
        previewRows={previewRows}
        previewMeta={serverResult?.previewMeta as Record<string, unknown> | null | undefined}
        isValidating={isValidating}
        validationError={validationError}
        previewSubset={previewSubset}
        previewMode={previewMode}
        previewN={previewN}
        valSubsetAvailable={valSubsetAvailable}
        testSubsetAvailable={testSubsetAvailable}
        onPreviewSubsetChange={setPreviewSubset}
        onPreviewModeChange={setPreviewMode}
        onPreviewNChange={setPreviewN}
      />
    </div>
  );
}

export default Step3ColumnPreprocessing;
