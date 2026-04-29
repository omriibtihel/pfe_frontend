// src/pages/project/NettoyagePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { AlertTriangle, Info, GitBranch, X, RefreshCw, Download } from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";

import { useNettoyageState, PAGE_SIZE_OPTIONS } from "./nettoyage/useNettoyageState";
import { useNettoyageData, normalizeKind, inferKindFallback, kindLabel, kindBadgeClass } from "./nettoyage/useNettoyageData";
import { useNettoyageActions } from "./nettoyage/useNettoyageActions";
import { useUnsavedOpsGuard } from "./nettoyage/useUnsavedOpsGuard";
import { UnsavedOpsModal } from "./nettoyage/UnsavedOpsModal";
import { ColumnSchemaSection } from "./nettoyage/ColumnSchemaSection";
import { OperationsTimeline } from "./nettoyage/OperationsTimeline";

export function NettoyagePage() {
  const { id } = useParams();
  const projectId = id!;

  const state = useNettoyageState();
  const data = useNettoyageData(state, projectId);
  const actions = useNettoyageActions(state, data, projectId);

  const cleaningOpsCount = state.operations.filter((op) => op.op_type === "cleaning").length;

  // ── Guard: mode normal (dataset) ────────────────────────────────────────────
  const shouldWarnUnsaved = !data.isEditingVersion && state.hasDirtySession && cleaningOpsCount > 0;
  const blocker = useUnsavedOpsGuard(shouldWarnUnsaved);

  // ── Guard: mode édition version ─────────────────────────────────────────────
  // Snapshot le nombre d'opérations quand le workspace se stabilise (fin du
  // chargement initial). Toute augmentation ultérieure = changement non sauvegardé.
  const [versionOpsBaseline, setVersionOpsBaseline] = useState<number | null>(null);
  const lastSeenWorkspaceId = useRef<number | null>(null);

  useEffect(() => {
    if (!data.isEditingVersion) {
      lastSeenWorkspaceId.current = null;
      setVersionOpsBaseline(null);
      return;
    }
    const wsId = state.workspaceDatasetId;
    // Workspace a changé (nouvelle session ou après commit) → réinitialiser
    if (wsId !== lastSeenWorkspaceId.current) {
      lastSeenWorkspaceId.current = wsId;
      setVersionOpsBaseline(null);
      return;
    }
    // Workspace stable, chargement terminé → capturer la baseline une seule fois
    if (!state.isLoading && versionOpsBaseline === null) {
      setVersionOpsBaseline(cleaningOpsCount);
    }
  }, [data.isEditingVersion, state.workspaceDatasetId, state.isLoading, cleaningOpsCount, versionOpsBaseline]);

  const hasVersionUnsavedChanges =
    data.isEditingVersion && versionOpsBaseline !== null && cleaningOpsCount > versionOpsBaseline;

  const versionBlocker = useUnsavedOpsGuard(hasVersionUnsavedChanges);

  // ── Workspace cleanup on unmount ────────────────────────────────────────────
  // Updated every render via direct ref write (no re-render, no stale closure).
  const unmountRef = useRef({ cleanup: data.cleanupWorkspace, hasUnsaved: false });
  unmountRef.current.cleanup = data.cleanupWorkspace;
  unmountRef.current.hasUnsaved = shouldWarnUnsaved || hasVersionUnsavedChanges;

  useEffect(() => {
    return () => {
      if (!unmountRef.current.hasUnsaved) {
        void unmountRef.current.cleanup();
      }
    };
  }, []); // intentionally empty — fires only on unmount

  const disabled = state.isLoading || state.isSwitchingDataset || !data.effectiveDatasetId;

  const tableColumns = useMemo(
    () =>
      state.columns.map((c) => {
        const kind = normalizeKind(state.columnMetaMap?.[c]?.kind ?? inferKindFallback(c, state.dtypes?.[c]));
        const dtype = state.dtypes?.[c] ?? "unknown";
        return {
          key: c,
          header: (
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{c}</span>
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${kindBadgeClass(kind)}`}>{kindLabel(kind)}</Badge>
              <span className="text-[10px] text-muted-foreground/70 truncate hidden xl:inline">{dtype}</span>
            </div>
          ),
          onHeaderClick: () => actions.openInspector(c),
          headerClassName: "whitespace-nowrap",
        };
      }),
    [state.columns, state.columnMetaMap, state.dtypes],
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Column metadata error banner ── */}
        {data.columnsError && (
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3"
            data-testid="columns-error-banner"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">{data.columnsError}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={data.retryColumnsLoad}
              data-testid="columns-error-retry"
            >
              <RefreshCw className="h-3 w-3" />
              Réessayer
            </Button>
          </div>
        )}

        {/* ── Header ── */}
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
                <span className="text-gradient">Préparer</span>
                <span className="text-foreground"> — Nettoyage</span>
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-lg">
                {data.isEditingVersion
                  ? "Nettoyage d'une version (workspace isolé)"
                  : "Nettoyez vos données sans leakage. Le preprocessing ML se fait au training, après split."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* ── Mode normal : sélecteur de dataset + sélecteur de version à modifier ── */}
              {!data.isEditingVersion && (
                <>
                  <Select
                    value={state.activeDatasetId ? String(state.activeDatasetId) : undefined}
                    onValueChange={(v) => state.setActiveDatasetId(Number(v))}
                    disabled={state.isLoading || state.datasets.length === 0}
                  >
                    <SelectTrigger className="w-[240px] bg-background/60 backdrop-blur-sm">
                      <SelectValue placeholder="Choisir un dataset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {state.datasets.map((ds) => (
                        <SelectItem key={ds.id} value={String(ds.id)}>
                          {ds.original_name} (#{ds.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {state.versions.length > 0 && (
                    <Select
                      onValueChange={(v) => actions.navigateToVersion(Number(v))}
                      disabled={state.isLoading}
                    >
                      <SelectTrigger className="w-[240px] bg-background/60 backdrop-blur-sm">
                        <GitBranch className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Modifier une version..." />
                      </SelectTrigger>
                      <SelectContent>
                        {state.versions.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name} (#{v.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}

              {/* ── Mode édition : sélecteur de version courante + bouton quitter ── */}
              {data.isEditingVersion && (
                <>
                  <Select
                    value={data.versionId ? String(data.versionId) : undefined}
                    onValueChange={(v) => actions.navigateToVersion(Number(v))}
                    disabled={state.isLoading || state.versions.length === 0}
                  >
                    <SelectTrigger className="w-[260px] bg-background/60 backdrop-blur-sm">
                      <GitBranch className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Sélectionner une version..." />
                    </SelectTrigger>
                    <SelectContent>
                      {state.versions.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.name} (#{v.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={actions.exitVersionMode}
                    className="gap-1.5"
                    title="Revenir au mode dataset"
                  >
                    <X className="h-3.5 w-3.5" />
                    Quitter
                  </Button>

                  <Badge className="bg-gradient-to-r from-secondary to-accent text-secondary-foreground border-0 text-[11px]">
                    Workspace #{state.workspaceDatasetId ?? "…"}
                  </Badge>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => state.setAlertsOpen(true)}
                disabled={disabled}
                className="relative"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Alertes
                {actions.alertCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] flex items-center justify-center">
                    {actions.alertCount}
                  </span>
                )}
              </Button>

              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-medium">
                {state.columns.length} colonnes
              </Badge>

              <Button variant="outline" size="sm" onClick={actions.handleDownload} disabled={state.isLoading || state.isDownloading} className="gap-2">
                <Download className="h-4 w-4" />
                {state.isDownloading ? "Téléchargement..." : "Exporter"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Cleaning + Actions + Modaux ── */}
        <ColumnSchemaSection state={state} data={data} actions={actions} projectId={projectId} />

        {/* ── Preview + Historique ── */}
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
                      {state.totalRows ? `${state.totalRows.toLocaleString("fr-FR")} lignes` : "—"} • Page {state.page}/{data.totalPages} •{" "}
                      <span className="inline-flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" /> Clique sur une entête pour voir le profil
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(state.pageSize)}
                      onValueChange={(v) => {
                        const newSize = Number(v) as typeof PAGE_SIZE_OPTIONS[number];
                        state.setPageSize(newSize);
                        if (data.effectiveDatasetId) {
                          void data.refreshProcessing(data.effectiveDatasetId, 1, newSize);
                        }
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)} className="text-xs">
                            {n} lignes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline" size="sm"
                      disabled={disabled || state.page <= 1}
                      onClick={() => { const next = Math.max(1, state.page - 1); if (!data.effectiveDatasetId) return; void data.refreshProcessing(data.effectiveDatasetId, next); }}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      disabled={disabled || state.page >= data.totalPages}
                      onClick={() => { const next = Math.min(data.totalPages, state.page + 1); if (!data.effectiveDatasetId) return; void data.refreshProcessing(data.effectiveDatasetId, next); }}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="w-full overflow-x-auto rounded-xl border border-border/50">
                  <div className="min-w-[900px]">
                    <DataTable data={state.previewRows} columns={tableColumns} pageSize={state.pageSize} />
                  </div>
                </div>
                {state.columns.length > 10 && (
                  <p className="text-[11px] text-muted-foreground/70 mt-3">Astuce : scrolle horizontalement pour voir toutes les colonnes.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Historique */}
          <OperationsTimeline
            operations={state.operations}
            selectedOp={state.selectedOp}
            onSelectOp={state.setSelectedOp}
            columnMetaMap={state.columnMetaMap}
            dtypes={state.dtypes}
          />
        </motion.div>
      </div>

      <UnsavedOpsModal
        open={blocker.isBlocked}
        onStay={blocker.cancel}
        onLeave={() => { void data.cleanupWorkspace(); blocker.proceed(); }}
      />

      <UnsavedOpsModal
        open={versionBlocker.isBlocked}
        onStay={versionBlocker.cancel}
        onLeave={() => { void data.cleanupWorkspace(); versionBlocker.proceed(); }}
        title="Opérations non enregistrées sur cette version"
        description="Vous avez des opérations non sauvegardées sur cette version. Quitter sans enregistrer ?"
        stayLabel="Rester"
        leaveLabel="Quitter sans sauvegarder"
      />
    </AppLayout>
  );
}

export default NettoyagePage;
