import { Fragment } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrainingColumnTypeSelection, TrainingPreprocessingDefaults } from "@/types";
import { cn } from "@/lib/utils";

import type { Step3ColumnRowData, Step3Options } from "./types";

interface ColumnRowProps {
  row: Step3ColumnRowData;
  options: Step3Options;
  autoTypeValue: string;
  isSelected: boolean;
  isExpanded: boolean;
  labelForMethod: (value: string) => string;
  onRegisterRowRef: (node: HTMLTableRowElement | null) => void;
  onToggleSelected: (checked: boolean) => void;
  onToggleUse: (checked: boolean) => void;
  onTypeChange: (value: TrainingColumnTypeSelection) => void;
  onNumericImputationChange: (value: TrainingPreprocessingDefaults["numericImputation"]) => void;
  onCategoricalImputationChange: (value: TrainingPreprocessingDefaults["categoricalImputation"]) => void;
  onNumericScalingChange: (value: TrainingPreprocessingDefaults["numericScaling"]) => void;
  onCategoricalEncodingChange: (value: TrainingPreprocessingDefaults["categoricalEncoding"]) => void;
  onOrdinalOrderChange: (rawInput: string) => void;
  onToggleExpanded: () => void;
  onKnnNeighborsChange: (v: number | undefined) => void;
  onConstantFillNumericChange: (v: number | undefined) => void;
  onConstantFillCategoricalChange: (v: string | undefined) => void;
}

function getStatusMeta(row: Step3ColumnRowData): {
  label: string;
  icon: React.ReactNode;
  className: string;
  rowClassName?: string;
} {
  if (row.errorCount > 0) {
    return {
      label: `${row.errorCount} error(s)`,
      icon: <XCircle className="h-4 w-4 text-destructive" />,
      className: "text-destructive",
      rowClassName: "bg-destructive/5",
    };
  }

  if (row.warningCount > 0) {
    return {
      label: `${row.warningCount} warning(s)`,
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      className: "text-amber-600",
      rowClassName: "bg-amber-50/40",
    };
  }

  return {
    label: "OK",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    className: "text-emerald-600",
  };
}

