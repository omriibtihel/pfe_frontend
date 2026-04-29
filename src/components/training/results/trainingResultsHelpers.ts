import type {
  DetailedClassificationMetrics,
  ExplainabilityData,
  MetricsSummary,
  MetricType,
  ModelResultDetail,
} from '@/types';

export const modelColors: Record<string, string> = {
  lightgbm: 'from-blue-500 to-blue-600',
  xgboost: 'from-purple-500 to-purple-600',
  randomforest: 'from-green-500 to-green-600',
  svm: 'from-teal-500 to-teal-600',
  knn: 'from-orange-500 to-orange-600',
  decisiontree: 'from-red-500 to-red-600',
  logisticregression: 'from-cyan-500 to-cyan-600',
  logreg: 'from-cyan-500 to-cyan-600',
  naivebayes: 'from-pink-500 to-pink-600',
  extratrees: 'from-emerald-500 to-emerald-600',
  et: 'from-emerald-500 to-emerald-600',
  gradientboosting: 'from-amber-500 to-amber-600',
  gb: 'from-amber-500 to-amber-600',
  gbm: 'from-amber-500 to-amber-600',
  ridge: 'from-violet-500 to-violet-600',
};

export const metricLabels: Record<string, string> = {
  accuracy: 'Accuracy',
  precision: 'Précision',
  recall: 'Recall',
  f1: 'F1',
  roc_auc: 'ROC AUC',
  pr_auc: 'PR AUC',
  r2: 'R²',
  rmse: 'RMSE',
  mae: 'MAE',
};

export type ClassificationType = 'binary' | 'multiclass' | 'multilabel' | 'unknown';

export type FeatureImportanceChartRow = {
  feature: string;
  label: string;
  rawImportance: number;
  normalizedImportance: number;
  displayImportance: number;
};

export type AverageRow = {
  key: 'macro' | 'weighted' | 'micro';
  label: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
};

export type PerClassRow = {
  label: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  support: number | null;
};

export type ConfusionPayload = {
  labels: string[];
  matrix: number[][];
};

export type ClassificationView = {
  classificationType: ClassificationType;
  positiveLabel: string | null;
  accuracy: number | null;
  rocAuc: number | null;
  prAuc: number | null;
  precisionMain: number | null;
  recallMain: number | null;
  f1Main: number | null;
  balancedAccuracy: number | null;
  specificity: number | null;
  averages: AverageRow[];
  perClass: PerClassRow[];
  confusion: ConfusionPayload;
  warnings: string[];
};

// ── Formatting helpers (model-agnostic) ──────────────────────────────────────

export function toPercent(value?: number | null): string {
  if (!Number.isFinite(value)) return '-';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function toNumber(value?: number | null): string {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toFixed(3);
}

export function toSeconds(value?: number | null): string {
  if (!Number.isFinite(value)) return '-';
  return `${Number(value).toFixed(1)}s`;
}

export function clampPercent(value?: number | null): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v * 100));
}

