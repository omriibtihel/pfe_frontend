import React, { useEffect, useState } from "react";
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

function FullStatCard({ label, value, total, unit }: {
  label: string; value: number | null | undefined; total?: number; unit?: string;
}) {
  const num = value ?? 0;
  const pct = total && total > 0 ? (num / total) * 100 : null;
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3 space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">
        {typeof value === "number" ? num.toLocaleString("fr-FR") : "—"}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {pct !== null && (
        <>
          <p className="text-[11px] text-muted-foreground">{pct.toFixed(1)}% du dataset</p>
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
  onRunCleaning: (description: string, action: CleaningAction, params?: Record<string, any>, overrideColumns?: string[]) => Promise<void> | void;
  onSetOverride: (col: string, kind: ColumnKind) => Promise<void> | void;
  onClearOverride: (col: string) => Promise<void> | void;
  onVerifyCategorical: (col: string, verified: boolean) => Promise<void> | void;
}) {
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
      title={col ? `Profil colonne — ${col}` : "Profil colonne"}
      size="xl"
    >
      {!col ? (
        <div className="text-sm text-muted-foreground">Aucune colonne sélectionnée.</div>
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
                  override actif
                </Badge>
              )}
              {inspectorMeta?.total != null && (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <Database className="h-3.5 w-3.5" />
                  {inspectorMeta.total.toLocaleString("fr-FR")} lignes totales
                </span>
              )}
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex flex-wrap gap-2">
            {(["overview", "distribution", "type"] as const).map((t) => (
              <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => onTabChange(t)}>
                {t === "overview" ? "Overview" : t === "distribution" ? "Distribution" : "Type"}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onRefresh} disabled={!effectiveDatasetId}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>
          </div>

          {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div className="space-y-5">
              <SectionLabel label="Statistiques complètes — dataset entier" variant="primary" />

              {inspectorMeta ? (
                <>
                  {/* Counts */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FullStatCard label="Total lignes" value={inspectorMeta.total} />
                    <FullStatCard label="Manquants" value={inspectorMeta.missing} total={inspectorMeta.total} />
                    <FullStatCard
                      label="Valeurs uniques"
                      value={inspectorMeta.unique}
                      total={Math.max(1, inspectorMeta.total - inspectorMeta.missing)}
                    />
                  </div>

                  {/* Outlier + skewness (numeric only) */}
                  {isNumericKind && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FullStatCard
                        label="Asymétrie (skewness)"
                        value={inspectorMeta.skewness != null ? parseFloat(inspectorMeta.skewness.toFixed(3)) : null}
                      />
                      <FullStatCard
                        label="Taux d'outliers"
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
                      <SectionLabel label="Résumé numérique — dataset entier" variant="muted" />
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
                        Valeurs parasites détectées ({inspectorMeta.parasites.count} occurrences)
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {inspectorMeta.parasites.distinct.map((v) => (
                          <Badge key={v} variant="destructive" className="text-[11px]">{v}</Badge>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {Math.round(inspectorMeta.parasites.convertible_ratio * 100)}% des valeurs sont numériques.
                      </p>
                    </div>
                  )}

                  {/* Sample values */}
                  {Array.isArray(inspectorMeta.sample) && inspectorMeta.sample.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3">
                      <p className="text-xs font-medium text-primary mb-2">Exemples (depuis le dataset complet)</p>
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
                <p className="text-xs text-muted-foreground">Métadonnées non disponibles pour cette colonne.</p>
              )}
            </div>
          )}

          {/* ══ DISTRIBUTION ══════════════════════════════════════════════════ */}
          {tab === "distribution" && (
            <div className="space-y-3">
              <SectionLabel label="Distribution — dataset entier" variant="primary" />

              {distLoading && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Chargement...
                </div>
              )}

              {!distLoading && distData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-sm font-semibold">
                      {distData.type === "histogram" ? "Histogramme" : "Valeurs fréquentes"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {distData.total.toLocaleString("fr-FR")} valeurs non-nulles — dataset complet.
                    </p>
                    <div className="mt-3">
                      {distData.type === "histogram"
                        ? <HistogramChart bins={distData.bars} />
                        : <BarsChart items={distData.bars} />
                      }
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-sm font-semibold">Résumé</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{distData.type === "histogram" ? "Numérique" : "Catégoriel"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valeurs non-nulles</span>
                        <span className="font-medium">{distData.total.toLocaleString("fr-FR")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Catégories / bins</span>
                        <span className="font-medium">{distData.bars.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!distLoading && !distData && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Distribution non disponible pour cette colonne.
                </p>
              )}
            </div>
          )}

          {/* ══ TYPE ══════════════════════════════════════════════════════════ */}
          {tab === "type" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-sm font-semibold">Changer le type (schema)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cela ne modifie pas les valeurs : tu définis le <b>type métier</b> (Num/Cat/Bin/Date…) pour guider les étapes suivantes.
                </p>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <p className="text-xs text-muted-foreground mb-1">Type actuel</p>
                    <Badge variant="outline" className={kindBadgeClass(inspectorKind)}>
                      {kindLabel(inspectorKind)} • {inspectorKind}
                    </Badge>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Nouveau type</p>
                    <Select
                      value={normalizeKind(kindOverrides?.[col] ?? inspectorKind)}
                      onValueChange={(v) => void onSetOverride(col, (v ?? "other") as ColumnKind)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_FILTERS.map((t) => (
                          <SelectItem key={t.key} value={t.key}>{t.key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => void onClearOverride(col)} disabled={!inspectorIsOverridden}>
                        Annuler override
                      </Button>
                      {normalizeKind(inspectorKind) === "categorical" && (
                        <Button
                          variant={inspectorVerifiedCat ? "default" : "outline"}
                          size="sm"
                          onClick={() => void onVerifyCategorical(col, !inspectorVerifiedCat)}
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
                <p className="text-xs text-muted-foreground mt-1">Supprimer la colonne si elle est inutile.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={disableActions}
                    onClick={() => void onRunCleaning("Suppression colonne (depuis inspector)", "drop_columns" as any, {}, [col])}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer la colonne
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Fermer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
