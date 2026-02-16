// src/pages/ProcessingPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Settings2,
  Eraser,
  Save,
  Download,
  Undo2,
  Trash2,
  ChevronDown,
  Type as TypeIcon,
  Layers,
  AlertTriangle,
  Info,
  RefreshCw,
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
import { Textarea } from "@/components/ui/textarea";

import dataService, { ColumnMeta, ColumnKind, CleaningAction } from "@/services/dataService";
import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import apiClient from "@/services/apiClient";
import type { ProcessingOperation } from "@/types";

import { ColumnSelector } from "@/components/processing/ColumnSelector";
import { AlertsModal } from "@/components/processing/AlertsModal";
import { InspectorModal } from "@/components/processing/InspectorModal";

/* -------------------------------------------------------
   Small utils
------------------------------------------------------- */
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function intersectSelection(selected: string[], allowed: string[]) {
  const set = new Set(allowed);
  return selected.filter((c) => set.has(c));
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
    s.includes("uint")
  );
}
function normalizeKind(kind?: string): string {
  const k = String(kind ?? "other").toLowerCase();
  if (k === "bool" || k === "boolean") return "binary";
  return k;
}
function inferKindFallback(_col: string, dtype?: string): string {
  const dt = normalizeDType(dtype);
  if (dt.includes("bool")) return "binary";
  if (dt.includes("datetime") || dt.includes("date") || dt.includes("time")) return "datetime";
  if (looksNumericDType(dt)) return "numeric";
  if (dt.includes("object") || dt.includes("string")) return "categorical";
  return "other";
}
function kindLabel(kind: string) {
  const k = normalizeKind(kind);
  switch (k) {
    case "numeric":
      return "Num";
    case "categorical":
      return "Cat";
    case "datetime":
      return "Date";
    case "binary":
      return "Bin";
    case "text":
      return "Text";
    case "id":
      return "ID";
    default:
      return "Other";
  }
}
function kindBadgeClass(kind: string) {
  const k = normalizeKind(kind);
  switch (k) {
    case "numeric":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "categorical":
      return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "datetime":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "binary":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "text":
      return "border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300";
    case "id":
      return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    default:
      return "border-muted-foreground/20 bg-muted/30 text-muted-foreground";
  }
}
function getOpResult(op: any) {
  return op?.result ?? op?.params?.__result ?? null;
}

type AnyServerMeta = Partial<ColumnMeta> & {
  name?: string;
  dtype?: string;
  kind?: string;
  inferred_kind?: string;
  override_kind?: string | null;
  confidence?: number;
  missing?: number;
  unique?: number;
  total?: number;
  sample?: string[];
};

function buildMetaMap(columns: string[], dtypes: Record<string, string>, serverMeta?: AnyServerMeta[]) {
  const map: Record<string, ColumnMeta> = {};

  if (Array.isArray(serverMeta)) {
    for (const m of serverMeta) {
      if (!m?.name) continue;
      map[m.name] = {
        name: m.name,
        dtype: String(m.dtype ?? dtypes?.[m.name] ?? "unknown"),
        kind: normalizeKind(m.kind ?? m.inferred_kind ?? inferKindFallback(m.name, dtypes?.[m.name])) as any,
        missing: Number(m.missing ?? 0),
        unique: Number(m.unique ?? 0),
        total: Number(m.total ?? 0),
        sample: Array.isArray(m.sample) ? (m.sample as any) : [],
      } as ColumnMeta;
    }
  }

  for (const c of columns) {
    if (!map[c]) {
      map[c] = {
        name: c,
        dtype: dtypes?.[c] ?? "unknown",
        kind: normalizeKind(inferKindFallback(c, dtypes?.[c])) as any,
        missing: 0,
        unique: 0,
        total: 0,
        sample: [],
      } as ColumnMeta;
    }
  }

  return map;
}

/* -------------------------------------------------------
   Schema persistence (server + local fallback)
------------------------------------------------------- */
const OVERRIDES_KEY_PREFIX = "mv_schema_overrides::";
const VERIFIED_KEY_PREFIX = "mv_schema_verified_categorical::";
const DISMISSED_KEY_PREFIX = "mv_schema_dismissed_alerts::";

type SchemaState = {
  kind_overrides: Record<string, ColumnKind>;
  verified_categorical: string[];
  dismissed_alert_keys: string[];
};

async function fetchSchemaState(projectId: string, datasetId: number) {
  return apiClient.get<SchemaState>(`/projects/${projectId}/datasets/${datasetId}/processing/schema`);
}

type SchemaActionPayload =
  | { schema_action: "set_kind"; column: string; kind: ColumnKind }
  | { schema_action: "clear_kind"; column: string }
  | { schema_action: "verify_categorical"; column: string; verified: boolean }
  | { schema_action: "dismiss_alert"; alert_key: string; dismissed: boolean };

async function postSchemaAction(projectId: string, datasetId: number, payload: SchemaActionPayload) {
  await apiClient.postJson(`/projects/${projectId}/datasets/${datasetId}/processing/schema`, payload);
}