export function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toUniqueWarnings(values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

export const WARNING_LABELS: Record<string, string> = {
  dataset_is_already_balanced: 'Dataset déjà équilibré - aucun rééchantillonnage appliqué.',
  severe_imbalance_detected: "Déséquilibre sévère - préférez PR-AUC plutôt que l'accuracy.",
  tiny_dataset_high_variance_risk: 'Dataset très petit - risque de forte variance.',
  smote_requires_minority_count_at_least_6: 'SMOTE requiert >= 6 échantillons en classe minoritaire.',
  random_undersampling_requires_minority_count_at_least_30:
    'Sous-échantillonnage requiert >= 30 échantillons en classe minoritaire.',
  target_has_single_class: "La cible ne contient qu'une seule classe.",
  target_is_not_binary: "La cible n'est pas binaire.",
  threshold_optimization_skipped_no_validation_data:
    'Optimisation du seuil ignorée : aucune donnée de validation.',
  threshold_optimization_skipped_predict_proba_not_available:
    'Optimisation du seuil ignorée : predict_proba non disponible.',
  threshold_calibrated_on_train_data_may_be_optimistic:
    'Seuil calibré sur les données d\'entraînement — valeur optimiste (aucun jeu de validation disponible).',
  threshold_optimization_disabled_multiclass:
    'Optimisation du seuil désactivée : non supportée pour la classification multiclasse.',
};

export function humanizeWarning(key: string): string {
  return WARNING_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function truncateFeatureLabel(value: string, max = 24): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

// ── Selected-metric mapping (for comparison table & cards) ───────────────────

export type ComparisonMetric = {
  metric: MetricType;
  summaryKey: keyof MetricsSummary;
  label: string;
  shortLabel: string;
};

const METRIC_TO_SUMMARY_KEY: Partial<Record<MetricType, keyof MetricsSummary>> = {
  accuracy: 'accuracy',
  precision: 'precision',
  recall: 'recall',
  f1: 'f1',
  roc_auc: 'rocAuc',
  pr_auc: 'prAuc',
  f1_pos: 'f1Pos',
  precision_macro: 'precisionMacro',
  recall_macro: 'recallMacro',
  f1_macro: 'f1Macro',
  precision_weighted: 'precisionWeighted',
  recall_weighted: 'recallWeighted',
  f1_weighted: 'f1Weighted',
  precision_micro: 'precisionMicro',
  recall_micro: 'recallMicro',
  f1_micro: 'f1Micro',
  mae: 'mae',
  mse: 'mse',
  rmse: 'rmse',
  r2: 'r2',
};

const METRIC_DISPLAY_LABELS: Partial<Record<MetricType, { label: string; short: string }>> = {
  accuracy: { label: 'Accuracy', short: 'Acc.' },
  precision: { label: 'Precision', short: 'Préc.' },
  recall: { label: 'Recall', short: 'Recall' },
  f1: { label: 'F1-score', short: 'F1' },
  roc_auc: { label: 'AUC-ROC', short: 'AUC' },
  pr_auc: { label: 'PR-AUC', short: 'PR' },
  f1_pos: { label: 'F1 (positif)', short: 'F1+' },
  precision_macro: { label: 'Préc. macro', short: 'P-mac' },
  recall_macro: { label: 'Rappel macro', short: 'R-mac' },
  f1_macro: { label: 'F1 macro', short: 'F1-mac' },
  precision_weighted: { label: 'Préc. pondérée', short: 'P-wgt' },
  recall_weighted: { label: 'Rappel pondéré', short: 'R-wgt' },
  f1_weighted: { label: 'F1 pondéré', short: 'F1-wgt' },
  precision_micro: { label: 'Préc. micro', short: 'P-mic' },
  recall_micro: { label: 'Rappel micro', short: 'R-mic' },
  f1_micro: { label: 'F1 micro', short: 'F1-mic' },
  mae: { label: 'MAE', short: 'MAE' },
  mse: { label: 'MSE', short: 'MSE' },
  rmse: { label: 'RMSE', short: 'RMSE' },
  r2: { label: 'R²', short: 'R²' },
};

const CLASSIFICATION_PRIORITY: MetricType[] = [
  'roc_auc', 'pr_auc', 'f1', 'recall', 'precision', 'accuracy',
  'f1_macro', 'f1_weighted', 'f1_pos',
  'recall_macro', 'precision_macro',
  'recall_weighted', 'precision_weighted',
  'f1_micro', 'recall_micro', 'precision_micro',
];
const REGRESSION_PRIORITY: MetricType[] = ['r2', 'rmse', 'mae', 'mse'];

const CLASSIFICATION_FALLBACK: MetricType[] = ['roc_auc', 'f1', 'accuracy'];
const REGRESSION_FALLBACK: MetricType[] = ['rmse', 'mae', 'r2'];

export function selectComparisonMetrics(
  selected: MetricType[] | undefined | null,
  taskType: 'classification' | 'regression',
  max = 5,
): ComparisonMetric[] {
  const priority = taskType === 'regression' ? REGRESSION_PRIORITY : CLASSIFICATION_PRIORITY;
  const selectedSet = new Set(selected ?? []);
  const items: ComparisonMetric[] = [];
  const seen = new Set<string>();

  for (const metric of priority) {
    if (!selectedSet.has(metric)) continue;
    const summaryKey = METRIC_TO_SUMMARY_KEY[metric];
    if (!summaryKey || seen.has(summaryKey)) continue;
    const labels = METRIC_DISPLAY_LABELS[metric] ?? { label: metric, short: metric };
    items.push({ metric, summaryKey, label: labels.label, shortLabel: labels.short });
    seen.add(summaryKey);
    if (items.length >= max) break;
  }

  if (items.length === 0) {
    const fallback = taskType === 'regression' ? REGRESSION_FALLBACK : CLASSIFICATION_FALLBACK;
    for (const metric of fallback) {
      const summaryKey = METRIC_TO_SUMMARY_KEY[metric];
      if (!summaryKey) continue;
      const labels = METRIC_DISPLAY_LABELS[metric] ?? { label: metric, short: metric };
      items.push({ metric, summaryKey, label: labels.label, shortLabel: labels.short });
    }
  }

  return items;
}

// ── Detail-view helpers — require ModelResultDetail (from /details endpoint) ─

export function buildFeatureImportanceChartData(
  explainability: ExplainabilityData,
  topN = 8,
): FeatureImportanceChartRow[] {
  const source = Array.isArray(explainability.featureImportance)
    ? explainability.featureImportance
    : [];
  const cleaned = source
    .map((item) => ({
      feature: String(item?.feature ?? '').trim(),
      rawImportance: Number(item?.importance),
    }))
    .filter((item) => item.feature && Number.isFinite(item.rawImportance))
    .sort((a, b) => b.rawImportance - a.rawImportance)
    .slice(0, topN);

  const maxImportance = cleaned.reduce((max, item) => Math.max(max, Math.abs(item.rawImportance)), 0);
  const sumImportance = cleaned.reduce((s, item) => s + Math.abs(item.rawImportance), 0);
  const alreadyProportional = maxImportance <= 1.0;

  return cleaned.map((item) => ({
    feature: item.feature,
    label: truncateFeatureLabel(item.feature),
    rawImportance: item.rawImportance,
    normalizedImportance: maxImportance > 0 ? Math.abs(item.rawImportance) / maxImportance : 0,
    displayImportance: alreadyProportional
      ? item.rawImportance
      : sumImportance > 0
        ? Math.abs(item.rawImportance) / sumImportance
        : 0,
  }));
}

export function getDetailedMetrics(result: ModelResultDetail): DetailedClassificationMetrics {
  const candidate = result.metricsDetailed;
  if (!candidate || typeof candidate !== 'object') return {};
  return candidate as DetailedClassificationMetrics;
}

export function getClassificationType(result: ModelResultDetail): ClassificationType {
  const detailed = getDetailedMetrics(result);
  const rawType = String(detailed?.meta?.classification_type ?? '').trim().toLowerCase();
  if (rawType === 'binary' || rawType === 'multiclass' || rawType === 'multilabel') return rawType;

  const cm = Array.isArray(result.analysis?.confusionMatrix) ? result.analysis.confusionMatrix : [];
  if (cm.length === 2 && Array.isArray(cm[0]) && cm[0].length === 2) return 'binary';
  if (cm.length > 2) return 'multiclass';
  return 'unknown';
}

export function buildConfusionPayload(
  result: ModelResultDetail,
  detailed: DetailedClassificationMetrics,
): ConfusionPayload {
  const rawPayload = detailed?.confusion_matrix;
  const rawMatrix = Array.isArray(rawPayload?.matrix)
    ? rawPayload.matrix
    : Array.isArray(result.analysis?.confusionMatrix)
      ? result.analysis.confusionMatrix
      : [];

  const matrix = (rawMatrix ?? [])
    .filter((row) => Array.isArray(row))
    .map((row) =>
      row.map((v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }),
    );

  const rawLabels = Array.isArray(rawPayload?.labels) ? rawPayload.labels : [];
  const labels = (rawLabels.length === matrix.length ? rawLabels : matrix.map((_, idx) => idx)).map(
    (v) => String(v),
  );

  return { labels, matrix };
}

export function buildAveragesRows(
  detailed: DetailedClassificationMetrics,
): AverageRow[] {
  const macro = (detailed?.averaged?.macro ?? {}) as Record<string, unknown>;
  const weighted = (detailed?.averaged?.weighted ?? {}) as Record<string, unknown>;
  const micro = (detailed?.averaged?.micro ?? {}) as Record<string, unknown>;

  const rows: AverageRow[] = [
    {
      key: 'macro',
      label: 'Macro',
      precision: toFiniteNumber(macro.precision),
      recall: toFiniteNumber(macro.recall),
      f1: toFiniteNumber(macro.f1),
    },
    {
      key: 'weighted',
      label: 'Weighted',
      precision: toFiniteNumber(weighted.precision),
      recall: toFiniteNumber(weighted.recall),
      f1: toFiniteNumber(weighted.f1),
    },
    {
      key: 'micro',
      label: 'Micro',
      precision: toFiniteNumber(micro.precision),
      recall: toFiniteNumber(micro.recall),
      f1: toFiniteNumber(micro.f1),
    },
  ];

  return rows.filter((row) => row.precision !== null || row.recall !== null || row.f1 !== null);
}

export function buildPerClassRows(detailed: DetailedClassificationMetrics): PerClassRow[] {
  const source = detailed?.per_class;
  if (!source || typeof source !== 'object') return [];

  return Object.entries(source)
    .map(([label, raw]) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        label,
        precision: toFiniteNumber(row.precision),
        recall: toFiniteNumber(row.recall),
        f1: toFiniteNumber(row.f1),
        support: toFiniteNumber(row.support),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function buildClassificationView(result: ModelResultDetail): ClassificationView {
  const detailed = getDetailedMetrics(result);
  const global = (detailed?.global ?? {}) as Record<string, unknown>;
  const binary = (detailed?.binary ?? {}) as Record<string, unknown>;
  const macro = (detailed?.averaged?.macro ?? {}) as Record<string, unknown>;
  const classificationType = getClassificationType(result);

  const precisionPos = toFiniteNumber(binary.precision_pos);
  const recallPos = toFiniteNumber(binary.recall_pos);
  const f1Pos = toFiniteNumber(binary.f1_pos);

  const macroPrecision = toFiniteNumber(macro.precision);
  const macroRecall = toFiniteNumber(macro.recall);
  const macroF1 = toFiniteNumber(macro.f1);

  const isBinary = classificationType === 'binary';

  const balancingWarnings: unknown[] = Array.isArray(
    (result.balancing as Record<string, unknown> | null | undefined)?.warnings,
  )
    ? ((result.balancing as Record<string, unknown>).warnings as unknown[])
    : [];

  const warnings = toUniqueWarnings([
    ...((Array.isArray(result.analysis?.metricsWarnings) ? result.analysis.metricsWarnings : []) as unknown[]),
    ...((Array.isArray(detailed?.warnings) ? detailed.warnings : []) as unknown[]),
    ...balancingWarnings,
  ]);

  const positiveRaw = binary.positive_label ?? detailed?.meta?.positive_label;

  return {
    classificationType,
    positiveLabel: positiveRaw == null ? null : String(positiveRaw),
    accuracy: toFiniteNumber(global.accuracy),
    rocAuc: toFiniteNumber(global.roc_auc),
    prAuc: toFiniteNumber(global.pr_auc),
    precisionMain: isBinary ? precisionPos : macroPrecision,
    recallMain: isBinary ? recallPos : macroRecall,
    f1Main: isBinary ? f1Pos : macroF1,
    balancedAccuracy: toFiniteNumber(global.balanced_accuracy),
    specificity: toFiniteNumber(global.specificity),
    averages: buildAveragesRows(detailed),
    perClass: buildPerClassRows(detailed),
    confusion: buildConfusionPayload(result, detailed),
    warnings,
  };
}
