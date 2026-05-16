/**
 * ColumnSchemaSection — section nettoyage + actions + tous les modaux overlay.
 * Comprend : Cleaning card, Actions card, et tous les modaux (substitution,
 * renommage, target, save-name, alerts, inspector).
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Settings2, Eraser, Save, Undo2, Trash2,
  Type as TypeIcon, RefreshCw, BookmarkPlus,
  ChevronsUpDown, X, Plus, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { ColumnSelector } from "@/components/nettoyage/ColumnSelector";
import { AlertsModal } from "@/components/nettoyage/AlertsModal";
import { InspectorModal } from "@/components/nettoyage/InspectorModal";

import type { NettoyageState } from "./useNettoyageState";
import type { NettoyageData } from "./useNettoyageData";
import type { NettoyageActions } from "./useNettoyageActions";

// ── Props ─────────────────────────────────────────────────────────────────────
interface ColumnSchemaSectionProps {
  state: NettoyageState;
  data: NettoyageData;
  actions: NettoyageActions;
  projectId: string;
  hasUnsavedChanges: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ColumnSchemaSection({ state, data, actions, projectId, hasUnsavedChanges }: ColumnSchemaSectionProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const disableProcessingActions = state.isLoading || state.isSwitchingDataset || !data.effectiveDatasetId;

  // ── Rename modal local state ───────────────────────────────────────────────
  const [renamePickerOpen, setRenamePickerOpen] = useState(false);
  const [renameSearch, setRenameSearch] = useState("");
  const [renameSelectedCol, setRenameSelectedCol] = useState("");
  const [renameNewName, setRenameNewName] = useState("");

  const renameFilteredCols = state.columns.filter(
    (c) => !renameSearch || c.toLowerCase().includes(renameSearch.toLowerCase()),
  );

  const handleRenameAdd = () => {
    const trimmed = renameNewName.trim();
    if (!renameSelectedCol || !trimmed || trimmed === renameSelectedCol) return;
    state.setRenameMap({ ...state.renameMap, [renameSelectedCol]: trimmed });
    setRenameSelectedCol("");
    setRenameNewName("");
  };

  return (
    <>
      {/* ── Cleaning + Actions grid ── */}
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
              {t("nettoyage.cleaning.title")}
            </CardTitle>
            <CardDescription>{t("nettoyage.cleaning.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Col 1 — Row 1 */}
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:bg-destructive/5 hover:border-destructive/30"
                disabled={disableProcessingActions || state.selectedColumns.length === 0}
                onClick={() => actions.runCleaning(t("nettoyage.cleaning.opDropColumns"), "drop_columns")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("nettoyage.cleaning.dropSelectedCols")}
              </Button>

              {/* Col 2 — Row 1 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? t("nettoyage.cleaning.opDropDupSubset") : t("nettoyage.cleaning.opDropDupAll"),
                    "drop_duplicates",
                    { keep: state.dupKeep },
                  )
                }
              >
                {t("nettoyage.cleaning.dropDuplicates", { scope: state.selectedColumns.length ? t("nettoyage.cleaning.scopeSubset") : t("nettoyage.cleaning.scopeAll") })}
              </Button>

              {/* Col 1 — Row 2 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? t("nettoyage.cleaning.opDropEmptyRowsSubset") : t("nettoyage.cleaning.opDropEmptyRows"),
                    "drop_empty_rows",
                  )
                }
              >
                {t("nettoyage.cleaning.dropEmptyRows", { scope: state.selectedColumns.length ? t("nettoyage.cleaning.scopeSubset") : t("nettoyage.cleaning.scopeNone") })}
              </Button>

              {/* Col 2 — Row 2 */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-muted-foreground font-medium">{t("nettoyage.cleaning.keep")}</span>
                <Select
                  value={state.dupKeep}
                  onValueChange={(v) => state.setDupKeep(v === "last" ? "last" : "first")}
                  disabled={disableProcessingActions}
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">{t("nettoyage.cleaning.keepFirst")}</SelectItem>
                    <SelectItem value="last">{t("nettoyage.cleaning.keepLast")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Col 1 — Row 3 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? t("nettoyage.cleaning.opDropEmptyColsSubset") : t("nettoyage.cleaning.opDropEmptyCols"),
                    "drop_empty_cols",
                  )
                }
              >
                {t("nettoyage.cleaning.dropEmptyCols", { scope: state.selectedColumns.length ? t("nettoyage.cleaning.scopeSubset") : t("nettoyage.cleaning.scopeNone") })}
              </Button>

              {/* Col 2 — Row 3 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? t("nettoyage.cleaning.opStripSelection") : t("nettoyage.cleaning.opStripAuto"),
                    "strip_whitespace",
                  )
                }
              >
                <TypeIcon className="h-4 w-4 mr-2" />
                {t("nettoyage.cleaning.stripWhitespace", { scope: state.selectedColumns.length ? t("nettoyage.cleaning.scopeSelection") : t("nettoyage.cleaning.scopeAuto") })}
              </Button>

              {/* Col 1 — Row 4 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() => { state.setRenameMap({}); state.setShowRenameModal(true); }}
              >
                {t("nettoyage.cleaning.renameColumns")}
              </Button>

              {/* Col 2 — Row 4 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={actions.openSubstitution}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("nettoyage.cleaning.substituteValues")}
              </Button>

              <div className="sm:col-span-2">
                <ColumnSelector
                  key={`clean-${data.effectiveDatasetId ?? "x"}`}
                  columns={state.columns}
                  selectedColumns={state.selectedColumns}
                  onToggle={state.toggleColumn}
                  label={t("nettoyage.cleaning.columnsLabel")}
                  metaMap={state.columnMetaMap}
                />
              </div>

              <p className="sm:col-span-2 text-[11px] text-muted-foreground/70 leading-relaxed">
                {t("nettoyage.cleaning.tipPrefix")}
                <b>{t("nettoyage.cleaning.tipDup")}</b>{t("nettoyage.cleaning.tipComma")}
                <b>{t("nettoyage.cleaning.tipEmpty")}</b>{t("nettoyage.cleaning.tipAnd")}
                <b>{t("nettoyage.cleaning.tipStrip")}</b>{t("nettoyage.cleaning.tipMiddle")}
                <b>{t("nettoyage.cleaning.tipSubst")}</b>{t("nettoyage.cleaning.tipSuffix")}
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
              {t("nettoyage.actions.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            <Button
              variant="outline"
              className="w-full justify-start hover:bg-secondary/5"
              onClick={actions.handleUndo}
              disabled={disableProcessingActions || state.operations.length === 0}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              {t("nettoyage.actions.undoLast")}
            </Button>

            <Button
              className="w-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              disabled={disableProcessingActions || state.isSavingProcessed}
              onClick={actions.handleSave}
            >
              <Save className="h-4 w-4 mr-2" />
              {state.isSavingProcessed
                ? t("nettoyage.actions.saving")
                : data.isEditingVersion
                ? t("nettoyage.actions.saveUpdate")
                : t("nettoyage.actions.saveNew")}
            </Button>

            {hasUnsavedChanges ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block w-full" tabIndex={0}>
                      <Button className="w-full pointer-events-none" disabled>
                        {t("nettoyage.page.nextStep")}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {t("nettoyage.page.nextStepUnsavedHint")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button asChild className="w-full">
                <Link to={`/projects/${projectId}/preparation`}>
                  {t("nettoyage.page.nextStep")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              {t("nettoyage.actions.cleanedHintPrefix")}<b>{t("nettoyage.actions.cleanedHintBold")}</b>{t("nettoyage.actions.cleanedHintSuffix")}
            </p>

            {data.isEditingVersion && (
              <Button variant="ghost" className="w-full justify-start" onClick={actions.navigateToVersions} disabled={state.isLoading}>
                {t("nettoyage.actions.backToVersions")}
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Modaux ── */}

      {/* Substitution */}
      <Modal isOpen={state.showSubstitutionModal} onClose={() => state.setShowSubstitutionModal(false)} title={t("nettoyage.subst.title")} size="lg">
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">{t("nettoyage.subst.header")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("nettoyage.subst.examplePrefix")}<code>{t("nettoyage.subst.exampleQ")}</code>{t("nettoyage.subst.exampleBy")}<code>{t("nettoyage.subst.exampleEmpty")}</code>{t("nettoyage.subst.exampleEmptyAfter")}<code>{t("nettoyage.subst.exampleUnknown")}</code>{t("nettoyage.subst.exampleMode")}<b>{t("nettoyage.subst.exampleExact")}</b>{t("nettoyage.subst.exampleEnd")}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("nettoyage.subst.columnLabel")}</p>
            <Select value={state.substColumn || ""} onValueChange={(v) => state.setSubstColumn(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={state.selectedColumns.length === 1 ? t("nettoyage.subst.columnSelected", { col: state.selectedColumns[0] }) : t("nettoyage.subst.columnPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {state.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("nettoyage.subst.fromLabel")}</p>
                <Input value={state.substFrom} onChange={(e) => state.setSubstFrom(e.target.value)} placeholder={t("nettoyage.subst.fromPlaceholder")} disabled={state.substTreatFromAsNull} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={state.substTreatFromAsNull} onCheckedChange={(v) => state.setSubstTreatFromAsNull(Boolean(v))} className="h-3.5 w-3.5" />
                  {t("nettoyage.subst.fromAsNull")}
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("nettoyage.subst.toLabel")}</p>
                <Input value={state.substTo} onChange={(e) => state.setSubstTo(e.target.value)} placeholder={t("nettoyage.subst.toPlaceholder")} disabled={state.substTreatToAsNull} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={state.substTreatToAsNull} onCheckedChange={(v) => state.setSubstTreatToAsNull(Boolean(v))} className="h-3.5 w-3.5" />
                  {t("nettoyage.subst.toAsNull")}
                </label>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={state.substCaseSensitive} onCheckedChange={(v) => state.setSubstCaseSensitive(Boolean(v))} className="h-3.5 w-3.5" />
                {t("nettoyage.subst.caseSensitive")}
              </label>
              <Badge variant="outline" className="text-[11px]">{t("nettoyage.subst.modeExact")}</Badge>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => state.setShowSubstitutionModal(false)}>{t("nettoyage.subst.cancel")}</Button>
            <Button onClick={actions.applySubstitution} disabled={disableProcessingActions}>{t("nettoyage.subst.apply")}</Button>
          </div>
        </div>
      </Modal>

      {/* Renommage */}
      <Modal
        isOpen={state.showRenameModal}
        onClose={() => state.setShowRenameModal(false)}
        title={t("nettoyage.rename.title")}
        size="lg"
      >
        <div className="space-y-4">
          {/* Sélecteur + input */}
          <div className="flex items-center gap-2">
            <Popover open={renamePickerOpen} onOpenChange={setRenamePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-52 justify-between font-normal" size="sm">
                  <span className="truncate">{renameSelectedCol || t("nettoyage.rename.pickColumn")}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder={t("nettoyage.rename.search")}
                    value={renameSearch}
                    onChange={(e) => setRenameSearch(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {renameFilteredCols.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">{t("nettoyage.rename.noResult")}</p>
                  ) : (
                    renameFilteredCols.map((col) => (
                      <button
                        key={col}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors truncate"
                        onClick={() => {
                          setRenameSelectedCol(col);
                          setRenameSearch("");
                          setRenamePickerOpen(false);
                        }}
                      >
                        {col}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground shrink-0">→</span>

            <Input
              className="flex-1 h-8 text-sm"
              placeholder={t("nettoyage.rename.newNamePlaceholder")}
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameAdd(); }}
            />

            <Button size="sm" variant="outline" onClick={handleRenameAdd} disabled={!renameSelectedCol || !renameNewName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Liste des renommages en attente */}
          {Object.keys(state.renameMap).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("nettoyage.rename.pending")}</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {Object.entries(state.renameMap).map(([old, next]) => (
                  <div key={old} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                    <span className="font-medium truncate flex-1">{old}</span>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <span className="truncate flex-1 text-primary font-medium">{next}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => {
                        const m = { ...state.renameMap };
                        delete m[old];
                        state.setRenameMap(m);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => state.setShowRenameModal(false)}>{t("nettoyage.rename.cancel")}</Button>
            <Button
              onClick={async () => {
                if (!Object.keys(state.renameMap).length) {
                  toast({ title: t("nettoyage.rename.emptyTitle"), description: t("nettoyage.rename.emptyDesc"), variant: "destructive" });
                  return;
                }
                await actions.runCleaning(t("nettoyage.cleaning.opRename"), "rename_columns", { mapping: state.renameMap }, []);
                state.setShowRenameModal(false);
              }}
              disabled={disableProcessingActions || !Object.keys(state.renameMap).length}
            >
              {t("nettoyage.rename.apply", { n: Object.keys(state.renameMap).length })}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Target column */}
      <Modal isOpen={state.showTargetModal} onClose={() => state.setShowTargetModal(false)} title={t("nettoyage.target.title")} size="lg">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("nettoyage.target.desc")}
          </p>
          <Select value={state.tempTarget || ""} onValueChange={(v) => state.setTempTarget(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("nettoyage.target.placeholder")} /></SelectTrigger>
            <SelectContent>
              {state.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => state.setShowTargetModal(false)}>{t("nettoyage.target.later")}</Button>
            <Button
              onClick={async () => {
                if (!data.effectiveDatasetId) return;
                if (!state.tempTarget) {
                  toast({ title: t("nettoyage.target.requiredTitle"), description: t("nettoyage.target.requiredDesc"), variant: "destructive" });
                  return;
                }
                try {
                  await data.setTarget(data.effectiveDatasetId, state.tempTarget);
                  state.setTargetColumn(state.tempTarget);
                  state.setShowTargetModal(false);
                  toast({ title: t("nettoyage.target.savedTitle"), description: t("nettoyage.target.savedDesc", { col: state.tempTarget }) });
                } catch (e) {
                  toast({ title: t("nettoyage.target.errorTitle"), description: (e as Error).message, variant: "destructive" });
                }
              }}
              disabled={disableProcessingActions}
            >
              {t("nettoyage.target.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Nommer la version */}
      {(() => {
        const trimmed = state.saveVersionName.trim();
        const isDuplicateName = trimmed
          ? state.versions.some((v) => v.name.trim().toLowerCase() === trimmed.toLowerCase())
          : false;
        return (
          <Modal
            isOpen={state.showSaveNameModal}
            onClose={() => state.setShowSaveNameModal(false)}
            title={t("nettoyage.saveName.title")}
            description={t("nettoyage.saveName.desc")}
            size="sm"
            icon={<BookmarkPlus className="h-4 w-4" />}
            footer={
              <div className="flex justify-end gap-2.5">
                <Button variant="outline" size="sm" onClick={() => state.setShowSaveNameModal(false)}>{t("nettoyage.saveName.cancel")}</Button>
                <Button size="sm" onClick={actions.confirmSaveVersion} disabled={!trimmed || isDuplicateName}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {t("nettoyage.saveName.save")}
                </Button>
              </div>
            }
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("nettoyage.saveName.label")}</label>
              <Input
                value={state.saveVersionName}
                onChange={(e) => state.setSaveVersionName(e.target.value)}
                placeholder={t("nettoyage.saveName.placeholder")}
                onKeyDown={(e) => { if (e.key === "Enter" && trimmed && !isDuplicateName) actions.confirmSaveVersion(); }}
                autoFocus
                className={isDuplicateName ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {isDuplicateName ? (
                <p className="text-[11px] text-destructive">{t("nettoyage.saveName.duplicate")}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t("nettoyage.saveName.hint")}</p>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Inspector modal (externalisé) */}
      <InspectorModal
        open={state.inspectorOpen}
        onClose={() => state.setInspectorOpen(false)}
        col={state.inspectedCol}
        tab={state.inspectorTab}
        onTabChange={state.setInspectorTab}
        dtypes={state.dtypes}
        metaMap={state.columnMetaMap}
        kindOverrides={state.kindOverrides}
        verifiedCategorical={state.verifiedCategorical}
        projectId={projectId}
        effectiveDatasetId={data.effectiveDatasetId}
        disableActions={disableProcessingActions}
        onRefresh={() => { if (!data.effectiveDatasetId) return; void data.refreshProcessing(data.effectiveDatasetId, state.page); }}
        onRunCleaning={actions.runCleaning}
        onSetOverride={actions.setOverride}
        onClearOverride={actions.clearOverride}
        onVerifyCategorical={actions.verifyCategorical}
      />

      {/* Alerts modal (externalisé) */}
      <AlertsModal
        open={state.alertsOpen}
        onClose={() => state.setAlertsOpen(false)}
        metaMap={state.columnMetaMap}
        verifiedCategorical={state.verifiedCategorical}
        kindOverrides={state.kindOverrides}
        dismissedAlertKeys={state.dismissedAlertKeys}
        thresholds={data.alertThresholds}
        disableActions={disableProcessingActions}
        onDismissAlert={actions.dismissAlert}
        onVerifyCategorical={actions.verifyCategorical}
        onSetOverride={actions.setOverride}
        onClearOverride={actions.clearOverride}
        onRunCleaning={actions.runCleaning}
      />
    </>
  );
}