/* -------------------------------------------------------
   Page
------------------------------------------------------- */
export function ProcessingPage() {
  const { id } = useParams();
  const projectId = id!;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const versionId = useMemo(() => {
    const raw = searchParams.get("version");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const isEditingVersion = Boolean(versionId);

  const [versionMeta, setVersionMeta] = useState<{
    id: number;
    name: string;
    createdAt: string | null;
    operations: string[];
  } | null>(null);

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [workspaceDatasetId, setWorkspaceDatasetId] = useState<number | null>(null);

  const effectiveDatasetId = useMemo(
    () => (isEditingVersion ? workspaceDatasetId : activeDatasetId),
    [isEditingVersion, workspaceDatasetId, activeDatasetId]
  );

  const [operations, setOperations] = useState<ProcessingOperation[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [dtypes, setDtypes] = useState<Record<string, string>>({});
  const [columnMetaMap, setColumnMetaMap] = useState<Record<string, ColumnMeta>>({});

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [totalRows, setTotalRows] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingDataset, setIsSwitchingDataset] = useState(false);

  const [selectedOp, setSelectedOp] = useState<ProcessingOperation | null>(null);

  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [isTargetLoaded, setIsTargetLoaded] = useState(false);

  // Target modal (normal dataset only)
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTarget, setTempTarget] = useState<string>("");
  const [promptedTargetForDatasetId, setPromptedTargetForDatasetId] = useState<number | null>(null);

  // Cleaning selection
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameText, setRenameText] = useState<string>("{\n  \"OldName\": \"new_name\"\n}");

  // Duplicates behavior
  const [dupKeep, setDupKeep] = useState<"first" | "last">("first");

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingProcessed, setIsSavingProcessed] = useState(false);

  // Schema state (persisted)
  const [kindOverrides, setKindOverrides] = useState<Record<string, ColumnKind>>({});
  const [verifiedCategorical, setVerifiedCategorical] = useState<Set<string>>(new Set());
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<Set<string>>(new Set());
  const [alertsOpen, setAlertsOpen] = useState(false);

  // Inspector modal state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectedCol, setInspectedCol] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"overview" | "distribution" | "type">("overview");

  // Substitution modal
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [substColumn, setSubstColumn] = useState<string>("");
  const [substFrom, setSubstFrom] = useState<string>("");
  const [substTo, setSubstTo] = useState<string>("");
  const [substCaseSensitive, setSubstCaseSensitive] = useState(true);
  const [substTreatFromAsNull, setSubstTreatFromAsNull] = useState(false);
  const [substTreatToAsNull, setSubstTreatToAsNull] = useState(false);

  // stale request protection
  const requestTokenRef = useRef(0);

  const disablePreview = isLoading || isSwitchingDataset || !effectiveDatasetId;
  const disableProcessingActions = isLoading || isSwitchingDataset || !effectiveDatasetId;

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  };
  const resetSelections = () => setSelectedColumns([]);
  const sanitizeSelections = (allowedCols: string[]) =>
    setSelectedColumns((prev) => uniq(intersectSelection(prev, allowedCols)));

  const openInspector = (col: string) => {
    setInspectedCol(col);
    setInspectorTab("overview");
    setInspectorOpen(true);
  };

  const fetchTarget = async (datasetId: number) => {
    try {
      const t = await apiClient.get<{ target_column: string | null }>(`/projects/${projectId}/datasets/${datasetId}/target`);
      return { ok: true as const, target: (t?.target_column ?? null) as string | null };
    } catch {
      return { ok: false as const, target: null as string | null };
    }
  };

  const setTarget = async (datasetId: number, target: string | null) => {
    await apiClient.putJson(`/projects/${projectId}/datasets/${datasetId}/target`, { target_column: target });
  };

  const loadVersionMeta = async (vid: number) => {
    try {
      const all = await dataService.getVersions(projectId);
      const v = (all as any[])?.find((x) => x.id === vid) ?? null;
      setVersionMeta(
        v
          ? { id: v.id, name: v.name ?? `Version #${vid}`, createdAt: v.createdAt ?? null, operations: Array.isArray(v.operations) ? v.operations : [] }
          : null
      );
    } catch {
      setVersionMeta(null);
    }
  };

  const readFallbackSchema = (datasetId: number) => {
    try {
      const o = localStorage.getItem(`${OVERRIDES_KEY_PREFIX}${projectId}:${datasetId}`);
      const v = localStorage.getItem(`${VERIFIED_KEY_PREFIX}${projectId}:${datasetId}`);
      const d = localStorage.getItem(`${DISMISSED_KEY_PREFIX}${projectId}:${datasetId}`);

      const overrides = (o ? JSON.parse(o) : {}) as Record<string, ColumnKind>;
      const verified = new Set<string>(v ? (JSON.parse(v) as string[]) : []);
      const dismissed = new Set<string>(d ? (JSON.parse(d) as string[]) : []);
      return { overrides, verified, dismissed };
    } catch {
      return { overrides: {}, verified: new Set<string>(), dismissed: new Set<string>() };
    }
  };

  const writeFallbackSchema = (datasetId: number, overrides: Record<string, ColumnKind>, verified: Set<string>, dismissed: Set<string>) => {
    try {
      localStorage.setItem(`${OVERRIDES_KEY_PREFIX}${projectId}:${datasetId}`, JSON.stringify(overrides));
      localStorage.setItem(`${VERIFIED_KEY_PREFIX}${projectId}:${datasetId}`, JSON.stringify(Array.from(verified)));
      localStorage.setItem(`${DISMISSED_KEY_PREFIX}${projectId}:${datasetId}`, JSON.stringify(Array.from(dismissed)));
    } catch {}
  };

  /* -------------------------
     Core refresher
  ------------------------- */
  const refreshProcessing = async (datasetId: number, nextPage = 1) => {
    const token = ++requestTokenRef.current;

    const shouldUseVersionSchemaMeta = Boolean(isEditingVersion && versionId);
    const metaPromise = shouldUseVersionSchemaMeta
      ? dataService.getVersionColumnsMeta(projectId, versionId as number, datasetId).catch(() => null)
      : dataService.getProcessingColumnsMeta(projectId, datasetId).catch(() => null);

    const schemaPromise = fetchSchemaState(projectId, datasetId).catch(() => null);

    const [opsResp, previewResp, targetResp, metaResp, schemaResp] = await Promise.all([
      dataService.getOperations(projectId, datasetId),
      dataService.getProcessingPreview(projectId, datasetId, nextPage, pageSize),
      fetchTarget(datasetId),
      metaPromise,
      schemaPromise,
    ]);

    if (token !== requestTokenRef.current) return;

    const cols = previewResp?.columns ?? [];
    const dts = previewResp?.dtypes ?? {};

    setOperations((opsResp ?? []) as any);
    setColumns(cols);
    setDtypes(dts);
    setPreviewRows(previewResp?.rows ?? []);
    setPage(previewResp?.page ?? nextPage);
    setTotalRows(previewResp?.total_rows ?? 0);

    sanitizeSelections(cols);

    setTargetColumn(targetResp.ok ? targetResp.target : null);
    setIsTargetLoaded(targetResp.ok);

    const serverCols = metaResp?.columns ?? undefined;
    const baseMeta = buildMetaMap(cols, dts, serverCols);

    const fallback = readFallbackSchema(datasetId);

    const schemaKO = (schemaResp?.kind_overrides ?? {}) as Record<string, ColumnKind>;
    const schemaVerified = new Set<string>((schemaResp?.verified_categorical ?? []) as string[]);
    const schemaDismissed = new Set<string>((schemaResp?.dismissed_alert_keys ?? []) as string[]);

    const hasServerSchema = schemaResp !== null && schemaResp !== undefined;

    const mergedOverrides = hasServerSchema ? schemaKO : fallback.overrides;
    const mergedVerified = hasServerSchema ? schemaVerified : fallback.verified;
    const mergedDismissed = hasServerSchema ? schemaDismissed : fallback.dismissed;

    setKindOverrides(mergedOverrides);
    setVerifiedCategorical(mergedVerified);
    setDismissedAlertKeys(mergedDismissed);

    const patched: Record<string, ColumnMeta> = { ...baseMeta };
    for (const [c, k] of Object.entries(mergedOverrides)) {
      if (patched[c]) patched[c] = { ...patched[c], kind: k as any };
    }
    setColumnMetaMap(patched);

    writeFallbackSchema(datasetId, mergedOverrides, mergedVerified, mergedDismissed);
  };

  /* -------------------------
     Target prompting (normal dataset only)
  ------------------------- */
  useEffect(() => {
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
  }, [isEditingVersion, isLoading, isSwitchingDataset, effectiveDatasetId, columns.length, targetColumn, promptedTargetForDatasetId, isTargetLoaded]);

  /* -------------------------
     Initial load
  ------------------------- */
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

        // Version editing -> workspace dataset
        if (versionId) {
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

            toast({ title: "Workspace prêt", description: "Prétraitement isolé : aucune autre version ne sera affectée." });
          } catch (e) {
            setWorkspaceDatasetId(null);
            toast({
              title: "Erreur workspace",
              description: (e as Error).message ?? "Impossible de créer le workspace.",
              variant: "destructive",
            });
          }
          return;
        }

        // Normal dataset mode
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
  }, [projectId, versionId]);

  /* -------------------------
     Dataset switch (normal mode only)
  ------------------------- */
  useEffect(() => {
    if (!activeDatasetId) return;
    if (isEditingVersion) return;

    let mounted = true;
    const run = async () => {
      setIsSwitchingDataset(true);
      try {
        await datasetService.setActive(projectId, activeDatasetId).catch(() => {});
        await refreshProcessing(activeDatasetId, 1);
      } catch (e) {
        toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (mounted) setIsSwitchingDataset(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDatasetId, isEditingVersion]);

  const totalPages = useMemo(() => {
    if (!totalRows) return 1;
    return Math.max(1, Math.ceil(totalRows / pageSize));
  }, [totalRows]);

  /* -------------------------
     Table columns
  ------------------------- */
  const tableColumns = useMemo(
    () =>
      columns.map((c) => {
        const kind = normalizeKind(columnMetaMap?.[c]?.kind ?? inferKindFallback(c, dtypes?.[c]));
        const dtype = dtypes?.[c] ?? "unknown";
        return {
          key: c,
          header: (
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{c}</span>
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${kindBadgeClass(kind)}`}>
                {kindLabel(kind)}
              </Badge>
              <span className="text-[10px] text-muted-foreground/70 truncate hidden xl:inline">{dtype}</span>
            </div>
          ),
          onHeaderClick: () => openInspector(c),
          headerClassName: "whitespace-nowrap",
        };
      }),
    [columns, columnMetaMap, dtypes]
  );

  /* -------------------------
     Cleaning runner
  ------------------------- */
  const runCleaning = async (
    description: string,
    action: CleaningAction,
    params: Record<string, any> = {},
    overrideColumns?: string[]
  ) => {
    if (!effectiveDatasetId) {
      toast({
        title: "Choisir un dataset",
        description: "Sélectionne un dataset avant d'appliquer une opération.",
        variant: "destructive",
      });
      return;
    }

    const selected = asNonEmptyArray(overrideColumns ?? selectedColumns);
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

    if (action === "drop_columns" && safeCols.length === 0) {
      toast({ title: "Sélection requise", description: "Choisis au moins une colonne pour drop_columns.", variant: "destructive" });
      return;
    }

    try {
      await dataService.applyCleaningOperation(projectId, effectiveDatasetId, {
        type: "cleaning",
        description,
        columns: safeCols,
        params: { ...params, action },
      });

      await refreshProcessing(effectiveDatasetId, 1);

      const colInfo = safeCols.length ? ` sur ${safeCols.join(", ")}` : "";
      toast({ title: "Opération appliquée", description: `${description}${colInfo}` });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleUndo = async () => {
    if (!effectiveDatasetId) return;

    try {
      const res = await dataService.undoLastOperation(projectId, effectiveDatasetId);
      const ok = (res as any)?.ok ?? true;

      if (!ok) {
        toast({ title: "Rien à annuler", description: "Aucune opération trouvée.", variant: "destructive" });
        return;
      }

      await refreshProcessing(effectiveDatasetId, 1);
      toast({ title: "Opération annulée" });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
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

  const handleDownload = async () => {
    if (!effectiveDatasetId) return;

    setIsDownloading(true);
    try {
      const { blob, filename } = await dataService.exportCleaned(projectId, effectiveDatasetId);
      triggerBrowserDownload(blob, filename ?? `dataset_${effectiveDatasetId}_cleaned.csv`);
      toast({ title: "Téléchargement", description: "Le fichier nettoyé a été téléchargé." });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveDatasetId) return;

    setIsSavingProcessed(true);
    try {
      if (isEditingVersion && versionId) {
        if (!workspaceDatasetId) {
          toast({ title: "Workspace introuvable", description: "Impossible d’enregistrer sans workspace.", variant: "destructive" });
          return;
        }

        await dataService.commitVersionWorkspace(projectId, versionId, workspaceDatasetId);
        await loadVersionMeta(versionId);
        await refreshProcessing(workspaceDatasetId, 1);

        toast({
          title: "Version mise à jour",
          description: `La version #${versionId} a été mise à jour avec les nouvelles données.`,
        });
        return;
      }

      const out = await dataService.saveCleanedAsVersion(projectId, effectiveDatasetId, {});
      const newVersionId = (out as any)?.version_id ?? (out as any)?.id;

      toast({
        title: "Version enregistrée",
        description: newVersionId ? `Version #${newVersionId} ajoutée à l'historique.` : "Version ajoutée à l'historique.",
      });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSavingProcessed(false);
    }
  };

  const parseRenameMapping = (): Record<string, string> | null => {
    try {
      const obj = JSON.parse(renameText);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

      const mapping: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof k !== "string" || typeof v !== "string") return null;
        const kk = k.trim();
        const vv = v.trim();
        if (!kk || !vv) return null;
        mapping[kk] = vv;
      }
      return Object.keys(mapping).length ? mapping : null;
    } catch {
      return null;
    }
  };

  /* -------------------------
     Schema actions
  ------------------------- */
  const dismissAlert = async (key: string, dismissed = true) => {
    if (!effectiveDatasetId) return;

    const next = new Set(dismissedAlertKeys);
    if (dismissed) next.add(key);
    else next.delete(key);
    setDismissedAlertKeys(next);
    writeFallbackSchema(effectiveDatasetId, kindOverrides, verifiedCategorical, next);

    try {
      await postSchemaAction(projectId, effectiveDatasetId, { schema_action: "dismiss_alert", alert_key: key, dismissed });
      await refreshProcessing(effectiveDatasetId, page);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
    }
  };

  const verifyCategorical = async (col: string, verified: boolean) => {
    if (!effectiveDatasetId) return;

    const next = new Set(verifiedCategorical);
    if (verified) next.add(col);
    else next.delete(col);
    setVerifiedCategorical(next);
    writeFallbackSchema(effectiveDatasetId, kindOverrides, next, dismissedAlertKeys);

    try {
      await postSchemaAction(projectId, effectiveDatasetId, { schema_action: "verify_categorical", column: col, verified });
      await refreshProcessing(effectiveDatasetId, page);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
    }
  };

  const setOverride = async (col: string, kind: ColumnKind) => {
    if (!effectiveDatasetId) return;

    const next = { ...kindOverrides, [col]: kind };
    setKindOverrides(next);
    setColumnMetaMap((prev) => {
      const out = { ...prev };
      if (out[col]) out[col] = { ...out[col], kind: kind as any };
      return out;
    });
    writeFallbackSchema(effectiveDatasetId, next, verifiedCategorical, dismissedAlertKeys);

    try {
      await postSchemaAction(projectId, effectiveDatasetId, { schema_action: "set_kind", column: col, kind });
      await refreshProcessing(effectiveDatasetId, page);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
    }
  };

  const clearOverride = async (col: string) => {
    if (!effectiveDatasetId) return;

    const next = { ...kindOverrides };
    delete next[col];
    setKindOverrides(next);
    setColumnMetaMap((prev) => {
      const out = { ...prev };
      if (out[col]) out[col] = { ...out[col], kind: inferKindFallback(col, out[col]?.dtype) as any };
      return out;
    });
    writeFallbackSchema(effectiveDatasetId, next, verifiedCategorical, dismissedAlertKeys);

    try {
      await postSchemaAction(projectId, effectiveDatasetId, { schema_action: "clear_kind", column: col });
      await refreshProcessing(effectiveDatasetId, page);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
    }
  };

  /* -------------------------
     UI helpers
  ------------------------- */
  const opTypeBadge = (t: string) => {
    const k = (t ?? "").toLowerCase();
    if (k === "schema") return "bg-secondary/10 border-secondary/20 text-secondary";
    if (k === "cleaning") return "bg-primary/10 border-primary/20 text-primary";
    return "bg-muted/30 border-border text-muted-foreground";
  };

  const openSubstitution = () => {
    const pre = selectedColumns.length === 1 ? selectedColumns[0] : "";
    setSubstColumn(pre);
    setSubstFrom("");
    setSubstTo("");
    setSubstCaseSensitive(true);
    setSubstTreatFromAsNull(false);
    setSubstTreatToAsNull(false);
    setShowSubstitutionModal(true);
  };

  const applySubstitution = async () => {
    if (!effectiveDatasetId) return;

    const col = (substColumn || "").trim();
    if (!col) {
      toast({ title: "Colonne requise", description: "Choisis une colonne pour la substitution.", variant: "destructive" });
      return;
    }
    if (!columns.includes(col)) {
      toast({ title: "Colonne invalide", description: "Cette colonne n'existe pas dans le dataset courant.", variant: "destructive" });
      return;
    }

    const fromIsNull = substTreatFromAsNull;
    const toIsNull = substTreatToAsNull;

    if (!fromIsNull && substFrom.trim() === "") {
      toast({
        title: "Valeur à remplacer requise",
        description: 'Renseigne "From" (ou coche "From = null").',
        variant: "destructive",
      });
      return;
    }

    const payload = {
      column: col,
      from_value: fromIsNull ? null : substFrom,
      to_value: toIsNull ? null : substTo,
      match_mode: "exact",
      case_sensitive: substCaseSensitive,
      treat_from_as_null: fromIsNull,
      treat_to_as_null: toIsNull,
    };

    await runCleaning("Substitution de valeurs", "substitute_values" as any, payload, [col]);
    setShowSubstitutionModal(false);
  };

  const alertCount = useMemo(() => {
    // AlertsModal calcule visibleAlerts; ici on montre juste un badge rapide.
    // On utilise un calcul léger: rebuild via metaMap.
    let c = 0;
    for (const [col, meta] of Object.entries(columnMetaMap)) {
      const total = meta.total ?? 0;
      const missing = meta.missing ?? 0;
      const missingRatio = total > 0 ? missing / total : 0;
      if (total > 0 && missingRatio > 0.2) c++;
      const k = normalizeKind(meta.kind);
      if (k === "categorical" && !verifiedCategorical.has(col) && !kindOverrides[col]) c++;
    }
    // On enlève ceux dismiss
    // (approx ok: si tu veux exact: passe visibleAlerts depuis AlertsModal via callback)
    return Math.max(0, c - dismissedAlertKeys.size);
  }, [columnMetaMap, verifiedCategorical, kindOverrides, dismissedAlertKeys]);

  /* -------------------------
     Render
  ------------------------- */
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-secondary/5 blur-3xl" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl glass-premium">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="text-gradient">Prepare</span>
                <span className="text-foreground"> — Cleaning</span>
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-lg">
                {isEditingVersion
                  ? "Nettoyage d'une version (workspace isolé)"
                  : "Nettoyez vos données sans leakage. Le preprocessing ML se fait au training, après split."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isEditingVersion && (
                <Select
                  value={activeDatasetId ? String(activeDatasetId) : undefined}
                  onValueChange={(v) => setActiveDatasetId(Number(v))}
                  disabled={isLoading || datasets.length === 0}
                >
                  <SelectTrigger className="w-[280px] bg-background/60 backdrop-blur-sm">
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

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAlertsOpen(true)}
                disabled={isLoading || isSwitchingDataset || !effectiveDatasetId}
                className="relative"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Alertes
                {alertCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </Button>

              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-medium">
                {columns.length} colonnes
              </Badge>

              {isEditingVersion && (
                <Badge className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground border-0">
                  {versionMeta?.name ?? `Version #${versionId}`}
                </Badge>
              )}
              {isEditingVersion && (
                <Badge className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground border-0">
                  Workspace #{workspaceDatasetId ?? "…"}
                </Badge>
              )}

              <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading || isDownloading} className="gap-2">
                <Download className="h-4 w-4" />
                {isDownloading ? "Téléchargement..." : "Exporter"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Cleaning + Actions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {/* Cleaning Card */}
          <Card className="group relative overflow-hidden border-0 shadow-card hover:shadow-premium transition-all duration-500 lg:col-span-2">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary/40 rounded-l-2xl" />
            <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                  <Eraser className="h-4.5 w-4.5 text-primary" />
                </div>
                Cleaning
              </CardTitle>
              <CardDescription>Opérations sûres (sans fit/stat global)</CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:bg-destructive/5 hover:border-destructive/30"
                  disabled={disableProcessingActions || selectedColumns.length === 0}
                  onClick={() => runCleaning("Colonnes supprimées", "drop_columns")}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer colonnes sélectionnées
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-primary/5 sm:col-start-2 sm:row-start-1"
                  disabled={disableProcessingActions}
                  onClick={() =>
                    runCleaning(
                      selectedColumns.length ? "Doublons supprimés (subset)" : "Doublons supprimés (toutes colonnes)",
                      "drop_duplicates",
                      { keep: dupKeep }
                    )
                  }
                >
                  Supprimer doublons {selectedColumns.length ? "(subset)" : "(tout)"}
                </Button>

                <div className="flex items-center gap-2 px-1 sm:col-start-2 sm:row-start-2">
                  <span className="text-xs text-muted-foreground font-medium">keep:</span>
                  <Select
                    value={dupKeep}
                    onValueChange={(v) => setDupKeep(v === "last" ? "last" : "first")}
                    disabled={disableProcessingActions}
                  >
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first">first</SelectItem>
                      <SelectItem value="last">last</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-primary/5 sm:col-start-1 sm:row-start-2"
                  disabled={disableProcessingActions}
                  onClick={() =>
                    runCleaning(
                      selectedColumns.length ? "Lignes vides supprimées (subset)" : "Lignes vides supprimées",
                      "drop_empty_rows"
                    )
                  }
                >
                  Supprimer lignes vides {selectedColumns.length ? "(subset)" : ""}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-primary/5 sm:col-start-2 sm:row-start-3"
                  disabled={disableProcessingActions}
                  onClick={() =>
                    runCleaning(
                      selectedColumns.length ? "Espaces supprimés (strip)" : "Espaces supprimés (strip) (auto colonnes texte)",
                      "strip_whitespace"
                    )
                  }
                >
                  <TypeIcon className="h-4 w-4 mr-2" />
                  Strip whitespace {selectedColumns.length ? "(sélection)" : "(auto)"}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-primary/5 sm:col-start-1 sm:row-start-3"
                  disabled={disableProcessingActions}
                  onClick={() => setShowRenameModal(true)}
                >
                  Renommer colonnes (JSON)
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-primary/5 sm:col-start-2 sm:row-start-4"
                  disabled={disableProcessingActions}
                  onClick={openSubstitution}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Substitution de valeurs
                </Button>

                <div className="sm:col-span-2 sm:row-start-5">
                  <ColumnSelector
                    key={`clean-${effectiveDatasetId ?? "x"}`}
                    columns={columns}
                    selectedColumns={selectedColumns}
                    onToggle={toggleColumn}
                    label="Colonnes (utilisées selon l'action)"
                    metaMap={columnMetaMap}
                  />
                </div>

                <p className="sm:col-span-2 sm:row-start-6 text-[11px] text-muted-foreground/70 leading-relaxed">
                  Astuce : pour <b>doublons</b>, <b>lignes vides</b> et <b>strip</b>, si aucune colonne n'est sélectionnée, l'action s'applique sur toutes.
                  Pour la <b>substitution</b>, tu choisis une colonne dans le modal.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="group relative overflow-hidden border-0 shadow-card hover:shadow-premium transition-all duration-500">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-secondary to-accent/40 rounded-l-2xl" />
            <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-secondary/5 blur-2xl group-hover:bg-secondary/10 transition-colors duration-500" />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary/15 to-accent/5 flex items-center justify-center">
                  <Settings2 className="h-4.5 w-4.5 text-secondary" />
                </div>
                Actions
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 relative z-10">
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-secondary/5"
                onClick={handleUndo}
                disabled={disableProcessingActions || operations.length === 0}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Annuler dernière
              </Button>

              <Button
                className="w-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                disabled={disableProcessingActions || isSavingProcessed}
                onClick={handleSave}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSavingProcessed ? "Enregistrement..." : isEditingVersion ? "Enregistrer (mettre à jour la version)" : "Enregistrer version cleaned"}
              </Button>

              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Cette version <b>cleaned</b> sera utilisée pour l'entraînement (split + fit/transform dans le training pipeline).
              </p>

              {isEditingVersion && (
                <Button variant="ghost" className="w-full justify-start" onClick={() => navigate(`/projects/${projectId}/versions`)} disabled={isLoading}>
                  ← Retour aux versions
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Preview + History */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        >
          {/* Preview */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-card overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Aperçu des données</CardTitle>
                    <CardDescription className="mt-1">
                      {totalRows ? `${totalRows.toLocaleString("fr-FR")} lignes` : "—"} • Page {page}/{totalPages} •{" "}
                      <span className="inline-flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" /> Clique sur une entête pour voir le profil
                      </span>
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disablePreview || page <= 1}
                      onClick={() => {
                        const next = Math.max(1, page - 1);
                        if (!effectiveDatasetId) return;
                        void refreshProcessing(effectiveDatasetId, next);
                      }}
                    >
                      Précédent
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disablePreview || page >= totalPages}
                      onClick={() => {
                        const next = Math.min(totalPages, page + 1);
                        if (!effectiveDatasetId) return;
                        void refreshProcessing(effectiveDatasetId, next);
                      }}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="w-full overflow-x-auto rounded-xl border border-border/50">
                  <div className="min-w-[900px]">
                    <DataTable data={previewRows} columns={tableColumns as any} pageSize={pageSize} />
                  </div>
                </div>

                {columns.length > 10 && (
                  <p className="text-[11px] text-muted-foreground/70 mt-3">Astuce : scrolle horizontalement pour voir toutes les colonnes.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* History (inchangé) */}
          <Card className="border-0 shadow-card">
            <CardHeader className="bg-gradient-to-r from-accent/5 to-transparent">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                Historique
                {operations.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {operations.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {operations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                  <Layers className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Aucune opération</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {operations.map((op, i) => {
                    const cols = (op.columns ?? []).filter(Boolean);
                    const r = getOpResult(op);

                    return (
                      <motion.button
                        key={op.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        type="button"
                        onClick={() => setSelectedOp(op)}
                        className="w-full text-left p-3 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all duration-300 flex items-start gap-3 group/item"
                      >
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {i + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium truncate">{op.description}</p>

                            <Badge variant="outline" className={`shrink-0 text-[10px] ${opTypeBadge(op.op_type)}`}>
                              {op.op_type}
                            </Badge>

                            {r ? (
                              <Badge variant="outline" className="shrink-0 text-[10px] bg-primary/5 border-primary/20 text-primary">
                                détails
                              </Badge>
                            ) : null}
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-1">{new Date(op.created_at).toLocaleString("fr-FR")}</p>
                          {cols.length > 0 && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Colonnes: {cols.join(", ")}</p>}
                        </div>

                        <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 -rotate-90 group-hover/item:text-foreground transition-colors" />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* --- Substitution modal (inchangé) --- */}
      <Modal isOpen={showSubstitutionModal} onClose={() => setShowSubstitutionModal(false)} title="Substitution de valeurs" size="lg">
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">Remplacer une valeur par une autre</p>
            <p className="text-xs text-muted-foreground mt-1">
              Exemple : remplacer <code>"?"</code> par <code>""</code> (vide) ou <code>"Unknown"</code>. Mode <b>exact</b>.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Colonne</p>
            <Select value={substColumn || ""} onValueChange={(v) => setSubstColumn(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={selectedColumns.length === 1 ? `Sélectionnée: ${selectedColumns[0]}` : "Choisir une colonne..."} />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">From (valeur à remplacer)</p>
                <Input
                  value={substFrom}
                  onChange={(e) => setSubstFrom(e.target.value)}
                  placeholder='ex: "?" ou 0 ou Unknown'
                  disabled={substTreatFromAsNull}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={substTreatFromAsNull} onCheckedChange={(v) => setSubstTreatFromAsNull(Boolean(v))} className="h-3.5 w-3.5" />
                  From = null
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">To (nouvelle valeur)</p>
                <Input value={substTo} onChange={(e) => setSubstTo(e.target.value)} placeholder='ex: "" (vide) ou 1 ou Normal' disabled={substTreatToAsNull} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={substTreatToAsNull} onCheckedChange={(v) => setSubstTreatToAsNull(Boolean(v))} className="h-3.5 w-3.5" />
                  To = null
                </label>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={substCaseSensitive} onCheckedChange={(v) => setSubstCaseSensitive(Boolean(v))} className="h-3.5 w-3.5" />
                Case sensitive (strings)
              </label>

              <Badge variant="outline" className="text-[11px]">
                mode: exact
              </Badge>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowSubstitutionModal(false)}>
              Annuler
            </Button>
            <Button onClick={applySubstitution} disabled={disableProcessingActions}>
              Appliquer
            </Button>
          </div>
        </div>
      </Modal>

      {/* --- Inspector modal (externalisé) --- */}
      <InspectorModal
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        col={inspectedCol}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        previewRows={previewRows}
        dtypes={dtypes}
        metaMap={columnMetaMap}
        kindOverrides={kindOverrides}
        verifiedCategorical={verifiedCategorical}
        effectiveDatasetId={effectiveDatasetId}
        page={page}
        disableActions={disableProcessingActions}
        onRefresh={() => {
          if (!effectiveDatasetId) return;
          void refreshProcessing(effectiveDatasetId, page);
        }}
        onRunCleaning={runCleaning}
        onSetOverride={setOverride}
        onClearOverride={clearOverride}
        onVerifyCategorical={verifyCategorical}
      />

      {/* --- Alerts modal (externalisé) --- */}
      <AlertsModal
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        metaMap={columnMetaMap}
        verifiedCategorical={verifiedCategorical}
        kindOverrides={kindOverrides}
        dismissedAlertKeys={dismissedAlertKeys}
        disableActions={disableProcessingActions}
        onDismissAlert={dismissAlert}
        onVerifyCategorical={verifyCategorical}
        onSetOverride={setOverride}
        onClearOverride={clearOverride}
        onRunCleaning={runCleaning}
      />

      {/* --- Rename modal (inchangé) --- */}
      <Modal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} title="Renommer colonnes" size="xl">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Donne un mapping JSON: <code>{"{ \"Old\": \"new\" }"}</code>. Exemple : renommer <code>BP(mmHg)</code> → <code>bp_mmhg</code>.
          </p>

          <Textarea value={renameText} onChange={(e) => setRenameText(e.target.value)} className="min-h-[200px]" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRenameModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                const mapping = parseRenameMapping();
                if (!mapping) {
                  toast({
                    title: "JSON invalide",
                    description: "Le mapping doit être un objet JSON { \"old\": \"new\" } avec des strings non vides.",
                    variant: "destructive",
                  });
                  return;
                }

                await runCleaning("Colonnes renommées", "rename_columns" as any, { mapping }, []);
                setShowRenameModal(false);
              }}
              disabled={disableProcessingActions}
            >
              Appliquer
            </Button>
          </div>
        </div>
      </Modal>

      {/* --- Op details modal (inchangé) --- */}
      <Modal isOpen={!!selectedOp} onClose={() => setSelectedOp(null)} title="Détails de l'opération" size="xl">
        {selectedOp ? (
          (() => {
            const r = getOpResult(selectedOp);
            const cols = (selectedOp.columns ?? []).filter(Boolean);

            const renderColBadge = (c: string, variant: "outline" | "secondary" | "destructive" = "outline") => {
              const kind = normalizeKind(columnMetaMap?.[c]?.kind ?? inferKindFallback(c, dtypes?.[c]));
              return (
                <span key={c} className="inline-flex items-center gap-2">
                  <Badge variant={variant} className="text-xs">
                    {c}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${kindBadgeClass(kind)}`}>
                    {kindLabel(kind)}
                  </Badge>
                </span>
              );
            };

            return (
              <div className="max-h-[80vh] overflow-y-auto pr-1">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{selectedOp.op_type}</Badge>
                    <Badge variant="outline">{new Date(selectedOp.created_at).toLocaleString("fr-FR")}</Badge>
                    {cols.length > 0 ? <Badge variant="outline">{cols.length} colonne(s)</Badge> : null}
                  </div>

                  <div>
                    <p className="text-sm font-medium">{selectedOp.description}</p>
                    {cols.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {cols.slice(0, 20).map((c) => renderColBadge(c, "outline"))}
                        {cols.length > 20 ? <span className="text-xs text-muted-foreground">+{cols.length - 20}…</span> : null}
                      </div>
                    )}
                  </div>

                  {r ? (
                    <>
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
                        {Array.isArray(r.columns_added) && r.columns_added.length ? <Badge variant="outline">+ {r.columns_added.length} colonnes</Badge> : null}
                        {Array.isArray(r.columns_removed) && r.columns_removed.length ? <Badge variant="outline">- {r.columns_removed.length} colonnes</Badge> : null}
                        {typeof r.rows_removed === "number" && r.rows_removed !== 0 ? <Badge variant="outline">{r.rows_removed} lignes supprimées</Badge> : null}
                      </div>

                      {r.per_column ? (
                        <div className="rounded-md border border-border overflow-hidden">
                          <div className="px-3 py-2 bg-muted/40">
                            <p className="text-sm font-medium">Impact par colonne</p>
                            <p className="text-xs text-muted-foreground">filled = NaN remplis, changed = valeurs modifiées</p>
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
                    <div className="rounded-md border border-border p-3 bg-muted/30">
                      <p className="text-sm font-medium">Détails indisponibles</p>
                      <p className="text-xs text-muted-foreground mt-1">Cette opération ne fournit pas encore de résumé détaillé.</p>
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
          })()
        ) : null}
      </Modal>

      {/* Target modal (inchangé) */}
      <Modal isOpen={showTargetModal} onClose={() => setShowTargetModal(false)} title="Choisir la colonne cible (Target)" size="lg">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choisis la colonne target pour l'entraînement (classification/régression). Tu peux la changer plus tard.
          </p>

          <Select value={tempTarget || ""} onValueChange={(v) => setTempTarget(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner une colonne..." />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowTargetModal(false)}>
              Plus tard
            </Button>
            <Button
              onClick={async () => {
                if (!effectiveDatasetId) return;
                if (!tempTarget) {
                  toast({ title: "Target requise", description: "Sélectionne une colonne.", variant: "destructive" });
                  return;
                }
                try {
                  await setTarget(effectiveDatasetId, tempTarget);
                  setTargetColumn(tempTarget);
                  setShowTargetModal(false);
                  toast({ title: "Target enregistrée", description: `Target: ${tempTarget}` });
                } catch (e) {
                  toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
                }
              }}
              disabled={disableProcessingActions}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

export default ProcessingPage;