export function ColumnRow({
  row,
  options,
  autoTypeValue,
  isSelected,
  isExpanded,
  labelForMethod,
  onRegisterRowRef,
  onToggleSelected,
  onToggleUse,
  onTypeChange,
  onNumericImputationChange,
  onCategoricalImputationChange,
  onNumericScalingChange,
  onCategoricalEncodingChange,
  onOrdinalOrderChange,
  onToggleExpanded,
  onKnnNeighborsChange,
  onConstantFillNumericChange,
  onConstantFillCategoricalChange,
}: ColumnRowProps) {
  const statusMeta = getStatusMeta(row);
  const hasIssues = row.issues.length > 0;
  const { globalAdvancedParams } = row;

  return (
    <Fragment>
      <TableRow
        ref={onRegisterRowRef}
        className={cn("align-top transition-colors", statusMeta.rowClassName, !row.use && "opacity-70")}
        data-testid={`column-row-${row.columnName}`}
      >
        <TableCell className="w-20">
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`status-${row.columnName}-${row.status}`}
                    className={cn("inline-flex items-center", statusMeta.className)}
                  >
                    {statusMeta.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-80 text-xs">
                  <p className="font-semibold">{statusMeta.label}</p>
                  {hasIssues && (
                    <p className="mt-1">
                      {row.issues
                        .slice(0, 2)
                        .map((issue) => issue.message)
                        .join(" | ")}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {hasIssues && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {row.errorCount + row.warningCount}
              </Badge>
            )}

            {hasIssues && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={onToggleExpanded}
                aria-label={`toggle-issues-${row.columnName}`}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </TableCell>

        <TableCell className="w-12">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelected(Boolean(checked))}
            aria-label={`select-${row.columnName}`}
          />
        </TableCell>

        <TableCell>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{row.columnName}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {row.selectedType === "auto" ? `auto: ${row.inferredType}` : `override: ${row.selectedType}`}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              source: {row.column.type} | null: {row.column.nullCount} | unique: {row.column.uniqueCount}
            </p>
          </div>
        </TableCell>

        <TableCell className="w-24">
          <div className="space-y-1">
            <Switch
              checked={row.use}
              onCheckedChange={(checked) => onToggleUse(Boolean(checked))}
              aria-label={`use-${row.columnName}`}
            />
            {!row.use && <p className="text-[10px] text-muted-foreground">Dropped</p>}
          </div>
        </TableCell>

        <TableCell className="w-44">
          <Select
            value={row.selectedType === "auto" ? autoTypeValue : row.selectedType}
            onValueChange={(value) => onTypeChange(value as TrainingColumnTypeSelection)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={autoTypeValue}>Auto</SelectItem>
              <SelectItem value="numeric">Numeric</SelectItem>
              <SelectItem value="categorical">Categorical</SelectItem>
              <SelectItem value="ordinal">Ordinal</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>

        {/* ── Imputation cell ──────────────────────────────────────────── */}
        <TableCell className="w-48">
          {row.effectiveType === "numeric" ? (
            <div className="space-y-1">
              <Select
                value={row.numericImputation}
                onValueChange={(value) =>
                  onNumericImputationChange(value as TrainingPreprocessingDefaults["numericImputation"])
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.numericImputation.map((method) => (
                    <SelectItem key={method} value={method}>
                      {labelForMethod(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* knn: show k input */}
              {row.numericImputation === "knn" && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground shrink-0">k =</span>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    className="h-7 text-xs"
                    placeholder={String(globalAdvancedParams.knnNeighbors)}
                    value={row.knnNeighbors ?? ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      onKnnNeighborsChange(isNaN(v) ? undefined : Math.max(1, Math.min(50, v)));
                    }}
                  />
                </div>
              )}

              {/* constant: show fill_value input */}
              {row.numericImputation === "constant" && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground shrink-0">fill =</span>
                  <Input
                    type="number"
                    step="any"
                    className="h-7 text-xs"
                    placeholder={String(globalAdvancedParams.constantFillNumeric)}
                    value={row.constantFillNumeric ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onConstantFillNumericChange(isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <Select
                value={row.categoricalImputation}
                onValueChange={(value) =>
                  onCategoricalImputationChange(value as TrainingPreprocessingDefaults["categoricalImputation"])
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.categoricalImputation.map((method) => (
                    <SelectItem key={method} value={method}>
                      {labelForMethod(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* constant: show fill_value input */}
              {row.categoricalImputation === "constant" && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground shrink-0">fill =</span>
                  <Input
                    className="h-7 text-xs"
                    placeholder={globalAdvancedParams.constantFillCategorical}
                    value={row.constantFillCategorical ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onConstantFillCategoricalChange(v === "" ? undefined : v);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </TableCell>

        <TableCell className="w-48">
          {row.effectiveType === "numeric" ? (
            <Select
              value={row.numericScaling}
              onValueChange={(value) =>
                onNumericScalingChange(value as TrainingPreprocessingDefaults["numericScaling"])
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.numericScaling.map((method) => (
                  <SelectItem key={method} value={method}>
                    {labelForMethod(method)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={row.categoricalEncoding}
              onValueChange={(value) =>
                onCategoricalEncodingChange(value as TrainingPreprocessingDefaults["categoricalEncoding"])
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.categoricalEncoding.map((method) => (
                  <SelectItem key={method} value={method}>
                    {labelForMethod(method)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </TableCell>

        <TableCell className="w-56">
          {row.effectiveType === "ordinal" ? (
            <Input
              value={row.ordinalOrder.join(", ")}
              placeholder="faible, moyen, eleve"
              onChange={(event) => onOrdinalOrderChange(event.target.value)}
            />
          ) : (
            <span className="text-xs text-muted-foreground">N/A</span>
          )}
        </TableCell>
      </TableRow>

      {hasIssues && isExpanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={8}>
            <div className="space-y-1 pl-1">
              {row.issues.map((issue) => (
                <p
                  key={issue.id}
                  className={cn("text-xs", issue.severity === "error" ? "text-destructive" : "text-amber-700")}
                >
                  [{issue.severity === "error" ? "ERR" : "WARN"}] [{issue.source}] {issue.message}
                </p>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export default ColumnRow;
