import { useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TrainingColumnTypeSelection, TrainingPreprocessingDefaults } from "@/types";

const BULK_AUTO_TYPE = "auto";

interface BulkActionsBarProps {
  selectedCount: number;
  filteredCount: number;
  canUndo: boolean;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onApplyDefaults: () => void;
  onResetSelected: () => void;
  onUndoLastBulk: () => void;
  onSetUse: (use: boolean) => void;
  onSetType: (type: TrainingColumnTypeSelection) => void;
  onSetEncoding: (encoding: TrainingPreprocessingDefaults["categoricalEncoding"]) => void;
}

export function BulkActionsBar({
  selectedCount,
  filteredCount,
  canUndo,
  onSelectAllFiltered,
  onClearSelection,
  onApplyDefaults,
  onResetSelected,
  onUndoLastBulk,
  onSetUse,
  onSetType,
  onSetEncoding,
}: BulkActionsBarProps) {
  const [bulkType, setBulkType] = useState<TrainingColumnTypeSelection>("auto");
  const [bulkEncoding, setBulkEncoding] =
    useState<TrainingPreprocessingDefaults["categoricalEncoding"]>("onehot");

  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-3 space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground">Actions en lot</p>
          <p className="text-[11px] text-muted-foreground">
            Selectionnez des colonnes puis appliquez des changements groupés.
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {selectedCount} selected
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSelectAllFiltered}
          disabled={filteredCount === 0}
        >
          Select all filtered
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClearSelection} disabled={!hasSelection}>
          Clear selection
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onUndoLastBulk}
          disabled={!canUndo}
          className="gap-1 ml-auto"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo last bulk change
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Templates</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onApplyDefaults}
            disabled={!hasSelection}
            className="w-full justify-start"
          >
            Apply defaults to selected columns
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onResetSelected}
            disabled={!hasSelection}
            className="w-full justify-start gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset selected columns
          </Button>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Usage / Type</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasSelection}
              onClick={() => onSetUse(true)}
            >
              Set use=true
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasSelection}
              onClick={() => onSetUse(false)}
            >
              Set use=false
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={bulkType === "auto" ? BULK_AUTO_TYPE : bulkType}
              onValueChange={(value) => setBulkType(value as TrainingColumnTypeSelection)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[170px]">
                <SelectValue placeholder="Set type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BULK_AUTO_TYPE}>Auto</SelectItem>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="categorical">Categorical</SelectItem>
                <SelectItem value="ordinal">Ordinal</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasSelection}
              onClick={() => onSetType(bulkType)}
            >
              Apply type
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Encoding</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={bulkEncoding}
              onValueChange={(value) =>
                setBulkEncoding(value as TrainingPreprocessingDefaults["categoricalEncoding"])
              }
            >
              <SelectTrigger className="h-9 w-full sm:w-[170px]">
                <SelectValue placeholder="Set encoding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                <SelectItem value="onehot">One-Hot</SelectItem>
                <SelectItem value="ordinal">Ordinal</SelectItem>
                <SelectItem value="label">Label</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasSelection}
              onClick={() => onSetEncoding(bulkEncoding)}
            >
              Apply encoding
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkActionsBar;
