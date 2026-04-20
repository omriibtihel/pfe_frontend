/**
 * useNettoyageData — chargement initial, pagination, switch dataset.
 * Consomme useNettoyageState. Exporte aussi les utilitaires de type/kind
 * partagés par les composants enfants.
 */
import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

import dataService from "@/services/dataService";
import datasetService from "@/services/datasetService";
import apiClient from "@/services/apiClient";
import type { ColumnMeta, ColumnKind } from "@/services/dataService";

import type { NettoyageState } from "./useNettoyageState";

// ── Utility types ─────────────────────────────────────────────────────────────
type AnyServerMeta = Partial<ColumnMeta> & {
  name?: string; dtype?: string; kind?: string; inferred_kind?: string;
  override_kind?: string | null; confidence?: number;
  missing?: number; unique?: number; total?: number; sample?: string[];
};

type SchemaState = {
  kind_overrides: Record<string, ColumnKind>;
  verified_categorical: string[];
  dismissed_alert_keys: string[];
};

// ── Pure utility functions (exported — used by components & actions) ───────────
export function normalizeDType(dt?: string) {
  return (dt ?? "").toLowerCase();
}
function looksNumericDType(dt?: string) {
  const s = normalizeDType(dt);
  return s.includes("int") || s.includes("float") || s.includes("double") ||
    s.includes("number") || s.includes("numeric") || s.includes("uint");
}
export function normalizeKind(kind?: string): string {
  const k = String(kind ?? "other").toLowerCase();
  if (k === "bool" || k === "boolean") return "binary";
  return k;
}
export function inferKindFallback(_col: string, dtype?: string): string {
  const dt = normalizeDType(dtype);
  if (dt.includes("bool")) return "binary";
  if (dt.includes("datetime") || dt.includes("date") || dt.includes("time")) return "datetime";
  if (looksNumericDType(dt)) return "numeric";
  if (dt.includes("object") || dt.includes("string")) return "categorical";
  return "other";
}
export function kindLabel(kind: string) {
  const k = normalizeKind(kind);
  switch (k) {
    case "numeric": return "Num";
    case "categorical": return "Cat";
    case "datetime": return "Date";
    case "binary": return "Bin";
    case "text": return "Text";
    case "id": return "ID";
    default: return "Other";
  }
}
export function kindBadgeClass(kind: string) {
  const k = normalizeKind(kind);
  switch (k) {
    case "numeric": return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "categorical": return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "datetime": return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "binary": return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "text": return "border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300";
    case "id": return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    default: return "border-muted-foreground/20 bg-muted/30 text-muted-foreground";
  }
}
export function getOpResult(op: any) {
  return op?.result ?? op?.params?.__result ?? null;
}

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
        missing: 0, unique: 0, total: 0, sample: [],
      } as ColumnMeta;
    }
  }
  return map;
}

// ── Schema localStorage persistence (pure — projectId is explicit param) ───────
const OVERRIDES_KEY_PREFIX = "mv_schema_overrides::";
const VERIFIED_KEY_PREFIX = "mv_schema_verified_categorical::";
const DISMISSED_KEY_PREFIX = "mv_schema_dismissed_alerts::";

export function readFallbackSchema(projectId: string, datasetId: number) {
  try {
    const o = localStorage.getItem(`${OVERRIDES_KEY_PREFIX}${projectId}:${datasetId}`);
    const v = localStorage.getItem(`${VERIFIED_KEY_PREFIX}${projectId}:${datasetId}`);
    const d = localStorage.getItem(`${DISMISSED_KEY_PREFIX}${projectId}:${datasetId}`);
    return {
      overrides: (o ? JSON.parse(o) : {}) as Record<string, ColumnKind>,
      verified: new Set<string>(v ? (JSON.parse(v) as string[]) : []),
      dismissed: new Set<string>(d ? (JSON.parse(d) as string[]) : []),
    };
  } catch {
    return { overrides: {}, verified: new Set<string>(), dismissed: new Set<string>() };
  }
}

