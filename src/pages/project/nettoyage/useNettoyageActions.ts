/**
 * useNettoyageActions — tous les handlers métier (applyOp, saveVersion, schema…).
 * Aucun JSX. Consomme useNettoyageState + useNettoyageData.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

  // ── Inspector ───────────────────────────────────────────────────────────────
  const openInspector = (col: string) => {
    state.setInspectedCol(col);
    state.setInspectorTab("overview");
    state.setInspectorOpen(true);
  };

  // ── Alert count ─────────────────────────────────────────────────────────────
  const alertCount = useMemo(
    () => countVisibleAlerts(state.columnMetaMap, state.verifiedCategorical, state.kindOverrides, state.dismissedAlertKeys),
    [state.columnMetaMap, state.verifiedCategorical, state.kindOverrides, state.dismissedAlertKeys],
  );

  // ── Core cleaning runner ────────────────────────────────────────────────────
  const runCleaning = async (
    description: string,
    action: CleaningAction,
    params: Record<string, any> = {},
    overrideColumns?: string[],
  ) => {
    if (!data.effectiveDatasetId) {
      toast({ title: "Choisir un dataset", description: "Sélectionne un dataset avant d'appliquer une opération.", variant: "destructive" });
      return;
    }

    const selected = (overrideColumns ?? state.selectedColumns).filter(Boolean);
    const safeCols = selected.filter((c) => state.columns.includes(c));
    const removed = selected.filter((c) => !state.columns.includes(c));

    if (removed.length) {
      toast({ title: "Sélection invalide", description: `Colonnes ignorées (autre dataset): ${removed.join(", ")}`, variant: "destructive" });
      return;
    }
    if (action === "drop_columns" && safeCols.length === 0) {
      toast({ title: "Sélection requise", description: "Choisis au moins une colonne pour drop_columns.", variant: "destructive" });
      return;
    }

    try {
      await dataService.applyCleaningOperation(projectId, data.effectiveDatasetId, {
        type: "cleaning",
        description,
        columns: safeCols,
        params: { ...params, action },
      });
      await data.refreshProcessing(data.effectiveDatasetId, 1);
      const colInfo = safeCols.length ? ` sur ${safeCols.join(", ")}` : "";
      toast({ title: "Opération appliquée", description: `${description}${colInfo}` });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
    }
  };

  // ── Undo ────────────────────────────────────────────────────────────────────
  const handleUndo = async () => {
    if (!data.effectiveDatasetId) return;
    try {
      const res = await dataService.undoLastOperation(projectId, data.effectiveDatasetId);
      if (!((res as any)?.ok ?? true)) {
        toast({ title: "Rien à annuler", description: "Aucune opération trouvée.", variant: "destructive" });
        return;
      }
      await data.refreshProcessing(data.effectiveDatasetId, 1);
      toast({ title: "Opération annulée" });
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
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
      toast({ title: "Téléchargement", description: "Le fichier nettoyé a été téléchargé." });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
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
        toast({ title: "Workspace introuvable", description: "Impossible d'enregistrer sans workspace.", variant: "destructive" });
        return;
      }
      await dataService.commitVersionWorkspace(projectId, data.versionId, state.workspaceDatasetId);
      await data.loadVersionMeta(data.versionId);

      const ws = await dataService.getOrCreateVersionWorkspace(projectId, data.versionId);
      const newWsId = (ws as any)?.workspace_dataset_id ?? (ws as any)?.data?.workspace_dataset_id;
      if (!newWsId) throw new Error("Impossible de récupérer un nouveau workspace après l'enregistrement.");

      state.setWorkspaceDatasetId(newWsId);
      await data.refreshProcessing(newWsId, 1);
      toast({ title: "Version mise à jour", description: `La version #${data.versionId} a été mise à jour avec les nouvelles données.` });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      state.setIsSavingProcessed(false);
    }
  };

  const confirmSaveVersion = async () => {
    if (!data.effectiveDatasetId) return;
    state.setShowSaveNameModal(false);
    state.setIsSavingProcessed(true);
    try {
      const out = await dataService.saveCleanedAsVersion(projectId, data.effectiveDatasetId, {
        name: state.saveVersionName.trim() || undefined,
      });
      const newVersionId = (out as any)?.version_id ?? (out as any)?.id;
      const savedName = (out as any)?.name ?? state.saveVersionName.trim();
      toast({
        title: "Version enregistrée",
        description: newVersionId ? `"${savedName}" (version #${newVersionId}) ajoutée à l'historique.` : "Version ajoutée à l'historique.",
      });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      state.setIsSavingProcessed(false);
    }
  };

  // ── Rename parsing ──────────────────────────────────────────────────────────
  const parseRenameMapping = (): Record<string, string> | null => {
    try {
      const obj = JSON.parse(state.renameText);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
      const mapping: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof k !== "string" || typeof v !== "string") return null;
        const kk = k.trim(); const vv = (v as string).trim();
        if (!kk || !vv) return null;
        mapping[kk] = vv;
      }
      return Object.keys(mapping).length ? mapping : null;
    } catch { return null; }
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
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
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
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
    }
  };

  const setOverride = async (col: string, kind: ColumnKind) => {
    if (!data.effectiveDatasetId) return;
    const next = { ...state.kindOverrides, [col]: kind };
    state.setKindOverrides(next);
    state.setColumnMetaMap((prev) => {
      const out = { ...prev };
      if (out[col]) out[col] = { ...out[col], kind: kind as any };
      return out;
    });
    try {
      if (data.isEditingVersion && data.versionId) {
        await dataService.saveVersionColumnKinds(projectId, data.versionId, { [col]: kind });
        await data.refreshProcessing(data.effectiveDatasetId, state.page);
        return;
      }
      await postSchemaAction(projectId, data.effectiveDatasetId, { schema_action: "set_kind", column: col, kind });
      await data.refreshProcessing(data.effectiveDatasetId, state.page);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message ?? "Type non persisté", variant: "destructive" });
    }
  };

  const clearOverride = async (col: string) => {
    if (!data.effectiveDatasetId) return;
    const next = { ...state.kindOverrides };
    delete next[col];
    state.setKindOverrides(next);
    state.setColumnMetaMap((prev) => {
      const out = { ...prev };
      if (out[col]) out[col] = { ...out[col], kind: inferKindFallback(col, out[col]?.dtype) as any };
      return out;
    });
    try {
      if (data.isEditingVersion && data.versionId) {
        await dataService.saveVersionColumnKinds(projectId, data.versionId, { [col]: null });
        await data.refreshProcessing(data.effectiveDatasetId, state.page);
        return;
      }
      await postSchemaAction(projectId, data.effectiveDatasetId, { schema_action: "clear_kind", column: col });
      await data.refreshProcessing(data.effectiveDatasetId, state.page);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message ?? "Schema non persisté", variant: "destructive" });
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
    const col = (state.substColumn || "").trim();
    if (!col) {
      toast({ title: "Colonne requise", description: "Choisis une colonne pour la substitution.", variant: "destructive" });
      return;
    }
    if (!state.columns.includes(col)) {
      toast({ title: "Colonne invalide", description: "Cette colonne n'existe pas dans le dataset courant.", variant: "destructive" });
      return;
    }
    if (!state.substTreatFromAsNull && state.substFrom.trim() === "") {
      toast({ title: "Valeur à remplacer requise", description: 'Renseigne "From" (ou coche "From = null").', variant: "destructive" });
      return;
    }
    await runCleaning(
      "Substitution de valeurs",
      "substitute_values" as any,
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

  return {
    openInspector,
    alertCount,
    runCleaning,
    handleUndo,
    handleDownload,
    handleSave,
    commitVersion,
    confirmSaveVersion,
    parseRenameMapping,
    dismissAlert,
    verifyCategorical,
    setOverride,
    clearOverride,
    openSubstitution,
    applySubstitution,
    navigateToVersions,
  };
}

export type NettoyageActions = ReturnType<typeof useNettoyageActions>;
