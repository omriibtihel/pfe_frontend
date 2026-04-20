import { Columns3, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  TrainingColumnTypeSelection,
  TrainingPreprocessingColumnConfig,
  TrainingPreprocessingDefaults,
} from "@/types";
import { BulkActionsBar } from "./BulkActionsBar";
import { ColumnFilterBar } from "./ColumnFilterBar";
import { ColumnRow } from "./ColumnRow";
import { parseOrdinalOrder } from "./helpers";
import type { Step3ColumnRowData, Step3Options, Step3StatusFilter, Step3TypeFilter } from "./types";

const AUTO_TYPE = "auto" as const;

export interface ColumnsCardProps {
  // Display state
  loadingColumns: boolean;
  rows: Step3ColumnRowData[];
  visibleRows: Step3ColumnRowData[];
  filteredRows: Step3ColumnRowData[];
  selectedColumns: Set<string>;
  expandedIssueRows: Set<string>;
  counts: { errors: number; warnings: number };
  options: Step3Options;
  // Filter bar
  searchQuery: string;
  statusFilter: Step3StatusFilter;
  typeFilter: Step3TypeFilter;
  // Pagination
  currentPage: number;
  totalPages: number;
  shouldPaginate: boolean;
  canUndo: boolean;
  // Callbacks — filters
  onSearchChange: (q: string) => void;
  onStatusFilterChange: (f: Step3StatusFilter) => void;
  onTypeFilterChange: (f: Step3TypeFilter) => void;
  onResetFilters: () => void;
  // Callbacks — bulk selection
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  // Callbacks — bulk actions
  onApplyDefaults: () => void;
  onResetSelected: () => void;
  onUndoBulk: () => void;
  onSetUse: (use: boolean) => void;
  onSetType: (type: TrainingColumnTypeSelection) => void;
  onSetEncoding: (enc: TrainingPreprocessingDefaults["categoricalEncoding"]) => void;
  // Callbacks — pagination
  onPagePrev: () => void;
  onPageNext: () => void;
  // Callbacks — row operations
  onToggleSelected: (columnName: string, checked: boolean) => void;
  onToggleExpanded: (columnName: string) => void;
  onRegisterRowRef: (columnName: string, node: HTMLTableRowElement | null) => void;
  onUpdateColumnConfig: (
    columnName: string,
    updater: (current: TrainingPreprocessingColumnConfig) => TrainingPreprocessingColumnConfig
  ) => void;
}

