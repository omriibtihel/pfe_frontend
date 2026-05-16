import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Database, RefreshCw, Trash2 } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { ColumnMeta, ColumnKind, CleaningAction, ColumnDistributionOut } from "@/services/dataService";
import dataService from "@/services/dataService";
import { normalizeKind, inferKindFallback, kindLabel, kindBadgeClass } from "@/pages/project/nettoyage/useNettoyageData";

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "numeric", label: "Num" },
  { key: "categorical", label: "Cat" },
  { key: "datetime", label: "Date" },
  { key: "binary", label: "Bin" },
  { key: "text", label: "Text" },
  { key: "id", label: "ID" },
  { key: "other", label: "Other" },
];

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionLabel({ label, variant }: { label: string; variant: "primary" | "muted" }) {
  return (
    <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest ${
      variant === "primary" ? "text-primary" : "text-muted-foreground/70"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        variant === "primary" ? "bg-primary" : "bg-muted-foreground/40"
      }`} />
      {label}
    </div>
  );
}

function FullStatCard({ label, value, total, unit, locale, pctLabel }: {
  label: string; value: number | null | undefined; total?: number; unit?: string; locale: string; pctLabel: (pct: string) => string;
}) {
  const num = value ?? 0;
  const pct = total && total > 0 ? (num / total) * 100 : null;
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3 space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">
        {typeof value === "number" ? num.toLocaleString(locale) : "—"}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {pct !== null && (
        <>
          <p className="text-[11px] text-muted-foreground">{pctLabel(pct.toFixed(1))}</p>
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div className="h-full bg-primary/50" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">
        {value != null ? value.toFixed(4) : "—"}
      </p>
    </div>
  );
}

function BarsChart({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((x) => x.count));
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5 truncate text-xs text-muted-foreground">{it.label}</div>
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

// ── Component ─────────────────────────────────────────────────────────────────

export function InspectorModal({
  open, onClose, col, tab, onTabChange,
  dtypes, metaMap,
  kindOverrides, verifiedCategorical,
  projectId, effectiveDatasetId,
  disableActions, onRefresh, onRunCleaning,
  onSetOverride, onClearOverride, onVerifyCategorical,
}: {
  open: boolean;
  onClose: () => void;
  col: string | null;
  tab: "overview" | "distribution" | "type";
  onTabChange: (t: "overview" | "distribution" | "type") => void;
  dtypes: Record<string, string>;
  metaMap: Record<string, ColumnMeta>;
  kindOverrides: Record<string, ColumnKind>;
  verifiedCategorical: Set<string>;
  projectId: string;
  effectiveDatasetId: number | null;
  disableActions: boolean;
  onRefresh: () => void;
  onRunCleaning: (description: string, action: CleaningAction, params?: Record<string, unknown>, overrideColumns?: string[]) => Promise<void> | void;
  onSetOverride: (col: string, kind: ColumnKind) => Promise<void> | void;
  onClearOverride: (col: string) => Promise<void> | void;
  onVerifyCategorical: (col: string, verified: boolean) => Promise<void> | void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("fr") ? "fr-FR" : "en-US";
  const pctLabel = (pct: string) => t("nettoyage.inspector.datasetPct", { pct });
  const inspectorMeta = col ? (metaMap?.[col] ?? null) : null;

  const inspectorKind = col
    ? normalizeKind(metaMap?.[col]?.kind ?? inferKindFallback(col, dtypes?.[col]))
    : "other";

  const inspectorIsOverridden = col ? Boolean(kindOverrides?.[col]) : false;
  const inspectorVerifiedCat = col ? verifiedCategorical.has(col) : false;
  const isNumericKind = inspectorKind === "numeric";

  // ── Backend distribution (fetched on demand) ─────────────────────────────
  const [distData, setDistData] = useState<ColumnDistributionOut | null>(null);
  const [distLoading, setDistLoading] = useState(false);

  useEffect(() => {
    if (tab !== "distribution" || !col || !effectiveDatasetId) {
      setDistData(null);
      return;
    }
    let cancelled = false;
    setDistLoading(true);
    setDistData(null);
    dataService
      .getColumnDistribution(projectId, effectiveDatasetId, col)
      .then((d) => { if (!cancelled) setDistData(d); })
      .catch(() => { if (!cancelled) setDistData(null); })
      .finally(() => { if (!cancelled) setDistLoading(false); });
    return () => { cancelled = true; };
  }, [tab, col, effectiveDatasetId, projectId]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={col ? t("nettoyage.inspector.titleWithCol", { col }) : t("nettoyage.inspector.title")}
      size="xl"
    >
      {!col ? (
        <div className="text-sm text-muted-foreground">{t("nettoyage.inspector.noCol")}</div>
      ) : (
        <div className="space-y-4">
          {/* ── Meta bar ── */}
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-[11px] ${kindBadgeClass(inspectorKind)}`}>
                {kindLabel(inspectorKind)} • {inspectorKind}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                dtype: {inspectorMeta?.dtype ?? dtypes?.[col] ?? "unknown"}
              </Badge>
              {inspectorIsOverridden && (
                <Badge variant="outline" className="text-[11px] bg-secondary/10 border-secondary/20 text-secondary">
                  {t("nettoyage.inspector.overrideActive")}
                </Badge>
              )}
              {inspectorMeta?.total != null && (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <Database className="h-3.5 w-3.5" />
                  {t("nettoyage.inspector.rowsTotal", { n: inspectorMeta.total.toLocaleString(locale) })}
                </span>
              )}
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex flex-wrap gap-2">
            {(["overview", "distribution", "type"] as const).map((tn) => (
              <Button key={tn} variant={tab === tn ? "default" : "outline"} size="sm" onClick={() => onTabChange(tn)}>
                {tn === "overview" ? t("nettoyage.inspector.tabOverview") : tn === "distribution" ? t("nettoyage.inspector.tabDistribution") : t("nettoyage.inspector.tabType")}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onRefresh} disabled={!effectiveDatasetId}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("nettoyage.inspector.refresh")}
            </Button>
          </div>

          {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div className="space-y-5">
              <SectionLabel label={t("nettoyage.inspector.statsFull")} variant="primary" />

              {inspectorMeta ? (
                <>
                  {/* Counts */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FullStatCard locale={locale} pctLabel={pctLabel} label={t("nettoyage.inspector.totalRows")} value={inspectorMeta.total} />
                    <FullStatCard locale={locale} pctLabel={pctLabel} label={t("nettoyage.inspector.missing")} value={inspectorMeta.missing} total={inspectorMeta.total} />
                    <FullStatCard
                      locale={locale} pctLabel={pctLabel}
                      label={t("nettoyage.inspector.uniqueVals")}
                      value={inspectorMeta.unique}
                      total={Math.max(1, inspectorMeta.total - inspectorMeta.missing)}
                    />
                  </div>

                  {/* Outlier + skewness (numeric only) */}
                  {isNumericKind && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FullStatCard
                        locale={locale} pctLabel={pctLabel}
                        label={t("nettoyage.inspector.skewness")}
                        value={inspectorMeta.skewness != null ? parseFloat(inspectorMeta.skewness.toFixed(3)) : null}
                      />
                      <FullStatCard
                        locale={locale} pctLabel={pctLabel}
                        label={t("nettoyage.inspector.outlierRatio")}
                        value={inspectorMeta.outlier_ratio != null
                          ? parseFloat((inspectorMeta.outlier_ratio * 100).toFixed(2))
                          : null}
                        unit="%"
                      />
                    </div>
                  )}

                  {/* Numeric summary — min/max/mean/median/q1/q3 (numeric only) */}
                  {isNumericKind && inspectorMeta.min_val != null && (
                    <div className="space-y-2">
                      <SectionLabel label={t("nettoyage.inspector.numericSummary")} variant="muted" />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <StatTile label="min"    value={inspectorMeta.min_val} />
                        <StatTile label="q1"     value={inspectorMeta.q1_val} />
                        <StatTile label="median" value={inspectorMeta.median_val} />
                        <StatTile label="q3"     value={inspectorMeta.q3_val} />
                        <StatTile label="max"    value={inspectorMeta.max_val} />
                        <StatTile label="mean"   value={inspectorMeta.mean_val} />
                      </div>
                    </div>
                  )}

                  {/* Parasite values */}
                  {inspectorMeta.parasites && inspectorMeta.parasites.count > 0 && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-1">
                      <p className="text-xs font-medium text-destructive">
                        {t("nettoyage.inspector.parasiteDetected", { n: inspectorMeta.parasites.count })}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {inspectorMeta.parasites.distinct.map((v) => (
                          <Badge key={v} variant="destructive" className="text-[11px]">{v}</Badge>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t("nettoyage.inspector.parasiteNumericPct", { pct: Math.round(inspectorMeta.parasites.convertible_ratio * 100) })}
                      </p>
                    </div>
                  )}

                  {/* Sample values */}
                  {Array.isArray(inspectorMeta.sample) && inspectorMeta.sample.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3">
                      <p className="text-xs font-medium text-primary mb-2">{t("nettoyage.inspector.samplesTitle")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectorMeta.sample.slice(0, 20).map((v, i) => (
                          <Badge key={`${v}-${i}`} variant="secondary" className="text-[11px] max-w-[200px] truncate">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t("nettoyage.inspector.noMeta")}</p>
              )}
            </div>
          )}

          {/* ══ DISTRIBUTION ══════════════════════════════════════════════════ */}
          {tab === "distribution" && (
            <div className="space-y-3">
              <SectionLabel label={t("nettoyage.inspector.distSection")} variant="primary" />

              {distLoading && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  {t("nettoyage.inspector.loading")}
                </div>
              )}

              {!distLoading && distData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-sm font-semibold">
                      {distData.type === "histogram" ? t("nettoyage.inspector.distHistTitle") : t("nettoyage.inspector.distCatTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("nettoyage.inspector.distNonNull", { n: distData.total.toLocaleString(locale) })}
                    </p>
                    <div className="mt-3">
                      {distData.type === "histogram"
                        ? <HistogramChart bins={distData.bars} />
                        : <BarsChart items={distData.bars} />
                      }
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-sm font-semibold">{t("nettoyage.inspector.summary")}</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("nettoyage.inspector.type")}</span>
                        <span className="font-medium">{distData.type === "histogram" ? t("nettoyage.inspector.typeNumeric") : t("nettoyage.inspector.typeCategorical")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("nettoyage.inspector.nonNullValues")}</span>
                        <span className="font-medium">{distData.total.toLocaleString(locale)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("nettoyage.inspector.categoriesBins")}</span>
                        <span className="font-medium">{distData.bars.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!distLoading && !distData && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {t("nettoyage.inspector.distUnavailable")}
                </p>
              )}
            </div>
          )}

          {/* ══ TYPE ══════════════════════════════════════════════════════════ */}
          {tab === "type" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">{t("nettoyage.inspector.changeType")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("nettoyage.inspector.changeTypeHintPrefix")}<b>{t("nettoyage.inspector.changeTypeHintBold")}</b>{t("nettoyage.inspector.changeTypeHintSuffix")}
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <p className="text-xs text-muted-foreground mb-1">{t("nettoyage.inspector.currentType")}</p>
                    <Badge variant="outline" className={kindBadgeClass(inspectorKind)}>
                      {kindLabel(inspectorKind)} • {inspectorKind}
                    </Badge>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">{t("nettoyage.inspector.newType")}</p>
                    <Select
                      value={normalizeKind(kindOverrides?.[col] ?? inspectorKind)}
                      onValueChange={(v) => void onSetOverride(col, (v ?? "other") as ColumnKind)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("nettoyage.inspector.chooseTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_FILTERS.map((tf) => (
                          <SelectItem key={tf.key} value={tf.key}>{tf.key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => void onClearOverride(col)} disabled={!inspectorIsOverridden}>
                        {t("nettoyage.inspector.cancelOverride")}
                      </Button>
                      {normalizeKind(inspectorKind) === "categorical" && (
                        <Button
                          variant={inspectorVerifiedCat ? "default" : "outline"}
                          size="sm"
                          onClick={() => void onVerifyCategorical(col, !inspectorVerifiedCat)}
                        >
                          {inspectorVerifiedCat ? t("nettoyage.inspector.catVerified") : t("nettoyage.inspector.confirmCat")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">{t("nettoyage.inspector.quickActions")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("nettoyage.inspector.quickActionsHint")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={disableActions}
                    onClick={() => void onRunCleaning(t("nettoyage.cleaning.opDropFromInspector"), "drop_columns", {}, [col])}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("nettoyage.inspector.dropCol")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t("nettoyage.inspector.close")}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
