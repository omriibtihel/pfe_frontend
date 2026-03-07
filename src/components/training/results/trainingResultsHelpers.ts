import type { DetailedClassificationMetrics, ModelResult } from '@/types';

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
};

export function humanizeWarning(key: string): string {
  return WARNING_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function truncateFeatureLabel(value: string, max = 24): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function buildFeatureImportanceChartData(
  result: ModelResult,
  topN = 8,
): FeatureImportanceChartRow[] {
  const source = Array.isArray(result.featureImportance) ? result.featureImportance : [];
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

export function getPreprocessingSummary(result: ModelResult): string {
  const p = (result.preprocessing ?? {}) as Record<string, unknown>;
  const defaults = (p.defaults ?? {}) as Record<string, unknown>;
  const effectiveByColumn = (p.effectiveByColumn ?? {}) as Record<string, unknown>;
  const droppedColumns = Array.isArray(p.droppedColumns) ? p.droppedColumns : [];

  if (Object.keys(defaults).length || Object.keys(effectiveByColumn).length || droppedColumns.length) {
    const parts: string[] = [];
    if (Object.keys(defaults).length) {
      parts.push(
        `Defaults: numImp=${String(defaults.numericImputation ?? '-')}, numScale=${String(defaults.numericScaling ?? '-')}, catImp=${String(defaults.categoricalImputation ?? '-')}, catEnc=${String(defaults.categoricalEncoding ?? '-')}`,
      );
    }
    if (Object.keys(effectiveByColumn).length) {
      parts.push(`effectiveByColumn: ${Object.keys(effectiveByColumn).length}`);
    }
    if (droppedColumns.length) parts.push(`dropped: ${droppedColumns.length}`);
    return parts.join(' | ');
  }

  const selected = (p.selectedMethods ?? {}) as Record<string, unknown>;
  const legacy = (selected.legacy ?? {}) as Record<string, unknown>;
  const imputation = ((legacy.imputation ?? selected.imputation) ?? {}) as Record<string, unknown>;
  const encoding = ((legacy.encoding ?? selected.encoding) ?? {}) as Record<string, unknown>;
  const scaling = ((legacy.scaling ?? selected.scaling) ?? {}) as Record<string, unknown>;

  const parts: string[] = [];
  const numImp = String(selected.numericImputation ?? imputation.numeric ?? '').trim();
  const catImp = String(selected.categoricalImputation ?? imputation.categorical ?? '').trim();
  const catEnc = String(selected.categoricalEncoding ?? encoding.categorical ?? '').trim();
  const numScaling = String(selected.numericScaling ?? scaling.numeric ?? '').trim();

  if (numImp) parts.push(`Imp(num): ${numImp}`);
  if (catImp) parts.push(`Imp(cat): ${catImp}`);
  if (catEnc) parts.push(`Enc(cat): ${catEnc}`);
  if (numScaling) parts.push(`Norm(num): ${numScaling}`);

  return parts.join(' | ');
}

export function getDetailedMetrics(result: ModelResult): DetailedClassificationMetrics {
  const candidate = result.metricsDetailed;
  if (!candidate || typeof candidate !== 'object') return {};
  return candidate;
}

export function getClassificationType(result: ModelResult): ClassificationType {
  const detailed = getDetailedMetrics(result);
  const rawType = String(detailed?.meta?.classification_type ?? '').trim().toLowerCase();
  if (rawType === 'binary' || rawType === 'multiclass' || rawType === 'multilabel') return rawType;

  const hasPos =
    Number.isFinite(Number(result.metrics?.precision_pos)) ||
    Number.isFinite(Number(result.metrics?.recall_pos));
  if (hasPos) return 'binary';

  const cm = Array.isArray(result.confusionMatrix) ? result.confusionMatrix : [];
  if (cm.length === 2 && Array.isArray(cm[0]) && cm[0].length === 2) return 'binary';
  if (cm.length > 2) return 'multiclass';
  return 'unknown';
}

export function buildConfusionPayload(
  result: ModelResult,
  detailed: DetailedClassificationMetrics,
): ConfusionPayload {
  const rawPayload = detailed?.confusion_matrix;
  const rawMatrix = Array.isArray(rawPayload?.matrix)
    ? rawPayload.matrix
    : Array.isArray(result.confusionMatrix)
      ? result.confusionMatrix
      : [];

  const matrix = rawMatrix
    .filter((row) => Array.isArray(row))
    .map((row) =>
      row.map((v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }),
    );

  const rawLabels = Array.isArray(rawPayload?.labels) ? rawPayload.labels : [];
  const labels = (rawLabels.length === matrix.length ? rawLabels : matrix.map((_, idx) => idx)).map((v) => String(v));

  return { labels, matrix };
}

export function buildAveragesRows(
  result: ModelResult,
  detailed: DetailedClassificationMetrics,
): AverageRow[] {
  const macro = (detailed?.averaged?.macro ?? {}) as Record<string, unknown>;
  const weighted = (detailed?.averaged?.weighted ?? {}) as Record<string, unknown>;
  const micro = (detailed?.averaged?.micro ?? {}) as Record<string, unknown>;

  const rows: AverageRow[] = [
    {
      key: 'macro',
      label: 'Macro',
      precision: toFiniteNumber(macro.precision ?? result.metrics?.precision_macro),
      recall: toFiniteNumber(macro.recall ?? result.metrics?.recall_macro),
      f1: toFiniteNumber(macro.f1 ?? result.metrics?.f1_macro),
    },
    {
      key: 'weighted',
      label: 'Weighted',
      precision: toFiniteNumber(weighted.precision ?? result.metrics?.precision_weighted),
      recall: toFiniteNumber(weighted.recall ?? result.metrics?.recall_weighted),
      f1: toFiniteNumber(weighted.f1 ?? result.metrics?.f1_weighted),
    },
    {
      key: 'micro',
      label: 'Micro',
      precision: toFiniteNumber(micro.precision ?? result.metrics?.precision_micro),
      recall: toFiniteNumber(micro.recall ?? result.metrics?.recall_micro),
      f1: toFiniteNumber(micro.f1 ?? result.metrics?.f1_micro),
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

export function buildClassificationView(result: ModelResult): ClassificationView {
  const detailed = getDetailedMetrics(result);
  const global = (detailed?.global ?? {}) as Record<string, unknown>;
  const binary = (detailed?.binary ?? {}) as Record<string, unknown>;
  const macro = (detailed?.averaged?.macro ?? {}) as Record<string, unknown>;
  const classificationType = getClassificationType(result);

  const precisionPos = toFiniteNumber(binary.precision_pos ?? result.metrics?.precision_pos);
  const recallPos = toFiniteNumber(binary.recall_pos ?? result.metrics?.recall_pos);
  const f1Pos = toFiniteNumber(binary.f1_pos ?? result.metrics?.f1_pos);

  const macroPrecision = toFiniteNumber(
    macro.precision ?? result.metrics?.precision_macro ?? result.metrics?.precision,
  );
  const macroRecall = toFiniteNumber(
    macro.recall ?? result.metrics?.recall_macro ?? result.metrics?.recall,
  );
  const macroF1 = toFiniteNumber(
    macro.f1 ?? result.metrics?.f1_macro ?? result.metrics?.f1,
  );

  const isBinary = classificationType === 'binary';

  const balancingWarnings: unknown[] = Array.isArray((result.balancing as Record<string, unknown>)?.warnings)
    ? ((result.balancing as Record<string, unknown>).warnings as unknown[])
    : [];

  const warnings = toUniqueWarnings([
    ...((Array.isArray(result.metricsWarnings) ? result.metricsWarnings : []) as unknown[]),
    ...((Array.isArray(detailed?.warnings) ? detailed.warnings : []) as unknown[]),
    ...balancingWarnings,
  ]);

  const positiveRaw = binary.positive_label ?? detailed?.meta?.positive_label;

  return {
    classificationType,
    positiveLabel: positiveRaw == null ? null : String(positiveRaw),
    accuracy: toFiniteNumber(global.accuracy ?? result.metrics?.accuracy),
    rocAuc: toFiniteNumber(global.roc_auc ?? result.metrics?.roc_auc),
    prAuc: toFiniteNumber(global.pr_auc ?? result.metrics?.pr_auc),
    precisionMain: isBinary ? precisionPos : macroPrecision,
    recallMain: isBinary ? recallPos : macroRecall,
    f1Main: isBinary ? f1Pos : macroF1,
    balancedAccuracy: toFiniteNumber(global.balanced_accuracy ?? result.metrics?.balanced_accuracy),
    specificity: toFiniteNumber(global.specificity ?? result.metrics?.specificity),
    averages: buildAveragesRows(result, detailed),
    perClass: buildPerClassRows(detailed),
    confusion: buildConfusionPayload(result, detailed),
    warnings,
  };
}