export function ColumnsCard({
  loadingColumns,
  rows,
  visibleRows,
  filteredRows,
  selectedColumns,
  expandedIssueRows,
  counts,
  options,
  searchQuery,
  statusFilter,
  typeFilter,
  currentPage,
  totalPages,
  shouldPaginate,
  canUndo,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onResetFilters,
  onSelectAllFiltered,
  onClearSelection,
  onApplyDefaults,
  onResetSelected,
  onUndoBulk,
  onSetUse,
  onSetType,
  onSetEncoding,
  onPagePrev,
  onPageNext,
  onToggleSelected,
  onToggleExpanded,
  onRegisterRowRef,
  onUpdateColumnConfig,
}: ColumnsCardProps) {
  // Derived — computed from props already in scope
  const rowNameSet = new Set(rows.map((r) => r.columnName));
  const selectedCount = [...selectedColumns].filter((n) => rowNameSet.has(n)).length;
  const filteredSelectedCount = filteredRows.filter((r) => selectedColumns.has(r.columnName)).length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== "all" || typeFilter !== "all";
  const activeRowsCount = rows.filter((r) => r.use).length;
  const statusFilterCounts = {
    all: rows.length,
    active: activeRowsCount,
    dropped: rows.length - activeRowsCount,
    errors: rows.filter((r) => r.errorCount > 0).length,
    warnings: rows.filter((r) => r.warningCount > 0).length,
  };

  return (
    <Card className="glass-premium shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-secondary/10">
            <Columns3 className="h-4 w-4 text-secondary" />
          </div>
          Colonnes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {counts.errors > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <XCircle className="h-4 w-4 mt-0.5" />
            <span>Configuration invalide : corrigez les erreurs avant de continuer.</span>
          </div>
        )}

        <ColumnFilterBar
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          statusFilterCounts={statusFilterCounts}
          filteredCount={filteredRows.length}
          totalCount={rows.length}
          filteredSelectedCount={filteredSelectedCount}
          counts={counts}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={onSearchChange}
          onStatusFilterChange={onStatusFilterChange}
          onTypeFilterChange={onTypeFilterChange}
          onResetFilters={onResetFilters}
        />

        <BulkActionsBar
          selectedCount={selectedCount}
          filteredCount={filteredRows.length}
          canUndo={canUndo}
          onSelectAllFiltered={onSelectAllFiltered}
          onClearSelection={onClearSelection}
          onApplyDefaults={onApplyDefaults}
          onResetSelected={onResetSelected}
          onUndoLastBulk={onUndoBulk}
          onSetUse={onSetUse}
          onSetType={onSetType}
          onSetEncoding={onSetEncoding}
        />

        {loadingColumns ? (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="space-y-0 divide-y divide-border/40">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-16 shrink-0" />
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 shrink-0" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>
        ) : !rows.length ? (
          <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
            Aucune feature disponible. Selectionnez une version et une cible.
          </div>
        ) : !visibleRows.length ? (
          <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
            Aucun resultat pour ce filtre.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="max-h-[560px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["État", "Sél.", "Colonne", "Inclure", "Type", "Valeurs manquantes", "Transformation", "Normalisation / Encodage", "Ordre ordinal"].map((header, i) => (
                        <TableHead
                          key={header}
                          className={`sticky top-0 z-20 bg-background/95 backdrop-blur ${
                            i === 0 ? "w-20" : i === 1 ? "w-12" : i === 3 ? "w-24" : i === 4 ? "w-44" : i === 5 ? "w-48" : i === 6 ? "w-44" : i === 7 ? "w-44" : i === 8 ? "w-56" : ""
                          }`}
                        >
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => (
                      <ColumnRow
                        key={row.columnName}
                        row={row}
                        options={options}
                        autoTypeValue={AUTO_TYPE}
                        isSelected={selectedColumns.has(row.columnName)}
                        isExpanded={expandedIssueRows.has(row.columnName)}
                        labelForMethod={(m) => m}
                        onRegisterRowRef={(node) => onRegisterRowRef(row.columnName, node)}
                        onToggleSelected={(checked) => onToggleSelected(row.columnName, checked)}
                        onToggleUse={(checked) =>
                          onUpdateColumnConfig(row.columnName, (c) => ({ ...c, use: checked }))
                        }
                        onTypeChange={(value) =>
                          onUpdateColumnConfig(row.columnName, (c) => {
                            const next = { ...c };
                            if (value === AUTO_TYPE) delete next.type;
                            else next.type = value;
                            if ((next.type ?? row.inferredType) !== "ordinal") delete next.ordinalOrder;
                            return next;
                          })
                        }
                        onNumericImputationChange={(value) =>
                          onUpdateColumnConfig(row.columnName, (c) => ({ ...c, numericImputation: value }))
                        }
                        onCategoricalImputationChange={(value) =>
                          onUpdateColumnConfig(row.columnName, (c) => ({ ...c, categoricalImputation: value }))
                        }
                        onNumericPowerTransformChange={(value) =>
                          onUpdateColumnConfig(row.columnName, (c) => ({ ...c, numericPowerTransform: value }))
                        }
                        onNumericScalingChange={(value) =>
                          onUpdateColumnConfig(row.columnName, (c) => ({ ...c, numericScaling: value }))
                        }
                        onCategoricalEncodingChange={(value) =>
                          onUpdateColumnConfig(row.columnName, (c) => {
                            const next = { ...c, categoricalEncoding: value };
                            if (value !== "ordinal") delete next.ordinalOrder;
                            return next;
                          })
                        }
                        onOrdinalOrderChange={(rawInput) =>
                          onUpdateColumnConfig(row.columnName, (c) => {
                            const parsed = parseOrdinalOrder(rawInput);
                            return { ...c, ordinalOrder: parsed.length ? parsed : undefined };
                          })
                        }
                        onToggleExpanded={() => onToggleExpanded(row.columnName)}
                        onKnnNeighborsChange={(v) =>
                          onUpdateColumnConfig(row.columnName, (c) => {
                            const next = { ...c };
                            if (v === undefined) delete next.knnNeighbors;
                            else next.knnNeighbors = v;
                            return next;
                          })
                        }
                        onConstantFillNumericChange={(v) =>
                          onUpdateColumnConfig(row.columnName, (c) => {
                            const next = { ...c };
                            if (v === undefined) delete next.constantFillNumeric;
                            else next.constantFillNumeric = v;
                            return next;
                          })
                        }
                        onConstantFillCategoricalChange={(v) =>
                          onUpdateColumnConfig(row.columnName, (c) => {
                            const next = { ...c };
                            if (v === undefined) delete next.constantFillCategorical;
                            else next.constantFillCategorical = v;
                            return next;
                          })
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {shouldPaginate && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={currentPage <= 1} onClick={onPagePrev}>
                  Précédent
                </Button>
                <span className="text-xs text-muted-foreground">Page {currentPage} / {totalPages}</span>
                <Button type="button" size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={onPageNext}>
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