export function writeFallbackSchema(
  projectId: string,
  datasetId: number,
  overrides: Record<string, ColumnKind>,
  verified: Set<string>,
  dismissed: Set<string>,
) {
  try {
    localStorage.setItem(`${OVERRIDES_KEY_PREFIX}${projectId}:${datasetId}`, JSON.stringify(overrides));
    localStorage.setItem(`${VERIFIED_KEY_PREFIX}${projectId}:${datasetId}`, JSON.stringify(Array.from(verified)));
    localStorage.setItem(`${DISMISSED_KEY_PREFIX}${projectId}:${datasetId}`, JSON.stringify(Array.from(dismissed)));
  } catch {}
}

// ── Schema server helpers ─────────────────────────────────────────────────────
async function fetchSchemaState(projectId: string, datasetId: number) {
  return apiClient.get<SchemaState>(`/projects/${projectId}/datasets/${datasetId}/nettoyage/schema`);
}

export async function postSchemaAction(
  projectId: string,
  datasetId: number,
  payload:
    | { schema_action: "set_kind"; column: string; kind: ColumnKind }
    | { schema_action: "clear_kind"; column: string }
    | { schema_action: "verify_categorical"; column: string; verified: boolean }
    | { schema_action: "dismiss_alert"; alert_key: string; dismissed: boolean },
) {
  await apiClient.postJson(`/projects/${projectId}/datasets/${datasetId}/nettoyage/schema`, payload);
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useNettoyageData(state: NettoyageState, projectId: string) {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const requestTokenRef = useRef(0);

  const versionId = useMemo(() => {
    const raw = searchParams.get("version");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const isEditingVersion = Boolean(versionId);

  const effectiveDatasetId = useMemo(
    () => (isEditingVersion ? state.workspaceDatasetId : state.activeDatasetId),
    [isEditingVersion, state.workspaceDatasetId, state.activeDatasetId],
  );

  const totalPages = useMemo(() => {
    if (!state.totalRows) return 1;
    return Math.max(1, Math.ceil(state.totalRows / state.pageSize));
  }, [state.totalRows, state.pageSize]);

  // ── API helpers ─────────────────────────────────────────────────────────────
  const fetchTarget = async (datasetId: number) => {
    try {
      const t = await apiClient.get<{ target_column: string | null }>(
        `/projects/${projectId}/datasets/${datasetId}/target`,
      );
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
      state.setVersionMeta(
        v
          ? { id: v.id, name: v.name ?? `Version #${vid}`, createdAt: v.createdAt ?? null, operations: Array.isArray(v.operations) ? v.operations : [] }
          : null,
      );
    } catch {
      state.setVersionMeta(null);
    }
  };

  // ── Core data refresher ─────────────────────────────────────────────────────
  const refreshProcessing = async (datasetId: number, nextPage = 1) => {
    const token = ++requestTokenRef.current;

    const shouldUseVersionSchemaMeta = Boolean(isEditingVersion && versionId);
    const metaPromise = shouldUseVersionSchemaMeta
      ? dataService.getVersionColumnsMeta(projectId, versionId as number, datasetId).catch(() => null)
      : dataService.getProcessingColumnsMeta(projectId, datasetId).catch(() => null);

    const [opsResp, previewResp, targetResp, metaResp, schemaResp] = await Promise.all([
      dataService.getOperations(projectId, datasetId),
      dataService.getProcessingPreview(projectId, datasetId, nextPage, state.pageSize),
      fetchTarget(datasetId),
      metaPromise,
      fetchSchemaState(projectId, datasetId).catch(() => null),
    ]);

    if (token !== requestTokenRef.current) return;

    const cols = previewResp?.columns ?? [];
    const dts = previewResp?.dtypes ?? {};

    state.setOperations((opsResp ?? []) as any);
    state.setColumns(cols);
    state.setDtypes(dts);
    state.setPreviewRows(previewResp?.rows ?? []);
    state.setPage(previewResp?.page ?? nextPage);
    state.setTotalRows(previewResp?.total_rows ?? 0);
    state.sanitizeSelections(cols);
    state.setTargetColumn(targetResp.ok ? targetResp.target : null);
    state.setIsTargetLoaded(targetResp.ok);

    const baseMeta = buildMetaMap(cols, dts, metaResp?.columns ?? undefined);
    const fallback = readFallbackSchema(projectId, datasetId);
    const hasServerSchema = schemaResp !== null && schemaResp !== undefined;
    const mergedOverrides = hasServerSchema ? ((schemaResp?.kind_overrides ?? {}) as Record<string, ColumnKind>) : fallback.overrides;
    const mergedVerified = hasServerSchema ? new Set<string>((schemaResp?.verified_categorical ?? []) as string[]) : fallback.verified;
    const mergedDismissed = hasServerSchema ? new Set<string>((schemaResp?.dismissed_alert_keys ?? []) as string[]) : fallback.dismissed;

    state.setKindOverrides(mergedOverrides);
    state.setVerifiedCategorical(mergedVerified);
    state.setDismissedAlertKeys(mergedDismissed);

    const patched: Record<string, ColumnMeta> = { ...baseMeta };
    for (const [c, k] of Object.entries(mergedOverrides)) {
      if (patched[c]) patched[c] = { ...patched[c], kind: k as any };
    }
    state.setColumnMetaMap(patched);
    writeFallbackSchema(projectId, datasetId, mergedOverrides, mergedVerified, mergedDismissed);
  };

  // ── Target prompting (normal dataset only) ──────────────────────────────────
  useEffect(() => {
    if (isEditingVersion) return;
    if (state.isLoading || state.isSwitchingDataset) return;
    if (!effectiveDatasetId) return;
    if (!state.columns.length) return;
    if (!state.isTargetLoaded) return;
    if (!state.targetColumn && state.promptedTargetForDatasetId !== effectiveDatasetId) {
      state.setTempTarget("");
      state.setShowTargetModal(true);
      state.setPromptedTargetForDatasetId(effectiveDatasetId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingVersion, state.isLoading, state.isSwitchingDataset, effectiveDatasetId,
      state.columns.length, state.targetColumn, state.promptedTargetForDatasetId, state.isTargetLoaded]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      state.setIsLoading(true);
      try {
        const list = await datasetService.list(projectId);
        if (!mounted) return;
        state.setDatasets(list);

        const active = await datasetService.getActive(projectId).catch(() => ({ active_dataset_id: null }));
        let chosen: number | null = active.active_dataset_id ?? null;
        if (chosen && !list.some((d) => d.id === chosen)) chosen = null;
        if (!chosen) {
          chosen = list?.[0]?.id ?? null;
          if (chosen) await datasetService.setActive(projectId, chosen).catch(() => {});
        }
        state.setActiveDatasetId(chosen);

        if (versionId) {
          state.resetSelections();
          state.setTargetColumn(null);
          state.setIsTargetLoaded(true);
          state.setPromptedTargetForDatasetId(null);
          await loadVersionMeta(versionId);
          try {
            const ws = await dataService.getOrCreateVersionWorkspace(projectId, versionId);
            const wsId = (ws as any)?.workspace_dataset_id as number;
            state.setWorkspaceDatasetId(wsId);
            await refreshProcessing(wsId, 1);
            toast({ title: "Workspace prêt", description: "Nettoyage isolé : aucune autre version ne sera affectée." });
          } catch (e) {
            state.setWorkspaceDatasetId(null);
            toast({ title: "Erreur workspace", description: (e as Error).message ?? "Impossible de créer le workspace.", variant: "destructive" });
          }
          return;
        }

        if (chosen) {
          state.setVersionMeta(null);
          state.setWorkspaceDatasetId(null);
          state.resetSelections();
          state.setTargetColumn(null);
          state.setIsTargetLoaded(false);
          await refreshProcessing(chosen, 1);
        } else {
          state.setVersionMeta(null);
          state.setWorkspaceDatasetId(null);
          state.setTargetColumn(null);
          state.setIsTargetLoaded(false);
        }
      } catch (e) {
        toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (mounted) state.setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, versionId]);

  // ── Dataset switch (normal mode only) ──────────────────────────────────────
  useEffect(() => {
    if (!state.activeDatasetId) return;
    if (isEditingVersion) return;
    let mounted = true;
    const run = async () => {
      state.setIsSwitchingDataset(true);
      try {
        await datasetService.setActive(projectId, state.activeDatasetId!).catch(() => {});
        await refreshProcessing(state.activeDatasetId!, 1);
      } catch (e) {
        toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (mounted) state.setIsSwitchingDataset(false);
      }
    };
    run();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeDatasetId, isEditingVersion]);

  return {
    versionId,
    isEditingVersion,
    effectiveDatasetId,
    totalPages,
    refreshProcessing,
    fetchTarget,
    setTarget,
    loadVersionMeta,
  };
}

export type NettoyageData = ReturnType<typeof useNettoyageData>;
