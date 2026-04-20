/**
 * useNettoyageState — tous les useState de NettoyagePage regroupés par domaine.
 * RÈGLE : state et setter ne sont JAMAIS séparés dans deux fichiers différents.
 */
import { useState } from "react";

import type { ColumnMeta, ColumnKind } from "@/services/dataService";
import type { ProcessingOperation } from "@/types";
import type { DatasetOut as DatasetListItem } from "@/services/datasetService";

// ── Small utils (needed only for derived column-selection helpers) ─────────────
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function intersectSelection(selected: string[], allowed: string[]) {
  const set = new Set(allowed);
  return selected.filter((c) => set.has(c));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useNettoyageState() {
  // ── Dataset / version selection ───────────────────────────────────────────
  const [versionMeta, setVersionMeta] = useState<{
    id: number;
    name: string;
    createdAt: string | null;
    operations: string[];
  } | null>(null);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [workspaceDatasetId, setWorkspaceDatasetId] = useState<number | null>(null);

  // ── Data content (all refreshed together by refreshProcessing) ────────────
  const [operations, setOperations] = useState<ProcessingOperation[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [dtypes, setDtypes] = useState<Record<string, string>>({});
  const [columnMetaMap, setColumnMetaMap] = useState<Record<string, ColumnMeta>>({});

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [totalRows, setTotalRows] = useState(0);

  // ── Loading flags ─────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingDataset, setIsSwitchingDataset] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingProcessed, setIsSavingProcessed] = useState(false);

  // ── Op timeline ───────────────────────────────────────────────────────────
  const [selectedOp, setSelectedOp] = useState<ProcessingOperation | null>(null);

  // ── Target column ─────────────────────────────────────────────────────────
  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [isTargetLoaded, setIsTargetLoaded] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTarget, setTempTarget] = useState<string>("");
  const [promptedTargetForDatasetId, setPromptedTargetForDatasetId] = useState<number | null>(null);

  // ── Column selection ──────────────────────────────────────────────────────
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // ── Cleaning modals ───────────────────────────────────────────────────────
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameText, setRenameText] = useState<string>("{\n  \"OldName\": \"new_name\"\n}");
  const [dupKeep, setDupKeep] = useState<"first" | "last">("first");

  // ── Save version modal ────────────────────────────────────────────────────
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState("");

  // ── Schema / kind overrides ───────────────────────────────────────────────
  const [kindOverrides, setKindOverrides] = useState<Record<string, ColumnKind>>({});
  const [verifiedCategorical, setVerifiedCategorical] = useState<Set<string>>(new Set());
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<Set<string>>(new Set());
  const [alertsOpen, setAlertsOpen] = useState(false);

  // ── Inspector modal ───────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectedCol, setInspectedCol] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"overview" | "distribution" | "type">("overview");

  // ── Substitution modal ────────────────────────────────────────────────────
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substColumn, setSubstColumn] = useState<string>("");
  const [substFrom, setSubstFrom] = useState<string>("");
  const [substTo, setSubstTo] = useState<string>("");
  const [substCaseSensitive, setSubstCaseSensitive] = useState(true);
  const [substTreatFromAsNull, setSubstTreatFromAsNull] = useState(false);
  const [substTreatToAsNull, setSubstTreatToAsNull] = useState(false);

  // ── Derived column-selection helpers (only use setSelectedColumns) ─────────
  const toggleColumn = (col: string) =>
    setSelectedColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  const resetSelections = () => setSelectedColumns([]);
  const sanitizeSelections = (allowedCols: string[]) =>
    setSelectedColumns((prev) => uniq(intersectSelection(prev, allowedCols)));

  return {
    // dataset / version
    versionMeta, setVersionMeta,
    datasets, setDatasets,
    activeDatasetId, setActiveDatasetId,
    workspaceDatasetId, setWorkspaceDatasetId,
    // data content
    operations, setOperations,
    previewRows, setPreviewRows,
    columns, setColumns,
    dtypes, setDtypes,
    columnMetaMap, setColumnMetaMap,
    // pagination
    page, setPage,
    pageSize,
    totalRows, setTotalRows,
    // loading
    isLoading, setIsLoading,
    isSwitchingDataset, setIsSwitchingDataset,
    isDownloading, setIsDownloading,
    isSavingProcessed, setIsSavingProcessed,
    // op timeline
    selectedOp, setSelectedOp,
    // target
    targetColumn, setTargetColumn,
    isTargetLoaded, setIsTargetLoaded,
    showTargetModal, setShowTargetModal,
    tempTarget, setTempTarget,
    promptedTargetForDatasetId, setPromptedTargetForDatasetId,
    // column selection
    selectedColumns, setSelectedColumns,
    toggleColumn, resetSelections, sanitizeSelections,
    // cleaning modals
    showRenameModal, setShowRenameModal,
    renameText, setRenameText,
    dupKeep, setDupKeep,
    // save version
    showSaveNameModal, setShowSaveNameModal,
    saveVersionName, setSaveVersionName,
    // schema
    kindOverrides, setKindOverrides,
    verifiedCategorical, setVerifiedCategorical,
    dismissedAlertKeys, setDismissedAlertKeys,
    alertsOpen, setAlertsOpen,
    // inspector
    inspectorOpen, setInspectorOpen,
    inspectedCol, setInspectedCol,
    inspectorTab, setInspectorTab,
    // substitution
    showSubstitutionModal, setShowSubstitutionModal,
    substColumn, setSubstColumn,
    substFrom, setSubstFrom,
    substTo, setSubstTo,
    substCaseSensitive, setSubstCaseSensitive,
    substTreatFromAsNull, setSubstTreatFromAsNull,
    substTreatToAsNull, setSubstTreatToAsNull,
  };
}

export type NettoyageState = ReturnType<typeof useNettoyageState>;
