import React, { useMemo } from "react";
import { Info, RefreshCw, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { ColumnMeta, ColumnKind, CleaningAction } from "@/services/dataService";

type ValueCount = { key: string; count: number };
type NumericSummary = { min: number; max: number; mean: number; median: number; q1: number; q3: number };

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "numeric", label: "Num" },
  { key: "categorical", label: "Cat" },
  { key: "datetime", label: "Date" },
  { key: "binary", label: "Bin" },
  { key: "text", label: "Text" },
  { key: "id", label: "ID" },
  { key: "other", label: "Other" },
];

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function normalizeDType(dt?: string) {
  return (dt ?? "").toLowerCase();
}
function looksNumericDType(dt?: string) {
  const s = normalizeDType(dt);
  return (
    s.includes("int") ||
    s.includes("float") ||
    s.includes("double") ||
    s.includes("number") ||
    s.includes("numeric") ||
    s.includes("uint")
  );
}
function normalizeKind(kind?: string): string {
  const k = String(kind ?? "other").toLowerCase();
  if (k === "bool" || k === "boolean") return "binary";
  return k;
}
function inferKindFallback(_col: string, dtype?: string): string {
  const dt = normalizeDType(dtype);
  if (dt.includes("bool")) return "binary";
  if (dt.includes("datetime") || dt.includes("date") || dt.includes("time")) return "datetime";
  if (looksNumericDType(dt)) return "numeric";
  if (dt.includes("object") || dt.includes("string")) return "categorical";
  return "other";
}
function kindLabel(kind: string) {
  const k = normalizeKind(kind);
  switch (k) {
    case "numeric":
      return "Num";
    case "categorical":
      return "Cat";
    case "datetime":
      return "Date";
    case "binary":
      return "Bin";
    case "text":
      return "Text";
    case "id":
      return "ID";
    default:
      return "Other";
  }
}
function kindBadgeClass(kind: string) {
  const k = normalizeKind(kind);
  switch (k) {
    case "numeric":
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "categorical":
      return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "datetime":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "binary":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "text":
      return "border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300";
    case "id":
      return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    default:
      return "border-muted-foreground/20 bg-muted/30 text-muted-foreground";
  }
}

