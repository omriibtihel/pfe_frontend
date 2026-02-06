// src/pages/ProcessingPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Settings2,
  Eraser,
  Calculator,
  BarChart2,
  Binary,
  Layers,
  Target,
  Clock,
  Save,
  Download,
  Undo2,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

import dataService from "@/services/dataService";
import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import apiClient from "@/services/apiClient";

import { ProcessingOperation } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const imputationMethods = [
  { value: "mean", label: "Moyenne" },
  { value: "median", label: "Médiane" },
  { value: "mode", label: "Mode" },
  { value: "constant", label: "Constante" },
  { value: "KNNImputer", label: "KNN Imputer" },
];

const normalizationMethods = [
  { value: "StandardScaler", label: "StandardScaler" },
  { value: "RobustScaler", label: "RobustScaler" },
  { value: "MinMaxScaler", label: "MinMaxScaler (0-1)" },
];

function intersectSelection(selected: string[], allowed: string[]) {
  const set = new Set(allowed);
  return selected.filter((c) => set.has(c));
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function asNonEmptyArray(cols: string[]) {
  return (cols ?? []).filter(Boolean);
}
function normalizeDType(dt?: string) {
  return (dt ?? "").toLowerCase();
}
function looksNumericDType(dt?: string) {
  const s = normalizeDType(dt);
  return (
    s.includes("int") ||
    s.includes("float") ||
    s.includes("double") ||
    s.includes("number") ||
    s.includes("numeric") ||
    s.includes("uint") ||
    s.includes("bool")
  );
}
function parseConstantValue(raw: string) {
  const t = (raw ?? "").trim();
  if (t === "") return "";
  const n = Number(t);
  if (Number.isFinite(n) && /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(t)) return n;
  return t;
}
function getOpResult(op: any) {
  return op?.result ?? op?.params?.__result ?? null;
}
function formatVal(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

type OpKind = "cleaning" | "imputation" | "normalization" | "encoding" | "other";

const ColumnSelector = ({
  columns,
  selectedColumns,
  onToggle,
  label = "Colonnes cibles",
}: {
  columns: string[];
  selectedColumns: string[];
  onToggle: (col: string) => void;
  label?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5" />
            {label} {selectedColumns.length > 0 && `(${selectedColumns.length})`}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-1 pt-2">
        <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border border-border p-2 bg-muted/30">
          {columns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Aucune colonne</p>
          ) : (
            columns.map((col) => (
              <label
                key={col}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-sm transition-colors"
              >
                <Checkbox
                  checked={selectedColumns.includes(col)}
                  onCheckedChange={() => onToggle(col)}
                  className="h-3.5 w-3.5"
                />
                <span className="truncate">{col}</span>
              </label>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export function ProcessingPage() {
  const { id } = useParams();
  const projectId = id!;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const mode = useMemo(() => {
    const m = (searchParams.get("mode") ?? "").toLowerCase();
    return m === "edit" ? "edit" : "view";
  }, [searchParams]);

  const versionId = useMemo(() => {
    const raw = searchParams.get("version");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const isSnapshotView = Boolean(versionId) && mode === "view";
  const isEditingVersion = Boolean(versionId) && mode === "edit";

  const [versionMeta, setVersionMeta] = useState<{
    id: number;
    name: string;
    createdAt: string | null;
    operations: string[];
  } | null>(null);

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);

  const [workspaceDatasetId, setWorkspaceDatasetId] = useState<number | null>(null);

  const effectiveDatasetId = useMemo(() => {
    if (isEditingVersion) return workspaceDatasetId;
    return activeDatasetId;
  }, [isEditingVersion, workspaceDatasetId, activeDatasetId]);

  const [operations, setOperations] = useState<ProcessingOperation[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [dtypes, setDtypes] = useState<Record<string, string>>({});

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingDataset, setIsSwitchingDataset] = useState(false);

  const [selectedOp, setSelectedOp] = useState<ProcessingOperation | null>(null);

  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [isTargetLoaded, setIsTargetLoaded] = useState(false);

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTarget, setTempTarget] = useState<string>("");
  const [promptedTargetForDatasetId, setPromptedTargetForDatasetId] = useState<number | null>(null);

  const [cleaningColumns, setCleaningColumns] = useState<string[]>([]);
  const [imputationColumns, setImputationColumns] = useState<string[]>([]);
  const [normalizationColumns, setNormalizationColumns] = useState<string[]>([]);
  const [encodingColumns, setEncodingColumns] = useState<string[]>([]);
  const [otherColumns, setOtherColumns] = useState<string[]>([]);

  const [selectedImputationMethod, setSelectedImputationMethod] = useState<string | null>(null);
  const [constantValue, setConstantValue] = useState<string>("");

  const [knnNeighbors, setKnnNeighbors] = useState<number>(5);
  const [knnWeights, setKnnWeights] = useState<"uniform" | "distance">("uniform");
  const [knnAddIndicator, setKnnAddIndicator] = useState(false);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingProcessed, setIsSavingProcessed] = useState(false);

  const requestTokenRef = useRef(0);

  const disablePreview = isLoading || isSwitchingDataset || (!effectiveDatasetId && !isSnapshotView);

  const disableProcessingActions =
    isLoading || isSwitchingDataset || !effectiveDatasetId || isSnapshotView;

  const toggleColumn = (col: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const resetSelections = () => {
    setCleaningColumns([]);
    setImputationColumns([]);
    setNormalizationColumns([]);
    setEncodingColumns([]);
    setOtherColumns([]);
    setSelectedImputationMethod(null);
    setConstantValue("");
    setKnnNeighbors(5);
    setKnnWeights("uniform");
    setKnnAddIndicator(false);
  };

  const sanitizeSelections = (allowedCols: string[]) => {
    setCleaningColumns((prev) => uniq(intersectSelection(prev, allowedCols)));
    setImputationColumns((prev) => uniq(intersectSelection(prev, allowedCols)));
    setNormalizationColumns((prev) => uniq(intersectSelection(prev, allowedCols)));
    setEncodingColumns((prev) => uniq(intersectSelection(prev, allowedCols)));
    setOtherColumns((prev) => uniq(intersectSelection(prev, allowedCols)));
  };

  const getSelectedCols = (kind: OpKind): string[] => {
    switch (kind) {
      case "cleaning":
        return cleaningColumns;
      case "imputation":
        return imputationColumns;
      case "normalization":
        return normalizationColumns;
      case "encoding":
        return encodingColumns;
      case "other":
        return otherColumns;
      default:
        return [];
    }
  };

  const fetchTarget = async (datasetId: number) => {
    try {
      const t = await apiClient.get<{ target_column: string | null }>(
        `/projects/${projectId}/datasets/${datasetId}/target`
      );
      return { ok: true as const, target: (t?.target_column ?? null) as string | null };
    } catch {
      return { ok: false as const, target: null as string | null };
    }
  };

  const refreshProcessing = async (datasetId: number, nextPage = page) => {
    const token = ++requestTokenRef.current;

    const [ops, preview, tgt] = await Promise.all([
      dataService.getOperations(projectId, datasetId),
      dataService.getProcessingPreview(projectId, datasetId, nextPage, pageSize),
      fetchTarget(datasetId),
    ]);

    if (token !== requestTokenRef.current) return;

    const cols = preview.columns ?? [];
    setOperations(ops as any);
    setColumns(cols);
    setDtypes(preview.dtypes ?? {});
    setPreviewRows(preview.rows ?? []);
    setPage(preview.page ?? nextPage);
    setTotalRows(preview.total_rows ?? 0);

    sanitizeSelections(cols);

    setTargetColumn(tgt.ok ? tgt.target : null);
    setIsTargetLoaded(tgt.ok);
  };

  const refreshVersion = async (vid: number, nextPage = page) => {
    const token = ++requestTokenRef.current;

    const preview = await dataService.getVersionPreview(projectId, vid, nextPage, pageSize);

    if (token !== requestTokenRef.current) return;

    const cols = preview.columns ?? [];
    setOperations([]);
    setColumns(cols);
    setDtypes(preview.dtypes ?? {});
    setPreviewRows(preview.rows ?? []);
    setPage(preview.page ?? nextPage);
    setTotalRows(preview.total_rows ?? 0);

    sanitizeSelections(cols);

    setTargetColumn(null);
    setIsTargetLoaded(true);
  };

  const loadVersionMeta = async (vid: number) => {
    try {
      const all = await dataService.getVersions(projectId);
      const v = (all as any[])?.find((x) => x.id === vid) ?? null;
      setVersionMeta(
        v
          ? {
              id: v.id,
              name: v.name ?? `Version #${vid}`,
              createdAt: v.createdAt ?? null,
              operations: Array.isArray(v.operations) ? v.operations : [],
            }
          : null
      );
    } catch {
      setVersionMeta(null);
    }
  };

  useEffect(() => {
    if (isSnapshotView) return;
    if (isEditingVersion) return;
    if (isLoading || isSwitchingDataset) return;
    if (!effectiveDatasetId) return;
    if (!columns.length) return;
    if (!isTargetLoaded) return;

    if (!targetColumn && promptedTargetForDatasetId !== effectiveDatasetId) {
      setTempTarget("");
      setShowTargetModal(true);
      setPromptedTargetForDatasetId(effectiveDatasetId);
    }
  }, [
    isSnapshotView,
    isEditingVersion,
    isLoading,
    isSwitchingDataset,
    effectiveDatasetId,
    columns.length,
    targetColumn,
    promptedTargetForDatasetId,
    isTargetLoaded,
  ]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const list = await datasetService.list(projectId);
        if (!mounted) return;

        setDatasets(list);

        const active = await datasetService.getActive(projectId).catch(() => ({ active_dataset_id: null }));
        let chosen: number | null = active.active_dataset_id ?? null;

        if (chosen && !list.some((d) => d.id === chosen)) chosen = null;

        if (!chosen) {
          chosen = list?.[0]?.id ?? null;
          if (chosen) await datasetService.setActive(projectId, chosen).catch(() => {});
        }

        setActiveDatasetId(chosen);

        if (versionId && isSnapshotView) {
          resetSelections();
          setTargetColumn(null);
          setIsTargetLoaded(true);
          setWorkspaceDatasetId(null);
          await loadVersionMeta(versionId);
          await refreshVersion(versionId, 1);
          return;
        }

        if (versionId && isEditingVersion) {
          resetSelections();
          setTargetColumn(null);
          setIsTargetLoaded(true);
          setPromptedTargetForDatasetId(null);

          await loadVersionMeta(versionId);

          try {
            const ws = await dataService.getOrCreateVersionWorkspace(projectId, versionId);
            const wsId = (ws as any)?.workspace_dataset_id as number;

            setWorkspaceDatasetId(wsId);
            await refreshProcessing(wsId, 1);

            toast({
              title: "Workspace prêt",
              description: "Prétraitement isolé : aucune autre version ne sera affectée.",
            });
          } catch (e) {
            setWorkspaceDatasetId(null);
            // fallback: au moins preview version
            await refreshVersion(versionId, 1);
            toast({
              title: "Erreur workspace",
              description: (e as Error).message ?? "Impossible de créer le workspace.",
              variant: "destructive",
            });
          }
          return;
        }

        if (chosen) {
          setVersionMeta(null);
          setWorkspaceDatasetId(null);
          resetSelections();
          setTargetColumn(null);
          setIsTargetLoaded(false);
          await refreshProcessing(chosen, 1);
        } else {
          setVersionMeta(null);
          setWorkspaceDatasetId(null);
          setTargetColumn(null);
          setIsTargetLoaded(false);
        }
      } catch (e) {
        toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, versionId, isSnapshotView, isEditingVersion]);

  const totalPages = useMemo(() => {
    if (!totalRows) return 1;
    return Math.max(1, Math.ceil(totalRows / pageSize));
  }, [totalRows, pageSize]);

  const tableColumns = useMemo(() => columns.map((c) => ({ key: c, header: c })), [columns]);

  const runOperation = async (kind: OpKind, description: string, params: Record<string, any> = {}) => {
    if (!effectiveDatasetId) {
      toast({
        title: "Choisir un dataset",
        description: "Sélectionne un dataset avant d'appliquer une opération.",
        variant: "destructive",
      });
      return;
    }
    if (isSnapshotView) return;

    if ((kind === "cleaning" || kind === "other") && (!params?.action || typeof params.action !== "string")) {
      toast({
        title: "Erreur de configuration",
        description: "params.action est obligatoire pour cette opération.",
        variant: "destructive",
      });
      return;
    }

    const operationColumns = getSelectedCols(kind);

    const selected = asNonEmptyArray(operationColumns);
    const safeCols = selected.filter((c) => columns.includes(c));
    const removed = selected.filter((c) => !columns.includes(c));

    if (removed.length) {
      toast({
        title: "Sélection invalide",
        description: `Colonnes ignorées (autre dataset): ${removed.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (kind === "imputation" && String(params?.method ?? "").toLowerCase() === "knnimputer") {
      const nonNumeric = safeCols.filter((c) => dtypes[c] && !looksNumericDType(dtypes[c]));
      if (nonNumeric.length) {
        toast({
          title: "KNNImputer: colonnes invalides",
          description: `Sélectionne uniquement des colonnes numériques. Problème: ${nonNumeric.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      await dataService.applyOperation(projectId, effectiveDatasetId, {
        type: kind,
        description,
        columns: safeCols,
        params,
      } as any);

      await refreshProcessing(effectiveDatasetId, 1);

      const colInfo = safeCols.length ? ` sur ${safeCols.join(", ")}` : "";
      toast({ title: "Opération appliquée", description: `${description}${colInfo}` });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleUndo = async () => {
    if (!effectiveDatasetId) return;
    if (isSnapshotView) return;

    try {
      await dataService.undoLastOperation(projectId, effectiveDatasetId);
      await refreshProcessing(effectiveDatasetId, 1);
      toast({ title: "Opération annulée" });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
  };

  const applySelectedImputation = async () => {
    if (!selectedImputationMethod) return;
    const m = selectedImputationMethod;

    if (m === "constant") {
      const constant = parseConstantValue(constantValue);
      await runOperation("imputation", `Imputation: constant`, { method: "constant", constant });
      return;
    }

    if (m === "KNNImputer") {
      await runOperation("imputation", `Imputation: KNNImputer`, {
        method: "KNNImputer",
        n_neighbors: knnNeighbors,
        weights: knnWeights,
        add_indicator: knnAddIndicator,
      });
      return;
    }

    await runOperation("imputation", `Imputation: ${m}`, { method: m });
  };

  const triggerBrowserDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadProcessed = async () => {
    if (isSnapshotView) {
      if (!versionId) return;
      setIsDownloading(true);
      try {
        const { blob, filename } = await dataService.downloadVersion(projectId, versionId);
        triggerBrowserDownload(blob, filename ?? `version_${versionId}.csv`);
        toast({ title: "Téléchargement", description: "La version a été téléchargée." });
      } catch (e) {
        toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    if (!effectiveDatasetId) return;

    setIsDownloading(true);
    try {
      const { blob, filename } = await dataService.exportProcessed(projectId, effectiveDatasetId);
      triggerBrowserDownload(blob, filename ?? `dataset_${effectiveDatasetId}_processed.csv`);
      toast({ title: "Téléchargement", description: "Le fichier prétraité a été téléchargé." });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveProcessed = async () => {
    if (!effectiveDatasetId) return;
    if (isSnapshotView) return;

    setIsSavingProcessed(true);
    try {
      if (isEditingVersion && versionId) {
        if (!workspaceDatasetId) {
          toast({
            title: "Workspace introuvable",
            description: "Impossible d’enregistrer sans workspace.",
            variant: "destructive",
          });
          return;
        }

        await dataService.commitVersionWorkspace(projectId, versionId, workspaceDatasetId);

        toast({
          title: "Version mise à jour",
          description: `La version #${versionId} a été écrasée avec les nouvelles données.`,
        });

        navigate(`/projects/${projectId}/processing?mode=view&version=${versionId}`);
        return;
      }

      const out = await dataService.saveProcessedAsVersion(projectId, effectiveDatasetId, {});
      const newVersionId = (out as any)?.version_id ?? (out as any)?.id;

      toast({
        title: "Version enregistrée",
        description: newVersionId
          ? `Version #${newVersionId} ajoutée à l'historique.`
          : "Version ajoutée à l'historique.",
      });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSavingProcessed(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Centre de prétraitement</h1>
            <p className="text-muted-foreground mt-1">
              {isSnapshotView
                ? "Analyse de version (lecture seule)"
                : isEditingVersion
                ? "Prétraitement d'une version (workspace isolé)"
                : "Nettoyez et transformez vos données"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {!isSnapshotView && !isEditingVersion && (
              <Select
                value={activeDatasetId ? String(activeDatasetId) : undefined}
                onValueChange={(v) => setActiveDatasetId(Number(v))}
                disabled={isLoading || datasets.length === 0}
              >
                <SelectTrigger className="w-[320px]">
                  <SelectValue placeholder="Choisir un dataset..." />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={String(ds.id)}>
                      {ds.original_name} (#{ds.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Badge variant="outline">Colonnes: {columns.length}</Badge>
            <Badge variant="outline">
              Page {page}/{totalPages}
            </Badge>

            {isSnapshotView && (
              <Badge variant="secondary">{versionMeta?.name ?? `Version #${versionId}`}</Badge>
            )}

            {isEditingVersion && <Badge variant="secondary">Workspace #{workspaceDatasetId ?? "…"}</Badge>}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadProcessed}
              disabled={isLoading || isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Téléchargement..." : "Télécharger"}
            </Button>

            {isSnapshotView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projects/${projectId}/processing`)}
                disabled={isLoading}
              >
                Revenir au dataset actif
              </Button>
            )}
          </div>
        </div>

        {!isSnapshotView && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="card-hover border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eraser className="h-5 w-5 text-primary" />
                  Nettoyage
                </CardTitle>
                <CardDescription>Gérer les valeurs manquantes et colonnes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={disableProcessingActions}
                  onClick={() =>
                    runOperation("cleaning", "Valeurs manquantes comblées", {
                      action: "fill_missing",
                      strategy: "mode",
                    })
                  }
                >
                  Remplacer valeurs manquantes (mode)
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive"
                  disabled={disableProcessingActions}
                  onClick={() =>
                    runOperation("cleaning", "Colonnes supprimées", {
                      action: "drop_columns",
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer colonnes
                </Button>

                <ColumnSelector
                  key={`clean-${effectiveDatasetId ?? "x"}`}
                  columns={columns}
                  selectedColumns={cleaningColumns}
                  onToggle={(col) => toggleColumn(col, setCleaningColumns)}
                  label="Colonnes cibles"
                />
              </CardContent>
            </Card>

            <Card className="card-hover border-l-4 border-l-secondary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-secondary" />
                  Imputation
                </CardTitle>
                <CardDescription>Remplir les valeurs manquantes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  disabled={disableProcessingActions}
                  value={selectedImputationMethod ?? undefined}
                  onValueChange={(val) => {
                    setSelectedImputationMethod(val);

                    if (val === "mean" || val === "median" || val === "mode") {
                      runOperation("imputation", `Imputation: ${val}`, { method: val });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Méthode..." />
                  </SelectTrigger>
                  <SelectContent>
                    {imputationMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedImputationMethod === "constant" && (
                  <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">Valeur constante à utiliser</p>
                    <Input
                      value={constantValue}
                      onChange={(e) => setConstantValue(e.target.value)}
                      placeholder='Ex: 0 ou "Unknown"'
                      disabled={disableProcessingActions}
                    />
                  </div>
                )}

                {selectedImputationMethod === "KNNImputer" && (
                  <div className="space-y-3 rounded-md border border-border p-3 bg-muted/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">n_neighbors</p>
                        <Input
                          type="number"
                          min={1}
                          value={knnNeighbors}
                          onChange={(e) => setKnnNeighbors(Math.max(1, Number(e.target.value || 1)))}
                          disabled={disableProcessingActions}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">weights</p>
                        <Select
                          value={knnWeights}
                          onValueChange={(v) => setKnnWeights(v === "distance" ? "distance" : "uniform")}
                          disabled={disableProcessingActions}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="uniform">uniform</SelectItem>
                            <SelectItem value="distance">distance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={knnAddIndicator}
                        onCheckedChange={(v) => setKnnAddIndicator(Boolean(v))}
                        disabled={disableProcessingActions}
                      />
                      Ajouter des indicateurs “missing”
                    </label>
                  </div>
                )}

                {(selectedImputationMethod === "constant" || selectedImputationMethod === "KNNImputer") && (
                  <Button
                    className="w-full"
                    disabled={disableProcessingActions || !selectedImputationMethod}
                    onClick={applySelectedImputation}
                  >
                    Appliquer l&apos;imputation
                  </Button>
                )}

                <ColumnSelector
                  key={`imp-${effectiveDatasetId ?? "x"}`}
                  columns={columns}
                  selectedColumns={imputationColumns}
                  onToggle={(col) => toggleColumn(col, setImputationColumns)}
                  label="Colonnes à imputer"
                />
              </CardContent>
            </Card>

            <Card className="card-hover border-l-4 border-l-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart2 className="h-5 w-5 text-accent" />
                  Normalisation
                </CardTitle>
                <CardDescription>Standardiser les échelles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  disabled={disableProcessingActions}
                  onValueChange={(val) =>
                    runOperation("normalization", `Normalisation: ${val}`, {
                      method: val,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Méthode..." />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizationMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ColumnSelector
                  key={`norm-${effectiveDatasetId ?? "x"}`}
                  columns={columns}
                  selectedColumns={normalizationColumns}
                  onToggle={(col) => toggleColumn(col, setNormalizationColumns)}
                  label="Colonnes à normaliser"
                />
              </CardContent>
            </Card>

            <Card className="card-hover border-l-4 border-l-warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Binary className="h-5 w-5 text-warning" />
                  Encodage
                </CardTitle>
                <CardDescription>Convertir les catégories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={disableProcessingActions}
                  onClick={() => runOperation("encoding", "One-Hot Encoding", { method: "onehot" })}
                >
                  One-Hot Encoding
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={disableProcessingActions}
                  onClick={() => runOperation("encoding", "Label Encoding", { method: "label" })}
                >
                  Label Encoding
                </Button>

                <ColumnSelector
                  key={`enc-${effectiveDatasetId ?? "x"}`}
                  columns={columns}
                  selectedColumns={encodingColumns}
                  onToggle={(col) => toggleColumn(col, setEncodingColumns)}
                  label="Colonnes à encoder"
                />
              </CardContent>
            </Card>

            <Card className="card-hover border-l-4 border-l-success">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5 text-success" />
                  Autres
                </CardTitle>
                <CardDescription>Opérations supplémentaires</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={disableProcessingActions}
                  onClick={() => runOperation("other", "Doublons supprimés", { action: "drop_duplicates" })}
                >
                  Supprimer doublons
                </Button>

                <Button variant="outline" className="w-full justify-start" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter colonne (bientôt)
                </Button>

                <ColumnSelector
                  key={`other-${effectiveDatasetId ?? "x"}`}
                  columns={columns}
                  selectedColumns={otherColumns}
                  onToggle={(col) => toggleColumn(col, setOtherColumns)}
                  label="Colonnes concernées"
                />
              </CardContent>
            </Card>

            <Card className="card-hover bg-gradient-to-br from-muted/50 to-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings2 className="h-5 w-5" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleUndo}
                  disabled={disableProcessingActions || operations.length === 0}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Annuler dernière
                </Button>

                <Button
                  className="w-full bg-gradient-to-r from-primary to-secondary"
                  disabled={disableProcessingActions || isSavingProcessed}
                  onClick={handleSaveProcessed}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingProcessed ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Aperçu des données</CardTitle>
                    <CardDescription>
                      {totalRows ? `${totalRows} lignes` : "—"} • Page {page}/{totalPages}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={disablePreview || page <= 1}
                      onClick={() => {
                        const next = Math.max(1, page - 1);
                        if (isSnapshotView && versionId) {
                          refreshVersion(versionId, next);
                          return;
                        }
                        if (!effectiveDatasetId) return;
                        refreshProcessing(effectiveDatasetId, next);
                      }}
                    >
                      Précédent
                    </Button>

                    <Button
                      variant="outline"
                      disabled={disablePreview || page >= totalPages}
                      onClick={() => {
                        const next = Math.min(totalPages, page + 1);
                        if (isSnapshotView && versionId) {
                          refreshVersion(versionId, next);
                          return;
                        }
                        if (!effectiveDatasetId) return;
                        refreshProcessing(effectiveDatasetId, next);
                      }}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[900px]">
                    <DataTable data={previewRows} columns={tableColumns} pageSize={pageSize} />
                  </div>
                </div>

                {columns.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Astuce: scrolle horizontalement pour voir toutes les colonnes.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isSnapshotView ? (
                (versionMeta?.operations?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune opération</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {versionMeta?.operations.map((op, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {op}
                      </Badge>
                    ))}
                  </div>
                )
              ) : operations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune opération</p>
              ) : (
                <div className="space-y-3">
                  {operations.map((op, i) => {
                    const cols = (op.columns ?? []).filter(Boolean);
                    const r = getOpResult(op);

                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setSelectedOp(op)}
                        className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors flex items-start gap-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium shrink-0">
                          {i + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium truncate">{op.description}</p>
                            <Badge variant="secondary" className="shrink-0">
                              {op.op_type}
                            </Badge>
                            {r ? (
                              <Badge variant="outline" className="shrink-0">
                                détails
                              </Badge>
                            ) : null}
                          </div>

                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(op.created_at).toLocaleString("fr-FR")}
                          </p>

                          {cols.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              Colonnes: {cols.join(", ")}
                            </p>
                          )}
                        </div>

                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1 rotate-[-90deg]" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Op Details modal  */}
      <Modal
        isOpen={!!selectedOp}
        onClose={() => setSelectedOp(null)}
        title="Détails de l'opération"
        size="xl"
      >
        {selectedOp ? (() => {
          const r = getOpResult(selectedOp);
          const cols = (selectedOp.columns ?? []).filter(Boolean);

          return (
            // ✅ make modal content fit the screen + scroll
            <div className="max-h-[80vh] overflow-y-auto pr-1">
              <div className="space-y-4">
                {/* header badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedOp.op_type}</Badge>
                  <Badge variant="outline">
                    {new Date(selectedOp.created_at).toLocaleString("fr-FR")}
                  </Badge>
                  {cols.length > 0 ? <Badge variant="outline">{cols.length} colonne(s)</Badge> : null}
                </div>

                {/* description + columns */}
                <div>
                  <p className="text-sm font-medium">{selectedOp.description}</p>
                  {cols.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Colonnes ciblées:{" "}
                      <span className="font-medium text-foreground">{cols.join(", ")}</span>
                    </p>
                  )}
                </div>

                {r ? (
                  <>
                    {/* summary badges */}
                    <div className="flex flex-wrap gap-2">
                      {r.before_shape?.rows != null && r.after_shape?.rows != null ? (
                        <Badge variant="outline">
                          Lignes: {r.before_shape.rows} → {r.after_shape.rows}
                        </Badge>
                      ) : null}

                      {r.before_shape?.cols != null && r.after_shape?.cols != null ? (
                        <Badge variant="outline">
                          Colonnes: {r.before_shape.cols} → {r.after_shape.cols}
                        </Badge>
                      ) : null}

                      {Array.isArray(r.columns_added) && r.columns_added.length ? (
                        <Badge variant="outline">+ {r.columns_added.length} colonnes</Badge>
                      ) : null}

                      {Array.isArray(r.columns_removed) && r.columns_removed.length ? (
                        <Badge variant="outline">- {r.columns_removed.length} colonnes</Badge>
                      ) : null}

                      {typeof r.rows_removed === "number" && r.rows_removed !== 0 ? (
                        <Badge variant="outline">{r.rows_removed} lignes supprimées</Badge>
                      ) : null}

                      {typeof r.rows_added === "number" && r.rows_added !== 0 ? (
                        <Badge variant="outline">{r.rows_added} lignes ajoutées</Badge>
                      ) : null}
                    </div>

                    {/* replacement strategy (ex: fill_missing) */}
                    {r.fill_strategy ? (
                      <div className="rounded-md border border-border p-3 bg-muted/30 space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Remplacement des valeurs manquantes
                          </p>
                          <p className="text-sm">
                            Stratégie: <b>{String(r.fill_strategy)}</b>
                          </p>
                        </div>

                        {r.fill_value_by_column ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Valeur utilisée (par colonne)
                            </p>
                            <div className="text-sm space-y-1">
                              {Object.entries(r.fill_value_by_column).map(([c, v]) => (
                                <p key={c}>
                                  <b>{c}</b>: {formatVal(v)}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {r.fill_value != null ? (
                          <div className="text-sm">
                            Valeur: <b>{formatVal(r.fill_value)}</b>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* affected columns */}
                    {(Array.isArray(r.columns_transformed) && r.columns_transformed.length) ||
                    (Array.isArray(r.columns_added) && r.columns_added.length) ||
                    (Array.isArray(r.columns_removed) && r.columns_removed.length) ? (
                      <div className="rounded-md border border-border p-3 bg-muted/30 space-y-3">
                        <p className="text-sm font-medium">Colonnes affectées</p>

                        {Array.isArray(r.columns_transformed) && r.columns_transformed.length ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Transformées</p>
                            <div className="flex flex-wrap gap-2">
                              {r.columns_transformed.map((c: string) => (
                                <Badge key={c} variant="outline" className="text-xs">
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {Array.isArray(r.columns_added) && r.columns_added.length ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Ajoutées</p>
                            <div className="flex flex-wrap gap-2">
                              {r.columns_added.slice(0, 60).map((c: string) => (
                                <Badge key={c} variant="secondary" className="text-xs">
                                  + {c}
                                </Badge>
                              ))}
                            </div>
                            {r.columns_added.length > 60 ? (
                              <p className="text-xs text-muted-foreground mt-2">
                                {r.columns_added.length - 60} autres colonnes ajoutées…
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {Array.isArray(r.columns_removed) && r.columns_removed.length ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Supprimées</p>
                            <div className="flex flex-wrap gap-2">
                              {r.columns_removed.slice(0, 60).map((c: string) => (
                                <Badge key={c} variant="destructive" className="text-xs">
                                  - {c}
                                </Badge>
                              ))}
                            </div>
                            {r.columns_removed.length > 60 ? (
                              <p className="text-xs text-muted-foreground mt-2">
                                {r.columns_removed.length - 60} autres colonnes supprimées…
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* per-column table */}
                    {r.per_column ? (
                      <div className="rounded-md border border-border overflow-hidden">
                        <div className="px-3 py-2 bg-muted/40">
                          <p className="text-sm font-medium">Impact par colonne</p>
                          <p className="text-xs text-muted-foreground">
                            filled = NaN remplis, changed = valeurs modifiées
                          </p>
                        </div>

                        <div className="p-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="text-left py-2 pr-3">Colonne</th>
                                <th className="text-right py-2 px-3">Missing (avant)</th>
                                <th className="text-right py-2 px-3">Missing (après)</th>
                                <th className="text-right py-2 px-3">Filled</th>
                                <th className="text-right py-2 pl-3">Changed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(r.per_column).map(([c, info]: any) => (
                                <tr key={c} className="border-b border-border last:border-b-0">
                                  <td className="py-2 pr-3 font-medium">{c}</td>
                                  <td className="py-2 px-3 text-right">{info?.missing_before ?? "—"}</td>
                                  <td className="py-2 px-3 text-right">{info?.missing_after ?? "—"}</td>
                                  <td className="py-2 px-3 text-right">{info?.filled ?? "—"}</td>
                                  <td className="py-2 pl-3 text-right">{info?.changed_count ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  // ✅ no debug JSON, just a clean message
                  <div className="rounded-md border border-border p-3 bg-muted/30">
                    <p className="text-sm font-medium">Détails indisponibles</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cette opération ne fournit pas encore de résumé détaillé.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <Button variant="outline" onClick={() => setSelectedOp(null)}>
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </Modal>


    </AppLayout>
  );
}

export default ProcessingPage;
