import type { CurvesData, ExplainabilityData, ModelResult } from '@/types';
import type { ModelResultDetail } from '@/types/training/results';
import { trainingService } from '@/services/trainingService';
import {
  buildClassificationView,
  type ClassificationView,
} from '@/components/training/results/trainingResultsHelpers';

/**
 * Per-model detail fetched alongside the lightweight `session.results`.
 *
 * `session.results` is `ModelResult[]` (lightweight). Hyperparams, CV summary,
 * feature importance and curves live on separate endpoints — we fetch them
 * up-front and pass them down via a Map keyed by model id.
 */
export type ModelEnrichment = {
  detail: ModelResultDetail | null;
  explainability: ExplainabilityData | null;
  curves: CurvesData | null;
};

export const EMPTY_ENRICHMENT: ModelEnrichment = {
  detail: null,
  explainability: null,
  curves: null,
};

export async function fetchModelEnrichments(
  projectId: string,
  sessionId: string,
  modelIds: string[],
): Promise<Map<string, ModelEnrichment>> {
  const map = new Map<string, ModelEnrichment>();
  await Promise.all(
    modelIds.map(async (id) => {
      const [detailRes, explRes, curvesRes] = await Promise.allSettled([
        trainingService.getModelDetails(projectId, sessionId, id),
        trainingService.getModelExplainability(projectId, sessionId, id),
        trainingService.getModelCurves(projectId, sessionId, id),
      ]);
      if (detailRes.status === 'rejected') {
        console.warn(`PDF: failed to fetch details for model ${id}`, detailRes.reason);
      }
      if (explRes.status === 'rejected') {
        console.warn(`PDF: failed to fetch explainability for model ${id}`, explRes.reason);
      }
      if (curvesRes.status === 'rejected') {
        console.warn(`PDF: failed to fetch curves for model ${id}`, curvesRes.reason);
      }
      map.set(id, {
        detail: detailRes.status === 'fulfilled' ? detailRes.value : null,
        explainability: explRes.status === 'fulfilled' ? explRes.value : null,
        curves: curvesRes.status === 'fulfilled' ? curvesRes.value : null,
      });
    }),
  );
  return map;
}

/**
 * Builds a ClassificationView from the lightweight MetricsSummary on
 * ModelResult. Used as a fallback when the detail endpoint failed or hasn't
 * been fetched. Fields not available in MetricsSummary (precisionMain,
 * recallMain, specificity, balancedAccuracy) are returned as null.
 */
function buildClassificationViewFromSummary(model: ModelResult): ClassificationView {
  return {
    classificationType: 'unknown',
    positiveLabel: null,
    accuracy: model.metrics?.accuracy ?? null,
    rocAuc: model.metrics?.rocAuc ?? null,
    prAuc: null,
    precisionMain: null,
    recallMain: null,
    f1Main: model.metrics?.f1 ?? null,
    balancedAccuracy: null,
    specificity: null,
    averages: [],
    perClass: [],
    confusion: { labels: [], matrix: [] },
    warnings: [],
  };
}

export function cvForModel(
  model: ModelResult,
  detail: ModelResultDetail | null | undefined,
): ClassificationView {
  if (detail?.metricsDetailed) {
    return buildClassificationView(detail);
  }
  return buildClassificationViewFromSummary(model);
}

/**
 * Metrics whose values live in [0, 1] and are safely comparable on a fixed
 * visual scale (bar() / quality()). Unbounded metrics (RMSE, MAE, MSE) must
 * not be passed to the bar/quality renderers — their raw values would map to
 * arbitrary fill ratios and arbitrary "poor/excellent" labels.
 */
const _BOUNDED_METRICS = new Set([
  'accuracy',
  'f1',
  'roc_auc',
  'pr_auc',
  'r2',
  'precision',
  'recall',
  'specificity',
  'balanced_accuracy',
  'log_loss',
  'brier_score',
]);

export const isBounded = (name: string | null | undefined): boolean =>
  _BOUNDED_METRICS.has((name ?? '').toLowerCase());
