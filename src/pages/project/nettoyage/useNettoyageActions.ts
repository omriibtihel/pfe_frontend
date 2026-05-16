/**
 * useNettoyageActions — tous les handlers métier (applyOp, saveVersion, schema…).
 * Aucun JSX. Consomme useNettoyageState + useNettoyageData.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

import dataService from "@/services/dataService";
import type { CleaningAction, ColumnKind } from "@/services/dataService";
import { countVisibleAlerts } from "@/components/nettoyage/AlertsModal";

import type { NettoyageState } from "./useNettoyageState";
import type { NettoyageData } from "./useNettoyageData";
import { writeFallbackSchema, postSchemaAction, inferKindFallback } from "./useNettoyageData";

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useNettoyageActions(state: NettoyageState, data: NettoyageData, projectId: string) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  // ── Inspector ───────────────────────────────────────────────────────────────
  const openInspector = (col: string) => {
    state.setInspectedCol(col);
    state.setInspectorTab("overview");
    state.setInspectorOpen(true);
  };

  // ── Alert count ─────────────────────────────────────────────────────────────
  const alertCount = useMemo(
    () => countVisibleAlerts(state.columnMetaMap, state.verifiedCategorical, state.kindOverrides, state.dismissedAlertKeys, data.alertThresholds),
    [state.columnMetaMap, state.verifiedCategorical, state.kindOverrides, state.dismissedAlertKeys, data.alertThresholds],
  );

  // ── Core cleaning runner ────────────────────────────────────────────────────
  const runCleaning = async (
    description: string,
    action: CleaningAction,
    params: Record<string, unknown> = {},
    overrideColumns?: string[],
  ) => {
    if (!data.effectiveDatasetId) {
      toast({ title: t("nettoyage.toast.pickDatasetTitle"), description: t("nettoyage.toast.pickDatasetDesc"), variant: "destructive" });
      return;
    }

    const selected = (overrideColumns ?? state.selectedColumns).filter(Boolean);
    const safeCols = selected.filter((c) => state.columns.includes(c));
    const removed = selected.filter((c) => !state.columns.includes(c));

    if (removed.length) {
      toast({ title: t("nettoyage.toast.invalidSelectionTitle"), description: t("nettoyage.toast.invalidSelectionDesc", { cols: removed.join(", ") }), variant: "destructive" });
      return;
    }
    if (action === "drop_columns" && safeCols.length === 0) {
      toast({ title: t("nettoyage.toast.requiredSelectionTitle"), description: t("nettoyage.toast.requiredSelectionDesc"), variant: "destructive" });
      return;
    }

    try {
      await dataService.applyCleaningOperation(projectId, data.effectiveDatasetId, {
        type: "cleaning",
        description,
        columns: safeCols,
        params: { ...params, action },
      });
      if (!data.isEditingVersion) state.setHasDirtySession(true);
      await data.refreshProcessing(data.effectiveDatasetId, 1);
      const desc = safeCols.length ? t("nettoyage.toast.opAppliedDescWithCols", { desc: description, cols: safeCols.join(", ") }) : description;
      toast({ title: t("nettoyage.toast.opAppliedTitle"), description: desc });
    } catch (error) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (error as Error).message, variant: "destructive" });
    }
  };

  // ── Undo ────────────────────────────────────────────────────────────────────
  const handleUndo = async () => {
    if (!data.effectiveDatasetId) return;
    try {
      const res = await dataService.undoLastOperation(projectId, data.effectiveDatasetId);
      if (!(res?.ok ?? true)) {
        toast({ title: t("nettoyage.toast.nothingToUndoTitle"), description: t("nettoyage.toast.nothingToUndoDesc"), variant: "destructive" });
        return;
      }
      if (!data.isEditingVersion) state.setHasDirtySession(true);
      await data.refreshProcessing(data.effectiveDatasetId, 1);
      toast({ title: t("nettoyage.toast.undoneTitle") });
    } catch (error) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (error as Error).message, variant: "destructive" });
    }
  };

  // ── Download ────────────────────────────────────────────────────────────────
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
    if (!data.effectiveDatasetId) return;
    state.setIsDownloading(true);
    try {
      const { blob, filename } = await dataService.exportCleaned(projectId, data.effectiveDatasetId);
      triggerBrowserDownload(blob, filename ?? `dataset_${data.effectiveDatasetId}_cleaned.csv`);
      toast({ title: t("nettoyage.toast.downloadTitle"), description: t("nettoyage.toast.downloadDesc") });
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message, variant: "destructive" });
    } finally {
      state.setIsDownloading(false);
    }
  };

  // ── Save / commit version ───────────────────────────────────────────────────
  const handleSave = () => {
    if (!data.effectiveDatasetId) return;
    if (data.isEditingVersion && data.versionId) {
      commitVersion();
      return;
    }
    const activeDataset = state.datasets.find((d) => d.id === state.activeDatasetId);
    const stem = activeDataset?.original_name?.replace(/\.[^.]+$/, "") ?? `dataset_${state.activeDatasetId ?? 0}`;
    state.setSaveVersionName(`${stem}_cleaned`);
    state.setShowSaveNameModal(true);
  };

  const commitVersion = async () => {
    if (!data.effectiveDatasetId || !data.versionId) return;
    state.setIsSavingProcessed(true);
    try {
      if (!state.workspaceDatasetId) {
        toast({ title: t("nettoyage.toast.workspaceMissingTitle"), description: t("nettoyage.toast.workspaceMissingDesc"), variant: "destructive" });
        return;
      }
      await dataService.commitVersionWorkspace(projectId, data.versionId, state.workspaceDatasetId);
      await data.loadVersionMeta(data.versionId);

      const ws = (await dataService.getOrCreateVersionWorkspace(projectId, data.versionId)) as
        | { workspace_dataset_id?: number; data?: { workspace_dataset_id?: number } }
        | null
        | undefined;
      const newWsId = ws?.workspace_dataset_id ?? ws?.data?.workspace_dataset_id;
      if (!newWsId) throw new Error("Impossible de récupérer un nouveau workspace après l'enregistrement.");

      state.setWorkspaceDatasetId(newWsId);
      await data.refreshProcessing(newWsId, 1);
      toast({ title: t("nettoyage.toast.versionUpdatedTitle"), description: t("nettoyage.toast.versionUpdatedDesc", { id: data.versionId }) });
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message, variant: "destructive" });
    } finally {
      state.setIsSavingProcessed(false);
    }
  };

  const confirmSaveVersion = async () => {
    if (!data.effectiveDatasetId) return;
    const trimmedName = state.saveVersionName.trim();
    const isDuplicate = state.versions.some(
      (v) => v.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      toast({
        title: t("nettoyage.toast.nameTakenTitle"),
        description: t("nettoyage.toast.nameTakenDesc", { name: trimmedName }),
        variant: "destructive",
      });
      return;
    }
    state.setShowSaveNameModal(false);
    state.setIsSavingProcessed(true);
    try {
      const out = (await dataService.saveCleanedAsVersion(projectId, data.effectiveDatasetId, {
        name: state.saveVersionName.trim() || undefined,
      })) as { id?: number | string; version_id?: number | string; name?: string } | null | undefined;
      const newVersionId = out?.version_id ?? out?.id;
      const savedName = out?.name ?? state.saveVersionName.trim();
      state.setHasDirtySession(false);
      await data.refreshVersions();
      toast({
        title: t("nettoyage.toast.versionSavedTitle"),
        description: newVersionId
          ? t("nettoyage.toast.versionSavedDescId", { name: savedName, id: newVersionId })
          : t("nettoyage.toast.versionSavedDescNoId"),
      });
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message, variant: "destructive" });
    } finally {
      state.setIsSavingProcessed(false);
    }
  };

  // ── Schema actions ──────────────────────────────────────────────────────────
  const dismissAlert = async (key: string, dismissed = true) => {
    if (!data.effectiveDatasetId) return;
    const next = new Set(state.dismissedAlertKeys);
    if (dismissed) next.add(key); else next.delete(key);
    state.setDismissedAlertKeys(next);
    writeFallbackSchema(projectId, data.effectiveDatasetId, state.kindOverrides, state.verifiedCategorical, next);
    try {
      await postSchemaAction(projectId, data.effectiveDatasetId, { schema_action: "dismiss_alert", alert_key: key, dismissed });
      await data.refreshProcessing(data.effectiveDatasetId, state.page);
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message ?? t("nettoyage.toast.schemaNotPersisted"), variant: "destructive" });
    }
  };

  const verifyCategorical = async (col: string, verified: boolean) => {
    if (!data.effectiveDatasetId) return;
    const next = new Set(state.verifiedCategorical);
    if (verified) next.add(col); else next.delete(col);
    state.setVerifiedCategorical(next);
    writeFallbackSchema(projectId, data.effectiveDatasetId, state.kindOverrides, next, state.dismissedAlertKeys);
    try {
      await postSchemaAction(projectId, data.effectiveDatasetId, { schema_action: "verify_categorical", column: col, verified });
      await data.refreshProcessing(data.effectiveDatasetId, state.page);
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message ?? t("nettoyage.toast.schemaNotPersisted"), variant: "destructive" });
    }
  };

  const setOverride = async (col: string, kind: ColumnKind) => {
    if (!data.effectiveDatasetId) return;
    const next = { ...state.kindOverrides, [col]: kind };
    state.setKindOverrides(next);
    state.setColumnMetaMap((prev) => {
      const out = { ...prev };
      if (out[col]) out[col] = { ...out[col], kind };
      return out;
    });
    try {
      // En mode édition de version, /column-kinds écrit la VersionColumnSchema
      // ET crée l'op `set_kind` dans le workspace, en transaction unique.
      // Sinon, postSchemaAction fait les deux côté dataset.
      if (data.isEditingVersion && data.versionId) {
        await dataService.saveVersionColumnKinds(projectId, data.versionId, { [col]: kind });
      } else {
        await postSchemaAction(projectId, data.effectiveDatasetId, { schema_action: "set_kind", column: col, kind });
      }
      await data.refreshProcessing(data.effectiveDatasetId, state.page);
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message ?? t("nettoyage.toast.typeNotPersisted"), variant: "destructive" });
    }
  };

  const clearOverride = async (col: string) => {
    if (!data.effectiveDatasetId) return;
    const next = { ...state.kindOverrides };
    delete next[col];
    state.setKindOverrides(next);
    state.setColumnMetaMap((prev) => {
      const out = { ...prev };
      if (out[col]) out[col] = { ...out[col], kind: inferKindFallback(col, out[col]?.dtype) };
      return out;
    });
    try {
      if (data.isEditingVersion && data.versionId) {
        await dataService.saveVersionColumnKinds(projectId, data.versionId, { [col]: null });
      } else {
        await postSchemaAction(projectId, data.effectiveDatasetId, { schema_action: "clear_kind", column: col });
      }
      await data.refreshProcessing(data.effectiveDatasetId, state.page);
    } catch (e) {
      toast({ title: t("nettoyage.toast.errorTitle"), description: (e as Error).message ?? t("nettoyage.toast.schemaNotPersisted"), variant: "destructive" });
    }
  };

  // ── Substitution modal ──────────────────────────────────────────────────────
  const openSubstitution = () => {
    const pre = state.selectedColumns.length === 1 ? state.selectedColumns[0] : "";
    state.setSubstColumn(pre);
    state.setSubstFrom("");
    state.setSubstTo("");
    state.setSubstCaseSensitive(true);
    state.setSubstTreatFromAsNull(false);
    state.setSubstTreatToAsNull(false);
    state.setShowSubstitutionModal(true);
  };

  const applySubstitution = async () => {
    if (!data.effectiveDatasetId) return;
    const col = state.substColumn || "";
    if (!col.trim()) {
      toast({ title: t("nettoyage.toast.colRequiredTitle"), description: t("nettoyage.toast.colRequiredDesc"), variant: "destructive" });
      return;
    }
    if (!state.columns.includes(col)) {
      toast({ title: t("nettoyage.toast.colInvalidTitle"), description: t("nettoyage.toast.colInvalidDesc"), variant: "destructive" });
      return;
    }
    if (!state.substTreatFromAsNull && state.substFrom.trim() === "") {
      toast({ title: t("nettoyage.toast.fromRequiredTitle"), description: t("nettoyage.toast.fromRequiredDesc"), variant: "destructive" });
      return;
    }
    await runCleaning(
      t("nettoyage.cleaning.substituteValues"),
      "substitute_values",
      {
        column: col,
        from_value: state.substTreatFromAsNull ? null : state.substFrom,
        to_value: state.substTreatToAsNull ? null : state.substTo,
        match_mode: "exact",
        case_sensitive: state.substCaseSensitive,
        treat_from_as_null: state.substTreatFromAsNull,
        treat_to_as_null: state.substTreatToAsNull,
      },
      [col],
    );
    state.setShowSubstitutionModal(false);
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigateToVersions = () => navigate(`/projects/${projectId}/versions`);

  /** Passe en mode édition d'une version spécifique. */
  const navigateToVersion = (versionId: number) =>
    navigate(`/projects/${projectId}/nettoyage?version=${versionId}`);

  /** Quitte le mode édition et revient au mode dataset normal. */
  const exitVersionMode = () => navigate(`/projects/${projectId}/nettoyage`);

  return {
    openInspector,
    alertCount,
    runCleaning,
    handleUndo,
    handleDownload,
    handleSave,
    commitVersion,
    confirmSaveVersion,
    dismissAlert,
    verifyCategorical,
    setOverride,
    clearOverride,
    openSubstitution,
    applySubstitution,
    navigateToVersions,
    navigateToVersion,
    exitVersionMode,
  };
}

export type NettoyageActions = ReturnType<typeof useNettoyageActions>;
