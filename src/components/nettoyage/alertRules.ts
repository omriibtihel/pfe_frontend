/**
 * alertRules.ts
 *
 * Single source of truth for alert types, thresholds, and build logic.
 * Kept separate from AlertsModal.tsx so the rules can be tested and
 * evolved independently of the rendering layer.
 */

import type { ColumnMeta, ColumnKind } from '@/services/dataService';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'error' | 'warning' | 'info';

export type AlertItem =
  | { type: 'missing_high';      severity: 'warning'; column: string; missingPct: number }
  | { type: 'missing_low';       severity: 'info';    column: string; missingPct: number }
  | { type: 'verify_cat';        severity: 'info';    column: string }
  | { type: 'all_missing';       severity: 'error';   column: string }
  | { type: 'constant_column';   severity: 'warning'; column: string }
  | { type: 'high_cardinality';  severity: 'warning'; column: string; unique: number; nonMissing: number; pct: number }
  | { type: 'likely_id';         severity: 'warning'; column: string }
  | { type: 'high_outliers';     severity: 'warning'; column: string; pct: number }
  | { type: 'moderate_outliers'; severity: 'info';    column: string; pct: number }
  | { type: 'highly_skewed';     severity: 'info';    column: string; skewness: number }
  | { type: 'parasite_values';  severity: 'error';   column: string; count: number; distinct: string[]; convertible_ratio: number };

// ── Thresholds ────────────────────────────────────────────────────────────────

export type AlertThresholds = {
  missingHigh: number;        // > N → suggest drop
  missingLow: number;         // N–missingHigh → suggest imputation
  highCardinalityRatio: number;   // unique/nonMissing > N
  highCardinalityMinUniq: number; // require at least N unique values
  outlierHigh: number;        // > N → warning
  outlierModerate: number;    // N–outlierHigh → info
  skewness: number;           // |skew| > N → info
};

export const ALERT_THRESHOLDS: AlertThresholds = {
  missingHigh:          0.20,
  missingLow:           0.05,
  highCardinalityRatio: 0.90,
  highCardinalityMinUniq: 10,
  outlierHigh:          0.15,
  outlierModerate:      0.05,
  skewness:             2.0,
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = { error: 0, warning: 1, info: 2 };

// ── Builder ────────────────────────────────────────────────────────────────────

export function buildAlerts(
  metaMap: Record<string, ColumnMeta>,
  verifiedCategorical: Set<string>,
  kindOverrides: Record<string, ColumnKind>,
  thresholds?: Partial<AlertThresholds>,
): AlertItem[] {
  const t = { ...ALERT_THRESHOLDS, ...thresholds };
  const alerts: AlertItem[] = [];

  for (const [col, meta] of Object.entries(metaMap)) {
    const total   = meta.total   ?? 0;
    const missing = meta.missing ?? 0;
    const unique  = meta.unique  ?? 0;
    if (total === 0) continue;

    const kind = String(meta.kind ?? 'other').toLowerCase().replace(/^bool(ean)?$/, 'binary');

    // ── 1. All-missing (100 %) ────────────────────────────────────────────
    if (missing === total) {
      alerts.push({ type: 'all_missing', severity: 'error', column: col });
      continue; // no further checks needed for an empty column
    }

    const missingPct  = missing / total;
    const nonMissing  = total - missing;

    // ── 2. Constant column (unique ≤ 1) ──────────────────────────────────
    if (unique <= 1 && nonMissing > 0) {
      alerts.push({ type: 'constant_column', severity: 'warning', column: col });
    }

    // ── 3. Missing-value thresholds ───────────────────────────────────────
    if (unique > 1) {  // skip if already flagged as constant
      if (missingPct > t.missingHigh) {
        alerts.push({ type: 'missing_high', severity: 'warning', column: col, missingPct });
      } else if (missingPct > t.missingLow) {
        alerts.push({ type: 'missing_low', severity: 'info', column: col, missingPct });
      }
    }

    // ── 4. High cardinality (categorical / text) ──────────────────────────
    if (
      (kind === 'categorical' || kind === 'text') &&
      nonMissing > 0 &&
      unique > t.highCardinalityMinUniq &&
      unique / nonMissing > t.highCardinalityRatio
    ) {
      const pct = Math.round((unique / nonMissing) * 100);
      alerts.push({ type: 'high_cardinality', severity: 'warning', column: col, unique, nonMissing, pct });
    }

    // ── 5. Likely ID column ───────────────────────────────────────────────
    if (kind === 'id') {
      alerts.push({ type: 'likely_id', severity: 'warning', column: col });
    }

    // ── 6. Unverified categorical type ────────────────────────────────────
    const alreadyHandled = verifiedCategorical.has(col) || kindOverrides[col] != null;
    if (kind === 'categorical' && !alreadyHandled) {
      alerts.push({ type: 'verify_cat', severity: 'info', column: col });
    }

    // ── 7. Outliers (numeric-only) ────────────────────────────────────────
    const outlierRatio = meta.outlier_ratio ?? null;
    if (outlierRatio !== null) {
      if (outlierRatio > t.outlierHigh) {
        const pct = Math.round(outlierRatio * 100);
        alerts.push({ type: 'high_outliers', severity: 'warning', column: col, pct });
      } else if (outlierRatio > t.outlierModerate) {
        const pct = Math.round(outlierRatio * 100);
        alerts.push({ type: 'moderate_outliers', severity: 'info', column: col, pct });
      }
    }

    // ── 8. Skewness (numeric-only) ────────────────────────────────────────
    const skewness = meta.skewness ?? null;
    if (skewness !== null && Math.abs(skewness) > t.skewness && unique > 1) {
      alerts.push({ type: 'highly_skewed', severity: 'info', column: col, skewness });
    }

    // ── 9. Parasite values (non-numeric values in a mostly-numeric column) ─
    if (meta.parasites && meta.parasites.count > 0) {
      alerts.push({
        type: 'parasite_values',
        severity: 'error',
        column: col,
        count: meta.parasites.count,
        distinct: meta.parasites.distinct,
        convertible_ratio: meta.parasites.convertible_ratio,
      });
    }
  }

  // Sort: error → warning → info, then alphabetically by column for stability
  return alerts.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.column.localeCompare(b.column);
  });
}

/** Stable unique key per alert (used for dismiss tracking). */
export function alertKey(a: AlertItem): string {
  return `${a.type}:${a.column}`;
}

/** Count visible (non-dismissed) alerts — used for the toolbar badge. */
export function countVisibleAlerts(
  metaMap: Record<string, ColumnMeta>,
  verifiedCategorical: Set<string>,
  kindOverrides: Record<string, ColumnKind>,
  dismissedAlertKeys: Set<string>,
  thresholds?: Partial<AlertThresholds>,
): number {
  return buildAlerts(metaMap, verifiedCategorical, kindOverrides, thresholds)
    .filter((a) => !dismissedAlertKeys.has(alertKey(a)))
    .length;
}
