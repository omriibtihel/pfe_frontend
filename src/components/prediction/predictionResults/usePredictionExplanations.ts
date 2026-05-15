import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';
import type {
  CounterfactualResult,
  ExplanationMethod,
  FeatureRangesMap,
  LimeLocalItem,
  PredictionResponse,
  PredictionRow,
  ShapLocalItem,
} from '@/types';

import { _triggerDownload } from './helpers';

export type ExplanationCacheEntry = {
  shap?: ShapLocalItem[];
  lime?: LimeLocalItem[];
  counterfactual?: CounterfactualResult;
};

/** What still needs to be fetched from the server before `method` can be rendered? */
function _missingMethods(entry: ExplanationCacheEntry, method: ExplanationMethod): ExplanationMethod | null {
  if (method === 'shap') return entry.shap ? null : 'shap';
  if (method === 'lime') return entry.lime ? null : 'lime';
  const missingShap = !entry.shap;
  const missingLime = !entry.lime;
  if (missingShap && missingLime) return 'both';
  if (missingShap) return 'shap';
  if (missingLime) return 'lime';
  return null;
}

/**
 * Shared cache + actions for SHAP/LIME explanations, DiCE counterfactuals,
 * feature ranges and CSV export. Used by both `BatchPredictionResults`
 * (multi-row table) and `SinglePredictionResult` (single-row hero view).
 */
export function usePredictionExplanations(projectId: string, result: PredictionResponse) {
  const { toast } = useToast();

  const [cache, setCache] = useState<Record<number, ExplanationCacheEntry>>({});
  const [loadingRows, setLoadingRows] = useState<Set<number>>(new Set());
  const [loadingCfRows, setLoadingCfRows] = useState<Set<number>>(new Set());
  const [featureRanges, setFeatureRanges] = useState<FeatureRangesMap>({});
  const [shouldLoadRanges, setShouldLoadRanges] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getRowExplanations = useCallback(
    (row: PredictionRow): ExplanationCacheEntry => {
      const cached = cache[row.rowIndex] ?? {};
      return {
        shap: cached.shap ?? row.shap ?? undefined,
        lime: cached.lime ?? row.lime ?? undefined,
        counterfactual: cached.counterfactual,
      };
    },
    [cache],
  );

  const fetchExplanations = useCallback(
    async (row: PredictionRow, method: ExplanationMethod): Promise<void> => {
      const entry = getRowExplanations(row);
      const needed = _missingMethods(entry, method);
      if (needed === null) return;

      setLoadingRows((prev) => new Set(prev).add(row.rowIndex));
      try {
        const explained = await predictionService.predictManualWithSavedModelExplain(
          projectId,
          result.modelId,
          [row.inputData],
          needed,
        );
        const respRow = explained.rows[0];
        if (!respRow) return;

        const update: ExplanationCacheEntry = {};
        if (respRow.shap && respRow.shap.length > 0) update.shap = respRow.shap;
        if (respRow.lime && respRow.lime.length > 0) update.lime = respRow.lime;

        if (!update.shap && !update.lime) {
          const label = needed === 'shap' ? 'SHAP' : needed === 'lime' ? 'LIME' : 'SHAP/LIME';
          toast({ title: `${label} indisponible pour ce modèle`, variant: 'destructive' });
          return;
        }

        setCache((prev) => ({
          ...prev,
          [row.rowIndex]: { ...(prev[row.rowIndex] ?? {}), ...update },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Impossible de calculer les explications.';
        console.error('[Expliquer] error:', err);
        toast({ title: 'Erreur explication', description: msg, variant: 'destructive' });
      } finally {
        setLoadingRows((prev) => {
          const s = new Set(prev);
          s.delete(row.rowIndex);
          return s;
        });
      }
    },
    [projectId, result.modelId, getRowExplanations, toast],
  );

  const runCounterfactual = useCallback(
    async (row: PredictionRow, featuresToVary: string[]): Promise<void> => {
      setLoadingCfRows((prev) => new Set(prev).add(row.rowIndex));
      try {
        const cfResult = await predictionService.computeCounterfactual(
          projectId,
          result.modelId,
          row.inputData,
          featuresToVary,
        );
        setCache((prev) => ({
          ...prev,
          [row.rowIndex]: { ...(prev[row.rowIndex] ?? {}), counterfactual: cfResult },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Impossible de calculer le contrefactuel.';
        console.error('[Contrefactuel] error:', err);
        toast({ title: 'Erreur contrefactuel', description: msg, variant: 'destructive' });
      } finally {
        setLoadingCfRows((prev) => {
          const s = new Set(prev);
          s.delete(row.rowIndex);
          return s;
        });
      }
    },
    [projectId, result.modelId, toast],
  );

  const cfLiveRunner = useCallback(
    async (overrides: Record<string, unknown>): Promise<{ prediction: unknown; score: number | null }> => {
      const resp = await predictionService.predictManualWithSavedModel(projectId, result.modelId, [overrides]);
      const r = resp.rows[0];
      return { prediction: r?.prediction ?? null, score: r?.score ?? null };
    },
    [projectId, result.modelId],
  );

  /** Idempotent: call when the CF modal opens to lazy-load feature ranges once per model. */
  const ensureFeatureRanges = useCallback(() => {
    setShouldLoadRanges(true);
  }, []);

  useEffect(() => {
    if (!shouldLoadRanges) return;
    if (Object.keys(featureRanges).length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const ranges = await predictionService.getFeatureRanges(projectId, result.modelId);
        if (!cancelled) setFeatureRanges(ranges);
      } catch (err) {
        console.warn('[CF] failed to load feature ranges:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadRanges, projectId, result.modelId, featureRanges]);

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const { blob, filename } = await predictionService.exportResultsCsv(
        projectId,
        result.modelId,
        result.modelType,
        result.rows,
      );
      _triggerDownload(blob, filename ?? `predictions_${result.modelType}.csv`);
      toast({ title: 'Export CSV réussi' });
    } catch (err) {
      toast({
        title: 'Erreur export',
        description: err instanceof Error ? err.message : "Impossible d'exporter.",
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [projectId, result, toast]);

  return {
    getRowExplanations,
    fetchExplanations,
    runCounterfactual,
    cfLiveRunner,
    featureRanges,
    ensureFeatureRanges,
    loadingRows,
    loadingCfRows,
    isRowLoading: (row: PredictionRow) => loadingRows.has(row.rowIndex),
    isCfLoading: (row: PredictionRow) => loadingCfRows.has(row.rowIndex),
    cache,
    exportCsv,
    isExporting,
  };
}
