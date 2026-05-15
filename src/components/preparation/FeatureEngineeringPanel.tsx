import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/services/apiClient";
import type { FeatureDef, FeatureDefMode, FeatureEngineeringConfig } from "@/types";
import {
  OPERATIONS,
  OPERATIONS_BY_CATEGORY,
  getOperation,
  isDefaultName,
  type Operation,
} from "@/utils/featureOperations";

// ─────────────────────────────────────────────────────────────────────────────
// API types
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewResult {
  name: string;
  preview_values: (number | null)[];
  error?: string | null;
}

interface PreviewResponse {
  available_columns: string[];
  results: PreviewResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["Deux colonnes", "Transformation", "Avec constante"] as const;

/** Feature flag — flip to true once the free-form Python editor is properly
 *  redesigned for non-technical users. */
const EXPRESSION_MODE_ENABLED = false;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBlankFeature(idx: number): FeatureDef {
  return {
    name: `feature_${idx + 1}`,
    enabled: true,
    expression: "",
    mode: "builder",
    opId: "",
    colSelections: {},
    constants: {},
  };
}

/** Normalize features from any previous localStorage format. */
function normalizeFeature(f: Partial<FeatureDef> | null | undefined): FeatureDef {
  const expression = f?.expression ?? "";
  const storedMode = f?.mode ?? (expression ? "advanced" : "builder");
  // When the Expression mode is disabled, force every feature into builder mode
  // (the advanced text input is unreachable until re-enabled).
  const mode: FeatureDefMode = EXPRESSION_MODE_ENABLED ? storedMode : "builder";
  return {
    name: f?.name ?? "feature",
    enabled: f?.enabled ?? true,
    expression,
    mode,
    opId: f?.opId ?? "",
    colSelections: f?.colSelections ?? {},
    constants: f?.constants ?? {},
  };
}

/** Wrap a column name in col('…') if it's not a plain identifier. */
function colRef(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `col('${name}')`;
}

/** Build the Python expression from an operation + filled selections. Returns "" when incomplete. */
function buildExprFromOp(
  op: Operation,
  colSelections: Record<string, string>,
  constants: Record<string, number>
): string {
  const colInputs = op.inputs.filter((i) => i.kind === "column");
  const constInputs = op.inputs.filter((i) => i.kind === "constant");
  const cols = colInputs.map((i) => colSelections[i.key] ?? "");
  if (cols.some((c) => !c)) return "";
  const consts: Record<string, number> = {};
  for (const ci of constInputs) {
    consts[ci.key] =
      constants[ci.key] !== undefined ? constants[ci.key] : ci.defaultValue ?? 0;
  }
  return op.buildExpr(cols, consts);
}

/** Suggest a name from an operation + filled selections. Returns "" when incomplete. */
function suggestNameFromOp(
  op: Operation,
  colSelections: Record<string, string>,
  constants: Record<string, number>
): string {
  if (!op.autoName) return "";
  const colInputs = op.inputs.filter((i) => i.kind === "column");
  const constInputs = op.inputs.filter((i) => i.kind === "constant");
  const cols = colInputs.map((i) => colSelections[i.key] ?? "");
  if (cols.some((c) => !c)) return "";
  const consts: Record<string, number> = {};
  for (const ci of constInputs) {
    consts[ci.key] =
      constants[ci.key] !== undefined ? constants[ci.key] : ci.defaultValue ?? 0;
  }
  return op.autoName(cols, consts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureCard — single feature row
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureCardProps {
  feat: FeatureDef;
  availableColumns: string[];
  previewResult?: PreviewResult;
  onUpdate: (patch: Partial<FeatureDef>) => void;
  onRemove: () => void;
}

function FeatureCard({
  feat,
  availableColumns,
  previewResult,
  onUpdate,
  onRemove,
}: FeatureCardProps) {
  const { t } = useTranslation();
  const mode: FeatureDefMode = feat.mode ?? "builder";
  const opId = feat.opId ?? "";
  const op = opId ? getOperation(opId) : undefined;
  const colSelections = feat.colSelections ?? {};
  const constants = feat.constants ?? {};

  // ── Builder helpers ─────────────────────────────────────────────────────
  const rebuildFromSelections = (
    nextCols: Record<string, string>,
    nextConsts: Record<string, number>,
    nextOp: Operation | undefined = op
  ) => {
    if (!nextOp) {
      onUpdate({ colSelections: nextCols, constants: nextConsts, expression: "" });
      return;
    }
    const expression = buildExprFromOp(nextOp, nextCols, nextConsts);
    const suggested = suggestNameFromOp(nextOp, nextCols, nextConsts);
    const name = isDefaultName(feat.name) && suggested ? suggested : feat.name;
    onUpdate({
      opId: nextOp.id,
      colSelections: nextCols,
      constants: nextConsts,
      expression,
      name,
    });
  };

  const handleOpChange = (newOpId: string) => {
    const newOp = getOperation(newOpId);
    if (!newOp) return;
    const newConsts: Record<string, number> = {};
    for (const inp of newOp.inputs) {
      if (inp.kind === "constant") {
        newConsts[inp.key] = inp.defaultValue ?? 0;
      }
    }
    rebuildFromSelections({}, newConsts, newOp);
  };

  const handleColSelect = (key: string, colName: string) => {
    rebuildFromSelections({ ...colSelections, [key]: colName }, constants);
  };

  const handleConstChange = (key: string, raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    rebuildFromSelections(colSelections, { ...constants, [key]: parsed });
  };

  const handleModeChange = (newMode: FeatureDefMode) => {
    onUpdate({ mode: newMode });
  };

  // ── Advanced-mode helpers ───────────────────────────────────────────────
  const advancedInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [colSearch, setColSearch] = useState("");

  const filteredColumns = colSearch.trim()
    ? availableColumns.filter((c) =>
        c.toLowerCase().includes(colSearch.toLowerCase())
      )
    : availableColumns;

  const insertAtCursor = (text: string) => {
    const el = advancedInputRef.current;
    if (!el) {
      onUpdate({ expression: (feat.expression ?? "") + text });
      return;
    }
    const start = el.selectionStart ?? feat.expression.length;
    const end = el.selectionEnd ?? feat.expression.length;
    const newExpr = feat.expression.slice(0, start) + text + feat.expression.slice(end);
    onUpdate({ expression: newExpr });
    requestAnimationFrame(() => {
      el.setSelectionRange(start + text.length, start + text.length);
      el.focus();
    });
  };

  return (
    <Card className={feat.enabled ? "" : "opacity-55"}>
      <CardContent className="py-4 px-5 space-y-3">

        {/* ── Row 1: toggle · name · mode · delete ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <Switch
            checked={feat.enabled}
            onCheckedChange={(v) => onUpdate({ enabled: v })}
            className="shrink-0"
          />
          <Input
            value={feat.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t("preparation.fe.namePlaceholder")}
            className="h-8 w-44 text-xs font-mono"
          />
          {feat.expression && isDefaultName(feat.name) && (
            <span className="text-[10px] text-amber-500 hidden sm:block">
              {t("preparation.fe.renameHint")}
            </span>
          )}

          {/* Mode picker (only shown when Expression mode is enabled) */}
          {EXPRESSION_MODE_ENABLED && (
            <div className="ml-auto flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => handleModeChange("builder")}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                  mode === "builder"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("preparation.fe.modeBuilder")}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("advanced")}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                  mode === "advanced"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("preparation.fe.modeAdvanced")}
              </button>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive",
                  !EXPRESSION_MODE_ENABLED && "ml-auto"
                )}
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("preparation.fe.remove")}</TooltipContent>
          </Tooltip>
        </div>

        {/* ── Builder mode ────────────────────────────────────────────── */}
        {mode === "builder" && (
          <div className="space-y-3">
            {/* Operation Select */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                {t("preparation.fe.operation")}
              </label>
              <Select value={opId || undefined} onValueChange={handleOpChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t("preparation.fe.operationPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {CATEGORY_ORDER.map((cat) => (
                    <SelectGroup key={cat}>
                      <SelectLabel className="text-[10px] uppercase tracking-wider">
                        {cat === "Deux colonnes" ? t("preparation.fe.catTwoCols")
                          : cat === "Transformation" ? t("preparation.fe.catTransform")
                          : t("preparation.fe.catConstant")}
                      </SelectLabel>
                      {(OPERATIONS_BY_CATEGORY[cat] ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {op && (
                <p className="text-[10px] text-muted-foreground italic">
                  {op.description}
                </p>
              )}
            </div>

            {/* Inputs */}
            {op && availableColumns.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {op.inputs.map((inp) =>
                  inp.kind === "column" ? (
                    <div key={inp.key} className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">
                        {inp.label}
                      </label>
                      <Select
                        value={colSelections[inp.key] || undefined}
                        onValueChange={(v) => handleColSelect(inp.key, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t("preparation.fe.colSelectPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {availableColumns.map((col) => (
                            <SelectItem
                              key={col}
                              value={col}
                              className="text-xs font-mono"
                            >
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div key={inp.key} className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">
                        {inp.label}
                      </label>
                      <Input
                        type="number"
                        value={
                          constants[inp.key] !== undefined
                            ? String(constants[inp.key])
                            : ""
                        }
                        placeholder={inp.placeholder ?? String(inp.defaultValue ?? 0)}
                        onChange={(e) => handleConstChange(inp.key, e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )
                )}
              </div>
            )}

            {op && availableColumns.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                {t("preparation.fe.colPickerNumericNone")}
              </p>
            )}

            {/* Generated expression (read-only) */}
            {op && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  {t("preparation.fe.generatedExpression")}
                </label>
                <div
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-mono",
                    feat.expression
                      ? "bg-muted/40 border-border/60"
                      : "bg-muted/20 border-dashed border-border/40 text-muted-foreground italic"
                  )}
                >
                  {feat.expression || t("preparation.fe.generatedExpressionPlaceholder")}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Advanced mode ───────────────────────────────────────────── */}
        {mode === "advanced" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">
                {t("preparation.fe.pythonExpression")}
              </label>
              <Input
                ref={advancedInputRef}
                value={feat.expression}
                onChange={(e) => onUpdate({ expression: e.target.value })}
                placeholder={t("preparation.fe.expressionPlaceholder")}
                className="h-8 text-xs font-mono"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground italic">
                {t("preparation.fe.pythonHelp")}
              </p>
            </div>

            {availableColumns.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  {t("preparation.fe.columnsLabel")}
                </p>
                <Popover
                  open={colPickerOpen}
                  onOpenChange={(o) => {
                    setColPickerOpen(o);
                    if (!o) setColSearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-xs justify-between w-full sm:w-72"
                    >
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Plus className="h-3.5 w-3.5" />
                        {t("preparation.fe.insertColumn")}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-72 p-0 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={colSearch}
                        onChange={(e) => setColSearch(e.target.value)}
                        placeholder={t("preparation.fe.searchColumnPlaceholder")}
                        className="flex-1 h-7 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {filteredColumns.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground italic">
                          {t("preparation.fe.noColumnMatch")}
                        </div>
                      ) : (
                        filteredColumns.map((col) => (
                          <button
                            type="button"
                            key={col}
                            onClick={() => {
                              insertAtCursor(colRef(col));
                              setColPickerOpen(false);
                              setColSearch("");
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted/60 transition-colors"
                          >
                            {col}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="border-t border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground bg-muted/30">
                      {t(availableColumns.length > 1
                        ? "preparation.fe.columnsCounterOther"
                        : "preparation.fe.columnsCounterOne",
                        { filtered: filteredColumns.length, total: availableColumns.length })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        )}

        {/* ── Preview result ─────────────────────────────────────────── */}
        {previewResult && (
          <div>
            {previewResult.error ? (
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="break-all">{previewResult.error}</span>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("preparation.fe.previewOk")}
                  {showPreview ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                {showPreview && (
                  <div className="mt-1 rounded bg-muted/50 border border-border/40 px-3 py-1.5 text-[11px] font-mono overflow-x-auto whitespace-nowrap">
                    [
                    {previewResult.preview_values
                      .map((v) => (v === null ? "null" : v.toFixed(4)))
                      .join(", ")}
                    ]
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureEngineeringPanel — main panel
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureEngineeringPanelProps {
  projectId: string;
  versionId: string;
  targetColumn: string;
  value: FeatureEngineeringConfig;
  onChange: (cfg: FeatureEngineeringConfig) => void;
}

export function FeatureEngineeringPanel({
  projectId,
  versionId,
  targetColumn,
  value,
  onChange,
}: FeatureEngineeringPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const features = value.features.map(normalizeFeature);

  const [columns, setColumns] = useState<string[]>([]);
  const [nRows, setNRows] = useState(0);
  const [isLoadingCols, setIsLoadingCols] = useState(false);
  const [colsError, setColsError] = useState<string | null>(null);

  const [previewMap, setPreviewMap] = useState<Record<string, PreviewResult>>({});
  const [isPreviewing, setIsPreviewing] = useState(false);

  // ── Load dataset columns ──────────────────────────────────────────────────
  const loadColumns = useCallback(() => {
    if (!versionId) { setColumns([]); return; }
    setIsLoadingCols(true);
    setColsError(null);
    const params = new URLSearchParams({ version_id: versionId });
    if (targetColumn) params.set("target_column", targetColumn);

    apiClient
      .get<{ columns: string[]; n_rows: number }>(
        `/projects/${projectId}/training/feature-engineering/columns?${params}`
      )
      .then((data) => { setColumns(data.columns); setNRows(data.n_rows); })
      .catch((err: Error) => {
        setColsError(err.message ?? t("preparation.fe.colsErrorFallback"));
        setColumns([]);
      })
      .finally(() => setIsLoadingCols(false));
  }, [projectId, versionId, targetColumn]);

  useEffect(() => { loadColumns(); }, [loadColumns]);

  // ── Feature list mutations ────────────────────────────────────────────────
  const setFeatures = useCallback(
    (next: FeatureDef[]) => onChange({ features: next }),
    [onChange]
  );

  const addFeature = () =>
    setFeatures([...features, makeBlankFeature(features.length)]);

  const removeFeature = (idx: number) => {
    const removed = features[idx].name;
    setFeatures(features.filter((_, i) => i !== idx));
    setPreviewMap((prev) => { const n = { ...prev }; delete n[removed]; return n; });
  };

  const updateFeature = (idx: number, patch: Partial<FeatureDef>) =>
    setFeatures(features.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    const active = features.filter(
      (f) => f.enabled && f.name.trim() && f.expression.trim()
    );
    if (active.length === 0) {
      toast({
        title: t("preparation.fe.noFeatureReadyTitle"),
        description: t("preparation.fe.noFeatureReadyDescBuilder"),
        variant: "destructive",
      });
      return;
    }
    setIsPreviewing(true);
    try {
      const data = await apiClient.post<PreviewResponse>(
        `/projects/${projectId}/training/feature-engineering/preview`,
        {
          version_id: Number(versionId),
          target_column: targetColumn,
          features: active.map((f) => ({
            name: f.name,
            expression: f.expression,
            enabled: f.enabled,
          })),
          n_rows: 8,
        }
      );
      const map: Record<string, PreviewResult> = {};
      for (const r of data.results) map[r.name] = r;
      setPreviewMap(map);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? t("preparation.fe.previewErrorDesc");
      toast({ title: t("preparation.fe.previewErrorTitle"), description: String(msg), variant: "destructive" });
    } finally {
      setIsPreviewing(false);
    }
  };

  const activeCount = features.filter((f) => f.enabled && f.expression.trim()).length;
  const previewOk = Object.values(previewMap).filter((r) => !r.error).length;
  const previewErr = Object.values(previewMap).filter((r) => r.error).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <Card>
        <CardContent className="py-4 px-6 flex items-center gap-4 flex-wrap">
          <div className="p-2.5 rounded-xl bg-violet-500/10 shrink-0">
            <FlaskConical className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{t("preparation.fe.title")}</h3>
              {activeCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {t(activeCount > 1 ? "preparation.fe.activeCountOther" : "preparation.fe.activeCountOne", { n: activeCount })}
                </Badge>
              )}
              {isLoadingCols && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {nRows > 0 && !isLoadingCols && (
                <span className="text-[10px] text-muted-foreground">
                  {t("preparation.fe.datasetInfo", { rows: nRows.toLocaleString(), cols: columns.length })}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <Trans i18nKey="preparation.fe.headerDescBuilder" components={{ strong: <strong /> }} />
              {EXPRESSION_MODE_ENABLED && (
                <Trans i18nKey="preparation.fe.headerDescAdvanced" components={{ strong: <strong /> }} />
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Column loading error ── */}
      {colsError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-destructive">
              {t("preparation.fe.loadError")}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 break-all">
              {colsError}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs shrink-0"
            onClick={loadColumns}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("preparation.fe.retry")}
          </Button>
        </div>
      )}

      {/* ── Feature cards ── */}
      {features.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          {t("preparation.fe.empty")}{" "}
          <button
            type="button"
            onClick={addFeature}
            className="underline hover:text-primary"
          >
            {t("preparation.fe.emptyLink")}
          </button>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {features.map((feat, idx) => (
            <FeatureCard
              key={idx}
              feat={feat}
              availableColumns={columns}
              previewResult={previewMap[feat.name]}
              onUpdate={(patch) => updateFeature(idx, patch)}
              onRemove={() => removeFeature(idx)}
            />
          ))}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={addFeature}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("preparation.fe.addFeature")}
        </Button>

        {features.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePreview}
            disabled={isPreviewing || !versionId || activeCount === 0}
            className="gap-2"
          >
            {isPreviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            {t("preparation.fe.testExpressions")}
          </Button>
        )}

        {(previewOk > 0 || previewErr > 0) && (
          <span className="ml-auto text-xs text-muted-foreground">
            {previewOk > 0 && (
              <span className="text-emerald-600">{t("preparation.fe.okCount", { n: previewOk })}</span>
            )}
            {previewErr > 0 && (
              <span className="text-destructive">
                {t(previewErr > 1 ? "preparation.fe.errorCountOther" : "preparation.fe.errorCountOne", { n: previewErr })}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
