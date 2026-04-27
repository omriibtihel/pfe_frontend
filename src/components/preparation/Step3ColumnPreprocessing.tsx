import { useState } from "react";
import type { TrainingConfig } from "@/types";
import type { TrainingValidationPreviewMode, TrainingValidationPreviewSubset } from "@/types/training/base";
import { DistributionInsightBanner } from "./step3/DistributionInsightBanner";
import { DefaultsPanel } from "./step3/DefaultsPanel";
import { IssuesPanel } from "./step3/IssuesPanel";
import { ColumnsCard } from "./step3/ColumnsCard";
import { PreviewPanel } from "./step3/PreviewPanel";
import { useStep3ColumnPreprocessing } from "./step3/useStep3ColumnPreprocessing";
import type { Step3ValidationState } from "./step3/types";

export type { Step3ValidationState };

interface Step3Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
  onValidationStateChange?: (state: Step3ValidationState) => void;
  /** Désactive la validation serveur (utile quand les modèles ne sont pas encore sélectionnés) */
  serverValidationEnabled?: boolean;
}

export function Step3ColumnPreprocessing({
  projectId,
  config,
  onConfigChange,
  onValidationStateChange,
  serverValidationEnabled = true,
}: Step3Props) {
  const [previewSubset, setPreviewSubset] = useState<TrainingValidationPreviewSubset>('train');
  const [previewMode, setPreviewMode] = useState<TrainingValidationPreviewMode>('head');
  const [previewN, setPreviewN] = useState(50);

  const {
    loadingColumns, rows, visibleRows, filteredRows,
    selectedColumns, expandedIssueRows,
    counts, issuesList, options, preprocessing,
    isValidating, lastValidatedAt, validationError, serverResult,
    searchQuery, statusFilter, typeFilter,
    currentPage, totalPages, shouldPaginate, canUndo,
    setSearchQuery, setStatusFilter, setTypeFilter, resetFilters,
    selectAllFiltered, clearSelection, toggleSelected, toggleExpanded,
    applyDefaultsToSelected, resetSelectedColumns,
    setUseForSelected, setTypeForSelected, setEncodingForSelected,
    undoBulk, registerRowRef, pageNext, pagePrev,
    setDefaultValue, setAdvancedParams, updateColumnConfig,
    setColumnProfile, applyGlobalDefaults, applyPerColumn, navigateToIssue,
  } = useStep3ColumnPreprocessing({
    projectId, config, onConfigChange, onValidationStateChange, serverValidationEnabled,
  });

  return (
    <div className="space-y-6">
      <DistributionInsightBanner
        projectId={projectId}
        versionId={config.datasetVersionId}
        targetColumn={config.targetColumn}
        currentColumns={preprocessing.columns}
        onProfileLoaded={setColumnProfile}
        onApplyPerColumn={applyPerColumn}
      />

      <DefaultsPanel
        preprocessing={preprocessing}
        options={options}
        onSetDefault={setDefaultValue}
        onSetAdvancedParams={setAdvancedParams}
      />

      <IssuesPanel
        counts={counts}
        issues={issuesList}
        isValidating={isValidating}
        lastValidatedAt={lastValidatedAt}
        validationError={validationError}
        onIssueClick={navigateToIssue}
      />

      <ColumnsCard
        loadingColumns={loadingColumns}
        rows={rows}
        visibleRows={visibleRows}
        filteredRows={filteredRows}
        selectedColumns={selectedColumns}
        expandedIssueRows={expandedIssueRows}
        counts={counts}
        options={options}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        currentPage={currentPage}
        totalPages={totalPages}
        shouldPaginate={shouldPaginate}
        canUndo={canUndo}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onResetFilters={resetFilters}
        onSelectAllFiltered={selectAllFiltered}
        onClearSelection={clearSelection}
        onApplyDefaults={applyDefaultsToSelected}
        onResetSelected={resetSelectedColumns}
        onUndoBulk={undoBulk}
        onSetUse={setUseForSelected}
        onSetType={setTypeForSelected}
        onSetEncoding={setEncodingForSelected}
        onPagePrev={pagePrev}
        onPageNext={pageNext}
        onToggleSelected={toggleSelected}
        onToggleExpanded={toggleExpanded}
        onRegisterRowRef={registerRowRef}
        onUpdateColumnConfig={updateColumnConfig}
      />

      <PreviewPanel
        previewColumns={serverResult?.previewTransformed?.columns ?? []}
        previewRows={serverResult?.previewTransformed?.rows ?? []}
        previewMeta={serverResult?.previewMeta ?? null}
        isValidating={isValidating}
        validationError={validationError}
        previewSubset={previewSubset}
        previewMode={previewMode}
        previewN={previewN}
        valSubsetAvailable={(serverResult?.previewMeta?.valSize ?? 0) > 0}
        testSubsetAvailable={(serverResult?.previewMeta?.testSize ?? 0) > 0}
        onPreviewSubsetChange={setPreviewSubset}
        onPreviewModeChange={setPreviewMode}
        onPreviewNChange={setPreviewN}
      />
    </div>
  );
}

export default Step3ColumnPreprocessing;
