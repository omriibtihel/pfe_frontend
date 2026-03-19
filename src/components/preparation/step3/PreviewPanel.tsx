import { Columns3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TrainingValidationPreviewMode, TrainingValidationPreviewSubset } from '@/types';

const PREVIEW_SAMPLE_SIZE_OPTIONS: number[] = [50, 100, 200];
const PREVIEW_RANDOM_SEED = 42;

function formatPreviewCell(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface PreviewPanelProps {
  previewColumns: string[];
  previewRows: unknown[][];
  previewMeta: Record<string, unknown> | null | undefined;
  isValidating: boolean;
  validationError: string | null;
  previewSubset: TrainingValidationPreviewSubset;
  previewMode: TrainingValidationPreviewMode;
  previewN: number;
  valSubsetAvailable: boolean;
  testSubsetAvailable: boolean;
  onPreviewSubsetChange: (subset: TrainingValidationPreviewSubset) => void;
  onPreviewModeChange: (mode: TrainingValidationPreviewMode) => void;
  onPreviewNChange: (n: number) => void;
}

export function PreviewPanel({
  previewColumns,
  previewRows,
  previewMeta,
  isValidating,
  validationError,
  previewSubset,
  previewMode,
  previewN,
  valSubsetAvailable,
  testSubsetAvailable,
  onPreviewSubsetChange,
  onPreviewModeChange,
  onPreviewNChange,
}: PreviewPanelProps) {
  const hasPreviewTable = previewColumns.length > 0;
  const previewSubsetLabel = String(previewMeta?.subset ?? previewSubset).toUpperCase();
  const previewSplitSeed = Number(previewMeta?.splitSeed ?? PREVIEW_RANDOM_SEED);
  const previewFromCache = Boolean(previewMeta?.fromCache);

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <Columns3 className="h-4 w-4 text-primary" />
          </div>
          Preview (transformed)
          <Badge variant="secondary" className="ml-auto text-xs">
            fit sur TRAIN uniquement
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Bloc informatif: la generation du preview peut etre plus lente que le panneau d'issues.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Subset</span>
            <select
              aria-label="preview-subset"
              data-testid="preview-subset"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={previewSubset}
              onChange={(e) => onPreviewSubsetChange(e.target.value as TrainingValidationPreviewSubset)}
            >
              <option value="train">Train</option>
              <option value="val" disabled={!valSubsetAvailable}>Val</option>
              <option value="test" disabled={!testSubsetAvailable}>Test</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Mode</span>
            <select
              aria-label="preview-mode"
              data-testid="preview-mode"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={previewMode}
              onChange={(e) => onPreviewModeChange(e.target.value as TrainingValidationPreviewMode)}
            >
              <option value="head">Head</option>
              <option value="random">Random</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Rows</span>
            <select
              aria-label="preview-n"
              data-testid="preview-n"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={String(previewN)}
              onChange={(e) => onPreviewNChange(Number(e.target.value))}
            >
              {PREVIEW_SAMPLE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        <Badge variant="outline" className="text-xs" data-testid="preview-meta-badge">
          Preview fitted on TRAIN (seed={previewSplitSeed}) - subset: {previewSubsetLabel} - fromCache:{' '}
          {previewFromCache ? 'true' : 'false'}
        </Badge>

        {hasPreviewTable ? (
          <div className="space-y-2">
            {isValidating && (
              <p className="text-xs text-muted-foreground" data-testid="preview-updating">
                Updating preview...
              </p>
            )}
            {validationError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700">
                Latest preview update failed. Showing previous preview.
              </div>
            )}
            <div
              className="max-h-[360px] rounded-lg border border-border/60 overflow-auto"
              data-testid="preview-transformed-table"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewColumns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.length ? (
                    previewRows.map((row, rowIndex) => (
                      <TableRow key={`preview-row-${rowIndex}`}>
                        {previewColumns.map((col, colIndex) => (
                          <TableCell key={`${col}-${rowIndex}-${colIndex}`} className="font-mono text-xs">
                            {formatPreviewCell(row[colIndex])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={Math.max(1, previewColumns.length)} className="text-xs text-muted-foreground">
                        Preview returned no rows.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : isValidating ? (
          <div className="rounded-lg border border-border/60 p-3 space-y-2" data-testid="preview-loading">
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
          </div>
        ) : validationError ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            data-testid="preview-error"
          >
            {validationError}
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground" data-testid="preview-empty">
            No preview data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