function isMissing(v: unknown) {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v);
  if (typeof v === "string") return v.trim() === "";
  return false;
}
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const v = sorted[base] ?? sorted[sorted.length - 1];
  const v2 = sorted[base + 1] ?? v;
  return v + rest * (v2 - v);
}
function summarizeNumeric(values: number[]): NumericSummary | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length;
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return { min, max, mean, median, q1, q3 };
}
function histogram(values: number[], bins = 10) {
  if (!values.length) return { bins: [] as { label: string; count: number }[] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { bins: [{ label: `${min}`, count: values.length }] };

  const width = (max - min) / bins;
  const counts = Array.from({ length: bins }, () => 0);

  for (const v of values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
    counts[idx] += 1;
  }

  const out = counts.map((c, i) => {
    const a = min + i * width;
    const b = min + (i + 1) * width;
    const label = `${a.toFixed(2)}–${b.toFixed(2)}`;
    return { label, count: c };
  });

  return { bins: out };
}
function topValueCounts(values: unknown[], topN = 10): ValueCount[] {
  const map = new Map<string, number>();
  for (const v of values) {
    if (isMissing(v)) continue;
    const k = String(v);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const arr = Array.from(map.entries()).map(([key, count]) => ({ key, count }));
  arr.sort((a, b) => b.count - a.count);
  return arr.slice(0, topN);
}

function BarsChart({ items }: { items: ValueCount[] }) {
  const max = Math.max(1, ...items.map((x) => x.count));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.key} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5 truncate text-xs text-muted-foreground">{it.key}</div>
          <div className="col-span-6">
            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
              <div className="h-full bg-primary/70" style={{ width: `${(it.count / max) * 100}%` }} />
            </div>
          </div>
          <div className="col-span-1 text-right text-xs font-medium">{it.count}</div>
        </div>
      ))}
    </div>
  );
}
function HistogramChart({ bins }: { bins: { label: string; count: number }[] }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="space-y-2">
      {bins.map((b, i) => (
        <div key={`${b.label}-${i}`} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-6 truncate text-[11px] text-muted-foreground">{b.label}</div>
          <div className="col-span-5">
            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
              <div className="h-full bg-secondary/70" style={{ width: `${(b.count / max) * 100}%` }} />
            </div>
          </div>
          <div className="col-span-1 text-right text-xs font-medium">{b.count}</div>
        </div>
      ))}
    </div>
  );
}
function RatioPill({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-lg font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted/60 overflow-hidden">
        <div className="h-full bg-accent/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function InspectorModal({
  open,
  onClose,
  col,
  tab,
  onTabChange,
  previewRows,
  dtypes,
  metaMap,
  kindOverrides,
  verifiedCategorical,
  effectiveDatasetId,
  page,
  disableActions,
  onRefresh,
  onRunCleaning,
  onSetOverride,
  onClearOverride,
  onVerifyCategorical,
}: {
  open: boolean;
  onClose: () => void;

  col: string | null;
  tab: "overview" | "distribution" | "type";
  onTabChange: (t: "overview" | "distribution" | "type") => void;

  previewRows: Record<string, unknown>[];
  dtypes: Record<string, string>;
  metaMap: Record<string, ColumnMeta>;

  kindOverrides: Record<string, ColumnKind>;
  verifiedCategorical: Set<string>;

  effectiveDatasetId: number | null;
  page: number;
  disableActions: boolean;

  onRefresh: () => void;

  onRunCleaning: (
    description: string,
    action: CleaningAction,
    params?: Record<string, any>,
    overrideColumns?: string[]
  ) => Promise<void> | void;

  onSetOverride: (col: string, kind: ColumnKind) => Promise<void> | void;
  onClearOverride: (col: string) => Promise<void> | void;
  onVerifyCategorical: (col: string, verified: boolean) => Promise<void> | void;
}) {
  const inspectedCol = col;

  const inspectorMeta = useMemo(() => {
    if (!inspectedCol) return null;
    return metaMap?.[inspectedCol] ?? null;
  }, [inspectedCol, metaMap]);

  const inspectorKind = useMemo(() => {
    if (!inspectedCol) return "other";
    return normalizeKind(metaMap?.[inspectedCol]?.kind ?? inferKindFallback(inspectedCol, dtypes?.[inspectedCol]));
  }, [inspectedCol, metaMap, dtypes]);

  const inspectorProfile = useMemo(() => {
    if (!inspectedCol) return null;

    const values = previewRows.map((r) => (r as any)?.[inspectedCol]);
    const total = values.length;
    const missing = values.filter(isMissing).length;
    const nonMissing = values.filter((v) => !isMissing(v));

    const numericVals = nonMissing.map(toNumber).filter((n): n is number => n !== null);
    const isNumericLike = inspectorKind === "numeric" || numericVals.length / Math.max(1, nonMissing.length) > 0.8;

    const summary = isNumericLike ? summarizeNumeric(numericVals) : null;
    const hist = isNumericLike ? histogram(numericVals, 10) : null;
    const top = topValueCounts(values, 10);

    const uniqueCount = uniq(nonMissing.map((v) => String(v))).length;

    return {
      total,
      missing,
      nonMissing: nonMissing.length,
      unique: uniqueCount,
      isNumericLike,
      summary,
      hist,
      top,
      sampleValues: nonMissing.slice(0, 20).map((v) => String(v)),
    };
  }, [inspectedCol, previewRows, inspectorKind]);

  const inspectorIsOverridden = useMemo(() => {
    if (!inspectedCol) return false;
    return Boolean(kindOverrides?.[inspectedCol]);
  }, [inspectedCol, kindOverrides]);

  const inspectorVerifiedCat = useMemo(() => {
    if (!inspectedCol) return false;
    return verifiedCategorical.has(inspectedCol);
  }, [inspectedCol, verifiedCategorical]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={inspectedCol ? `Profil colonne — ${inspectedCol}` : "Profil colonne"}
      size="xl"
    >
      {!inspectedCol ? (
        <div className="text-sm text-muted-foreground">Aucune colonne sélectionnée.</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-[11px] ${kindBadgeClass(inspectorKind)}`}>
                {kindLabel(inspectorKind)} • {inspectorKind}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                dtype: {inspectorMeta?.dtype ?? dtypes?.[inspectedCol] ?? "unknown"}
              </Badge>
              {inspectorIsOverridden ? (
                <Badge variant="outline" className="text-[11px] bg-secondary/10 border-secondary/20 text-secondary">
                  override actif
                </Badge>
              ) : null}
              <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Stats basées sur l’aperçu (page courante)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "overview" ? "default" : "outline"} size="sm" onClick={() => onTabChange("overview")}>
              Overview
            </Button>
            <Button
              variant={tab === "distribution" ? "default" : "outline"}
              size="sm"
              onClick={() => onTabChange("distribution")}
            >
              Distribution
            </Button>
            <Button variant={tab === "type" ? "default" : "outline"} size="sm" onClick={() => onTabChange("type")}>
              Type
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={onRefresh}
              disabled={!effectiveDatasetId}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>
          </div>

          {tab === "overview" && inspectorProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <RatioPill label="Total (preview)" value={inspectorProfile.total} total={inspectorProfile.total} />
              <RatioPill label="Manquants (aperçu)" value={inspectorProfile.missing} total={inspectorProfile.total} />
              <RatioPill label="Uniques (aperçu)" value={inspectorProfile.unique} total={Math.max(1, inspectorProfile.nonMissing)} />

              <div className="md:col-span-3 rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Exemples (non manquants)</p>
                <p className="text-xs text-muted-foreground mt-1">Les 20 premières valeurs observées sur la page.</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {inspectorProfile.sampleValues.length ? (
                    inspectorProfile.sampleValues.map((v, i) => (
                      <Badge key={`${v}-${i}`} variant="secondary" className="text-[11px] max-w-[240px] truncate">
                        {v}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Aucune valeur non manquante dans l’aperçu.</span>
                  )}
                </div>
              </div>

              {inspectorProfile.isNumericLike && inspectorProfile.summary ? (
                <div className="md:col-span-3 rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-sm font-semibold">Résumé numérique (aperçu)</p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">min</p>
                      <p className="text-sm font-semibold">{inspectorProfile.summary.min.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">q1</p>
                      <p className="text-sm font-semibold">{inspectorProfile.summary.q1.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">median</p>
                      <p className="text-sm font-semibold">{inspectorProfile.summary.median.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">q3</p>
                      <p className="text-sm font-semibold">{inspectorProfile.summary.q3.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">max</p>
                      <p className="text-sm font-semibold">{inspectorProfile.summary.max.toFixed(4)}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-border bg-background p-2">
                    <p className="text-[11px] text-muted-foreground">mean</p>
                    <p className="text-sm font-semibold">{inspectorProfile.summary.mean.toFixed(4)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "distribution" && inspectorProfile ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Valeurs fréquentes (aperçu)</p>
                <p className="text-xs text-muted-foreground mt-1">Top 10 par fréquence (manquants ignorés).</p>
                <div className="mt-3">
                  {inspectorProfile.top.length ? <BarsChart items={inspectorProfile.top} /> : <p className="text-xs text-muted-foreground">Aucune valeur.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Distribution</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {inspectorProfile.isNumericLike ? "Histogramme (10 bins) sur la page preview." : "Si la colonne est numérique, un histogramme s’affiche ici."}
                </p>
                <div className="mt-3">
                  {inspectorProfile.isNumericLike && inspectorProfile.hist ? (
                    <HistogramChart bins={inspectorProfile.hist.bins} />
                  ) : (
                    <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                      Passe la colonne en <b>numeric</b> pour visualiser l’histogramme (ou ajoute un endpoint “profile” backend pour full dataset).
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "type" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Changer le type (schema)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cela ne modifie pas les valeurs tout de suite : tu définis le <b>type métier</b> (Num/Cat/Bin/Date…) pour guider les étapes suivantes.
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <p className="text-xs text-muted-foreground mb-1">Type actuel</p>
                    <Badge variant="outline" className={`${kindBadgeClass(inspectorKind)}`}>
                      {kindLabel(inspectorKind)} • {inspectorKind}
                    </Badge>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Nouveau type</p>
                    <Select
                      value={normalizeKind(kindOverrides?.[inspectedCol] ?? inspectorKind)}
                      onValueChange={(v) => {
                        const kk = (v ?? "other") as ColumnKind;
                        void onSetOverride(inspectedCol, kk);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_FILTERS.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => void onClearOverride(inspectedCol)} disabled={!inspectorIsOverridden}>
                        Annuler override
                      </Button>

                      {normalizeKind(inspectorKind) === "categorical" && (
                        <Button
                          variant={inspectorVerifiedCat ? "default" : "outline"}
                          size="sm"
                          onClick={() => void onVerifyCategorical(inspectedCol, !inspectorVerifiedCat)}
                        >
                          {inspectorVerifiedCat ? "Cat vérifié ✓" : "Confirmer catégoriel"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Actions rapides</p>
                <p className="text-xs text-muted-foreground mt-1">Exemples: supprimer la colonne si elle est inutile.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={disableActions}
                    onClick={() => void onRunCleaning("Suppression colonne (depuis inspector)", "drop_columns" as any, {}, [inspectedCol])}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer la colonne
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
