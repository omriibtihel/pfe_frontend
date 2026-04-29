import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/services/apiClient";
import type { FeatureDef, FeatureEngineeringConfig } from "@/types";
import {
  OPERATIONS,
  OPERATIONS_BY_CATEGORY,
  getSnippet,
  isDefaultName,
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeBlankFeature(idx: number): FeatureDef {
  return { name: `feature_${idx + 1}`, enabled: true, expression: "" };
}

/** Normalize features from any previous localStorage format. */
function normalizeFeature(f: Partial<FeatureDef> | null | undefined): FeatureDef {
  return {
    name: f?.name ?? `feature`,
    enabled: f?.enabled ?? true,
    expression: f?.expression ?? "",
  };
}

/** Wrap a column name in col('…') if it's not a plain identifier. */
function colRef(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `col('${name}')`;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeCat, setActiveCat] = useState<string>(CATEGORY_ORDER[0]);
  const [showPreview, setShowPreview] = useState(false);

  // ── Insert text at the current cursor position in the expression input ──
  const insertAtCursor = (text: string) => {
    const el = inputRef.current;
    if (!el) {
      onUpdate({ expression: feat.expression + text });
      return;
    }
    const start = el.selectionStart ?? feat.expression.length;
    const end = el.selectionEnd ?? feat.expression.length;
    const newExpr =
      feat.expression.slice(0, start) + text + feat.expression.slice(end);
    onUpdate({ expression: newExpr });
    // Restore cursor after React re-renders
    requestAnimationFrame(() => {
      el.setSelectionRange(start + text.length, start + text.length);
      el.focus();
    });
  };

  const handleColClick = (col: string) => insertAtCursor(colRef(col));

  const handleOperationClick = (opId: string) => {
    const op = OPERATIONS.find((o) => o.id === opId);
    if (!op) return;
    const snippet = getSnippet(op);
    if (!feat.expression.trim()) {
      onUpdate({ expression: snippet });
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      insertAtCursor(snippet);
    }
  };

  return (
    <Card className={feat.enabled ? "" : "opacity-55"}>
      <CardContent className="py-4 px-5 space-y-3">

        {/* ── Row 1: toggle · name · delete ── */}
        <div className="flex items-center gap-3">
          <Switch
            checked={feat.enabled}
            onCheckedChange={(v) => onUpdate({ enabled: v })}
            className="shrink-0"
          />
          <Input
            value={feat.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="nom_feature"
            className="h-8 w-44 text-xs font-mono"
          />
          {feat.expression && isDefaultName(feat.name) && (
            <span className="text-[10px] text-amber-500 hidden sm:block">
              Pensez à renommer cette feature
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Supprimer</TooltipContent>
          </Tooltip>
        </div>

        {/* ── Row 2: expression input ── */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">
            Expression Python :
          </label>
          <Input
            ref={inputRef}
            value={feat.expression}
            onChange={(e) => onUpdate({ expression: e.target.value })}
            placeholder="ex : log1p(a / b)  ·  (x - y) * z  ·  sqrt(a ** 2 + b ** 2)"
            className="h-8 text-xs font-mono"
            spellCheck={false}
          />
        </div>

        {/* ── Row 3: column chips ── */}
        {availableColumns.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Colonnes disponibles{" "}
              <span className="text-[10px] opacity-70">(cliquer pour insérer)</span> :
            </p>
            <div className="flex flex-wrap gap-1">
              {availableColumns.map((col) => (
                <button
                  type="button"
                  key={col}
                  onClick={() => handleColClick(col)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/50 transition-colors"
                >
                  {col}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 4: operation snippets ── */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Opérations rapides{" "}
            <span className="text-[10px] opacity-70">(insère un modèle dans l'expression)</span> :
          </p>
          {/* Category tabs */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORY_ORDER.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                  activeCat === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Operation buttons */}
          <div className="flex flex-wrap gap-1.5">
            {(OPERATIONS_BY_CATEGORY[activeCat] ?? []).map((op) => (
              <Tooltip key={op.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleOperationClick(op.id)}
                    className="px-2.5 py-1 rounded-md text-[11px] border border-border/60 bg-background hover:border-primary/50 hover:bg-muted transition-colors font-mono"
                  >
                    {getSnippet(op)}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-52">
                  <span className="font-semibold">{op.label}</span>
                  <br />
                  {op.description}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* ── Row 5: preview result ── */}
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
                  Preview OK
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
        setColsError(err.message ?? "Impossible de charger les colonnes.");
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
        title: "Aucune feature prête",
        description: "Saisissez une expression dans au moins une feature active.",
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
          features: active,
          n_rows: 8,
        }
      );
      const map: Record<string, PreviewResult> = {};
      for (const r of data.results) map[r.name] = r;
      setPreviewMap(map);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "Erreur lors du calcul du preview.";
      toast({ title: "Erreur", description: String(msg), variant: "destructive" });
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
              <h3 className="font-semibold text-sm">Feature Engineering</h3>
              {activeCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {activeCount} feature{activeCount > 1 ? "s" : ""} actives
                </Badge>
              )}
              {isLoadingCols && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {nRows > 0 && !isLoadingCols && (
                <span className="text-[10px] text-muted-foreground">
                  · {nRows.toLocaleString()} lignes · {columns.length} colonnes
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Créez de nouvelles colonnes via des expressions Python composées. Les opérations
              peuvent être combinées librement : <code className="text-[10px] bg-muted px-1 rounded">log1p(a / b)</code>,{" "}
              <code className="text-[10px] bg-muted px-1 rounded">(x - y) * z</code>, etc.
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
              Impossible de charger les colonnes du dataset
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
            Réessayer
          </Button>
        </div>
      )}

      {/* ── Feature cards ── */}
      {features.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          Aucune feature.{" "}
          <button
            type="button"
            onClick={addFeature}
            className="underline hover:text-primary"
          >
            Ajouter une feature
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
          Ajouter une feature
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
            Tester les expressions
          </Button>
        )}

        {(previewOk > 0 || previewErr > 0) && (
          <span className="ml-auto text-xs text-muted-foreground">
            {previewOk > 0 && (
              <span className="text-emerald-600">{previewOk} OK</span>
            )}
            {previewErr > 0 && (
              <span className="text-destructive">
                {" "}· {previewErr} erreur{previewErr > 1 ? "s" : ""}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
