import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
  // { value: "knn", label: "KNN" }, // si non supporté backend, laisse commenté
];

const normalizationMethods = [
  { value: "minmax", label: "Min-Max (0-1)" },
  { value: "zscore", label: "Z-Score" },
  { value: "robust", label: "Robust Scaler" },
];

// helpers
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

type OpKind = "cleaning" | "imputation" | "normalization" | "encoding" | "other";

function getDatasetTarget(ds: DatasetListItem): string | null {
  const anyDs = ds as any;
  const v = anyDs?.target_column ?? anyDs?.targetColumn ?? null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

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
  const { toast } = useToast();

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const datasetsRef = useRef<DatasetListItem[]>([]);
  useEffect(() => {
    datasetsRef.current = datasets;
  }, [datasets]);

  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);

  const [operations, setOperations] = useState<ProcessingOperation[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [dtypes, setDtypes] = useState<Record<string, string>>({});

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingDataset, setIsSwitchingDataset] = useState(false);

  // Target (optionnel, utile plus tard pour le training)
  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // selections per op kind
  const [cleaningColumns, setCleaningColumns] = useState<string[]>([]);
  const [imputationColumns, setImputationColumns] = useState<string[]>([]);
  const [normalizationColumns, setNormalizationColumns] = useState<string[]>([]);
  const [encodingColumns, setEncodingColumns] = useState<string[]>([]);
  const [otherColumns, setOtherColumns] = useState<string[]>([]);

  // anti race-condition
  const requestTokenRef = useRef(0);

  const disableActions = isLoading || isSwitchingDataset || !activeDatasetId;

  const toggleColumn = (col: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };

  const resetSelections = () => {
    setCleaningColumns([]);
    setImputationColumns([]);
    setNormalizationColumns([]);
    setEncodingColumns([]);
    setOtherColumns([]);
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

  const updateDatasetTargetInList = (datasetId: number, value: string | null) => {
    setDatasets((prev) =>
      prev.map((d) => {
        if (d.id !== datasetId) return d;
        return { ...(d as any), target_column: value } as DatasetListItem;
      })
    );
    // maintient la ref en sync immédiatement (évite stale dans refreshProcessing)
    datasetsRef.current = datasetsRef.current.map((d) =>
      d.id === datasetId ? ({ ...(d as any), target_column: value } as DatasetListItem) : d
    );
  };

  const refreshProcessing = async (datasetId: number, nextPage = page) => {
    const token = ++requestTokenRef.current;

    const [ops, preview] = await Promise.all([
      dataService.getOperations(projectId, datasetId),
      dataService.getProcessingPreview(projectId, datasetId, nextPage, pageSize),
    ]);

    if (token !== requestTokenRef.current) return;

    const cols = preview.columns ?? [];
    setOperations(ops);
    setColumns(cols);
    setDtypes(preview.dtypes ?? {});
    setPreviewRows(preview.rows ?? []);
    setPage(preview.page ?? nextPage);
    setTotalRows(preview.total_rows ?? 0);

    sanitizeSelections(cols);

    // target depuis list
    const ds = datasetsRef.current.find((d) => d.id === datasetId);
    setTargetColumn(ds ? getDatasetTarget(ds) : null);
  };

  // initial load
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const list = await datasetService.list(projectId);
        if (!mounted) return;

        setDatasets(list);
        datasetsRef.current = list;

        const first = list?.[0]?.id ?? null;
        setActiveDatasetId(first);

        if (first) {
          resetSelections();
          const ds = list.find((d) => d.id === first);
          setTargetColumn(ds ? getDatasetTarget(ds) : null);
          await refreshProcessing(first, 1);
        } else {
          setTargetColumn(null);
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
  }, [projectId]);

  const onDatasetChange = async (nextId: number) => {
    setIsSwitchingDataset(true);

    // invalide toutes les réponses en cours
    requestTokenRef.current += 1;

    // reset UI
    setColumns([]);
    setDtypes({});
    setPreviewRows([]);
    setOperations([]);
    setTotalRows(0);
    setPage(1);
    resetSelections();

    setActiveDatasetId(nextId);

    // target immédiat depuis list
    const ds = datasetsRef.current.find((d) => d.id === nextId);
    setTargetColumn(ds ? getDatasetTarget(ds) : null);

    try {
      await refreshProcessing(nextId, 1);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSwitchingDataset(false);
    }
  };

  const saveTarget = async (value: string | null) => {
    if (!activeDatasetId) return;

    setIsSavingTarget(true);
    try {
      const out = await apiClient.putJson<{ target_column: string | null }>(
        `/projects/${projectId}/datasets/${activeDatasetId}/target`,
        { target_column: value }
      );

      const newVal = (out?.target_column ?? value) as string | null;
      setTargetColumn(newVal);
      updateDatasetTargetInList(activeDatasetId, newVal);

      toast({
        title: "Target mis à jour",
        description: newVal ? `Target: ${newVal}` : "Target supprimé",
      });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSavingTarget(false);
    }
  };

  /**
   * IMPORTANT:
   * Ne PAS passer operationColumns en paramètre (stale après switch).
   * On relit la sélection depuis le state au moment du clic.
   */
  const runOperation = async (kind: OpKind, description: string, params: Record<string, any> = {}) => {
    if (!activeDatasetId) {
      toast({
        title: "Choisir un dataset",
        description: "Sélectionne un dataset avant d'appliquer une opération.",
        variant: "destructive",
      });
      return;
    }

    // Cleaning/Other ont besoin d'une action côté backend
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

    try {
      await dataService.applyOperation(projectId, activeDatasetId, {
        type: kind,
        description,
        columns: safeCols,
        params,
      });

      await refreshProcessing(activeDatasetId, 1);

      const colInfo = safeCols.length ? ` sur ${safeCols.join(", ")}` : "";
      toast({ title: "Opération appliquée", description: `${description}${colInfo}` });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleUndo = async () => {
    if (!activeDatasetId) return;

    try {
      await dataService.undoLastOperation(projectId, activeDatasetId);
      await refreshProcessing(activeDatasetId, 1);
      toast({ title: "Opération annulée" });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
  };

  const totalPages = useMemo(() => {
    if (!totalRows) return 1;
    return Math.max(1, Math.ceil(totalRows / pageSize));
  }, [totalRows, pageSize]);

  const tableColumns = useMemo(() => columns.map((c) => ({ key: c, header: c })), [columns]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header + dataset dropdown */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Centre de prétraitement</h1>
            <p className="text-muted-foreground mt-1">Nettoyez et transformez vos données</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Select
              value={activeDatasetId ? String(activeDatasetId) : undefined}
              onValueChange={(v) => onDatasetChange(Number(v))}
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

            <Badge variant="outline">Colonnes: {columns.length}</Badge>
            <Badge variant="outline">
              Page {page}/{totalPages}
            </Badge>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* TARGET */}
          <Card className="card-hover border-l-4 border-l-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5" />
                Target (optionnel)
              </CardTitle>
              <CardDescription>
                Utile plus tard pour le <b>training</b> (classification/régression). Pendant la préparation, ce n&apos;est
                pas obligatoire.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Colonne target</p>
                <Badge variant="outline">{targetColumn ? `Target: ${targetColumn}` : "Aucun target"}</Badge>
              </div>

              <Select
                value={targetColumn ?? "__none__"}
                onValueChange={(v) => saveTarget(v === "__none__" ? null : v)}
                disabled={disableActions || isSavingTarget}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir la target..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {columns.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                On activera le <b>split</b> seulement dans la phase &quot;modèles&quot; pour éviter le data leakage.
              </p>
            </CardContent>
          </Card>

          {/* CLEANING */}
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
                disabled={disableActions}
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
                disabled={disableActions}
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
                key={`clean-${activeDatasetId}`}
                columns={columns}
                selectedColumns={cleaningColumns}
                onToggle={(col) => toggleColumn(col, setCleaningColumns)}
                label="Colonnes cibles"
              />
            </CardContent>
          </Card>

          {/* IMPUTATION */}
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
                disabled={disableActions}
                onValueChange={(val) =>
                  runOperation("imputation", `Imputation: ${val}`, {
                    method: val,
                  })
                }
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

              <ColumnSelector
                key={`imp-${activeDatasetId}`}
                columns={columns}
                selectedColumns={imputationColumns}
                onToggle={(col) => toggleColumn(col, setImputationColumns)}
                label="Colonnes à imputer"
              />
            </CardContent>
          </Card>

          {/* NORMALIZATION */}
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
                disabled={disableActions}
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
                key={`norm-${activeDatasetId}`}
                columns={columns}
                selectedColumns={normalizationColumns}
                onToggle={(col) => toggleColumn(col, setNormalizationColumns)}
                label="Colonnes à normaliser"
              />
            </CardContent>
          </Card>

          {/* ENCODING */}
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
                disabled={disableActions}
                onClick={() =>
                  runOperation("encoding", "One-Hot Encoding", {
                    method: "onehot",
                  })
                }
              >
                One-Hot Encoding
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={disableActions}
                onClick={() =>
                  runOperation("encoding", "Label Encoding", {
                    method: "label",
                  })
                }
              >
                Label Encoding
              </Button>

              <ColumnSelector
                key={`enc-${activeDatasetId}`}
                columns={columns}
                selectedColumns={encodingColumns}
                onToggle={(col) => toggleColumn(col, setEncodingColumns)}
                label="Colonnes à encoder"
              />
            </CardContent>
          </Card>

          {/* OTHER */}
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
                disabled={disableActions}
                onClick={() =>
                  runOperation("other", "Doublons supprimés", {
                    action: "drop_duplicates",
                  })
                }
              >
                Supprimer doublons
              </Button>

              <Button variant="outline" className="w-full justify-start" disabled>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter colonne (bientôt)
              </Button>

              <ColumnSelector
                key={`other-${activeDatasetId}`}
                columns={columns}
                selectedColumns={otherColumns}
                onToggle={(col) => toggleColumn(col, setOtherColumns)}
                label="Colonnes concernées"
              />
            </CardContent>
          </Card>

          {/* Actions */}
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
                disabled={disableActions || operations.length === 0}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Annuler dernière
              </Button>

              <Button variant="outline" className="w-full justify-start" disabled={disableActions}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>

              <Button className="w-full bg-gradient-to-r from-primary to-secondary" disabled={disableActions}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Data Preview + History */}
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
                      disabled={disableActions || page <= 1}
                      onClick={() => {
                        if (!activeDatasetId) return;
                        const next = Math.max(1, page - 1);
                        refreshProcessing(activeDatasetId, next);
                      }}
                    >
                      Précédent
                    </Button>

                    <Button
                      variant="outline"
                      disabled={disableActions || page >= totalPages}
                      onClick={() => {
                        if (!activeDatasetId) return;
                        const next = Math.min(totalPages, page + 1);
                        refreshProcessing(activeDatasetId, next);
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
              {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune opération</p>
              ) : (
                <div className="space-y-3">
                  {operations.map((op, i) => (
                    <div key={op.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{op.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date((op as any).timestamp ?? (op as any).created_at ?? Date.now()).toLocaleTimeString(
                            "fr-FR"
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default ProcessingPage;
