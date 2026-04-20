import type { TrainingConfig } from "@/types";
import { DistributionInsightBanner } from "./step3/DistributionInsightBanner";
import { DefaultsPanel } from "./step3/DefaultsPanel";
import { IssuesPanel } from "./step3/IssuesPanel";
import { ColumnsCard } from "./step3/ColumnsCard";
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
  const {
    loadingColumns, rows, visibleRows, filteredRows,
    selectedColumns, expandedIssueRows,
    counts, issuesList, options, preprocessing,
    isValidating, lastValidatedAt, validationError,
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
        currentDefaults={preprocessing.defaults}
        currentColumns={preprocessing.columns}
        onProfileLoaded={setColumnProfile}
        onApplyGlobalDefaults={applyGlobalDefaults}
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
    </div>
  );
}

export default Step3ColumnPreprocessing;
