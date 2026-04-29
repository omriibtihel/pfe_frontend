export const LOWER_IS_BETTER = new Set([
  "rmse", "mae", "mse", "log_loss", "brier_score"
]);

/**
 * Metrics that live on a 0–1 (or −∞–1 for R²) scale and must NOT be
 * multiplied by 100.  Formatting them as percentages is misleading.
 */
export const RATIO_METRICS = new Set([
  "r2", "roc_auc", "pr_auc", "average_precision",
]);

export type MetricDirection = "lower_is_better" | "higher_is_better";

export function metricDirection(metricName: string): MetricDirection {
  return LOWER_IS_BETTER.has(metricName?.toLowerCase?.())
    ? "lower_is_better"
    : "higher_is_better";
}

export function isBetter(
  metricName: string,
  challenger: number,
  champion: number
): boolean {
  return metricDirection(metricName) === "lower_is_better"
    ? challenger < champion
    : challenger > champion;
}

/**
 * Returns the highest-scoring model according to the session's primary metric.
 *
 * Return values:
 *   undefined — no models provided, or none have a finite testScore
 *   null      — models are present but carry different primaryMetric names; ranking
 *               would silently compare incompatible scores, so we refuse to rank.
 *               Callers should surface a "models use different metrics, cannot rank"
 *               message rather than picking an arbitrary winner.
 *   T         — the best model
 *
 * @param sessionPrimaryMetric  Explicit metric name resolved at the session level
 *   (e.g. session.config.metrics[0]).  When provided, all models are ranked by this
 *   metric regardless of what their individual primaryMetric field says, and the
 *   mixed-metrics guard is skipped.
 */
export function selectBestModel<T extends {
  testScore: number | null;
  primaryMetric?: { name: string } | null;
}>(models: T[], sessionPrimaryMetric?: string): T | null | undefined {
  if (!models || models.length === 0) return undefined;
  const validModels = models.filter(
    (m) => m.testScore !== null && isFinite(m.testScore as number)
  );
  if (validModels.length === 0) return undefined;

  let metricName: string;

  if (sessionPrimaryMetric) {
    metricName = sessionPrimaryMetric;
  } else {
    const distinctNames = new Set(
      validModels
        .map((m) => m.primaryMetric?.name)
        .filter((n): n is string => Boolean(n))
    );
    if (distinctNames.size > 1) {
      return null;
    }
    metricName = distinctNames.size === 1 ? [...distinctNames][0] : "accuracy";
  }

  return validModels.reduce((best, current) =>
    isBetter(metricName, current.testScore!, best.testScore!) ? current : best
  );
}

/**
 * Format a primary metric value for display.
 * Uses metric direction — never assumes taskType.
 * RATIO_METRICS (r2, roc_auc, pr_auc, average_precision) → plain decimal, 3 sig figs, no %
 *   Negative R² additionally appends " (worse than baseline)".
 * lower_is_better → raw decimal (4 decimal places)
 * higher_is_better → percentage (1 decimal place)
 * null/undefined → "—"
 */
export function formatMetricValue(
  value: number | null | undefined,
  metricName: string | null | undefined,
): string {
  if (value === null || value === undefined || !isFinite(value)) return "—";
  const key = (metricName ?? "").toLowerCase();
  if (RATIO_METRICS.has(key)) {
    const formatted = Number(value.toPrecision(3)).toString();
    if (key === "r2" && value < 0) {
      return `${formatted} (worse than baseline)`;
    }
    return formatted;
  }
  const dir = metricDirection(metricName ?? "accuracy");
  return dir === "lower_is_better"
    ? value.toFixed(4)
    : `${(value * 100).toFixed(1)}%`;
}

/**
 * Returns true only for R² — the only regression metric
 * that can be described as "explains X% of variance".
 */
export function isVarianceExplained(metricName: string | null | undefined): boolean {
  return (metricName ?? "").toLowerCase() === "r2";
}
