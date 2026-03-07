import { CheckCircle2, Layers, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { CvFoldResult, CvMetricsSummary } from '@/types';

// eslint-disable-next-line react-refresh/only-export-components
export function fmtMetric(v: number | undefined | null): string {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Math.abs(Number(v)) <= 1.5 ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(4);
}

function flattenMetrics(m: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  const SKIP = new Set([
    'warnings',
    'meta',
    'confusion_matrix',
    'per_class',
    'averaged',
    'binary',
    'global',
    'legacy_flat',
  ]);
  const lf = m.legacy_flat as Record<string, unknown> | undefined;
  const gl = m.global as Record<string, unknown> | undefined;
  if (lf) Object.entries(lf).forEach(([k, v]) => { if (typeof v === 'number' && !Number.isNaN(v)) out[k] = v; });
  if (gl) Object.entries(gl).forEach(([k, v]) => { if (typeof v === 'number' && !Number.isNaN(v) && !(k in out)) out[k] = v; });
  Object.entries(m).forEach(([k, v]) => {
    if (!SKIP.has(k) && typeof v === 'number' && !Number.isNaN(v) && !(k in out)) out[k] = v;
  });
  return out;
}

export interface CvResultsPanelProps {
  cvSummary: CvMetricsSummary;
  cvFoldResults: CvFoldResult[];
  kFolds?: number;
  hasHoldoutTest?: boolean;
  cvTestMetrics?: Record<string, unknown> | null;
  cvMeanMetrics?: Record<string, number> | null;
}

export function CvResultsPanel({
  cvSummary,
  cvFoldResults,
  kFolds,
  hasHoldoutTest,
  cvTestMetrics,
}: CvResultsPanelProps) {
  const meanEntries = Object.entries(cvSummary.mean ?? {}).filter(([k]) => k !== 'training_time_sec');
  const successFolds = cvFoldResults.filter((f) => f.status === 'ok');
  const failedFolds = cvFoldResults.filter((f) => f.status !== 'ok');

  const topMetricKeys = [...meanEntries]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k]) => k);

  const testFlatEntries = cvTestMetrics
    ? Object.entries(flattenMetrics(cvTestMetrics as Record<string, unknown>)).filter(([k]) => k !== 'training_time_sec')
    : [];

  return (
    <div className="space-y-4" role="region" aria-label="Résultats de validation croisée">
      <div className="flex items-center gap-2 flex-wrap">
        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">
          Validation croisée — {kFolds ?? cvFoldResults.length} folds
        </span>
        <Badge variant="default" className="text-xs">
          CV
        </Badge>
        {hasHoldoutTest && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Target className="h-3 w-3" aria-hidden="true" />
            Test holdout séparé
          </Badge>
        )}
        {failedFolds.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {failedFolds.length} fold{failedFolds.length > 1 ? 's' : ''} échoué
            {failedFolds.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {hasHoldoutTest && testFlatEntries.length > 0 && (
        <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-50/40 p-3 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Score test holdout final
            </span>
            <Badge variant="outline" className="border-emerald-400 text-xs text-emerald-700">
              Évaluation indépendante
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {testFlatEntries.slice(0, 6).map(([k, v]) => (
              <div
                key={k}
                className="rounded-md bg-emerald-100/60 p-2 text-center dark:bg-emerald-900/30"
              >
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                  {fmtMetric(v)}
                </p>
                <p className="text-xs text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {meanEntries.length > 0 && (
        <div>
          {hasHoldoutTest && (
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Métriques CV (sur données d'entraînement — hors holdout)
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm" aria-label="Statistiques CV par métrique">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Métrique
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Moyenne
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Écart-type
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Min
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Max
                  </th>
                </tr>
              </thead>
              <tbody>
                {meanEntries.map(([key, meanVal]) => (
                  <tr key={key} className="border-t border-border/60">
                    <td className="px-3 py-2 text-xs font-medium">{key}</td>
                    <td className="px-3 py-2 font-semibold text-primary">{fmtMetric(meanVal)}</td>
                    <td className="px-3 py-2 text-muted-foreground">±{fmtMetric(cvSummary.std?.[key])}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtMetric(cvSummary.min?.[key])}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtMetric(cvSummary.max?.[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {successFolds.length > 0 && topMetricKeys.length > 0 && (
        <details className="group">
          <summary className="list-none cursor-pointer select-none text-xs text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1.5">
            <span
              className="inline-block transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              ›
            </span>
            Détails par fold ({successFolds.length} folds réussis)
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-xs" aria-label="Résultats par fold">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Fold
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Train
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Val
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Balancing
                  </th>
                  {topMetricKeys.map((k) => (
                    <th key={k} scope="col" className="px-2 py-2 text-left font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cvFoldResults.map((fr) => {
                  const flat: Record<string, number | null | unknown> = {};
                  if (fr.metrics && typeof fr.metrics === 'object') {
                    const m = fr.metrics as Record<string, unknown>;
                    const lf = m.legacy_flat as Record<string, unknown> | undefined;
                    const gl = m.global as Record<string, unknown> | undefined;
                    if (lf) Object.assign(flat, lf);
                    if (gl) Object.entries(gl).forEach(([k, v]) => { if (!(k in flat)) flat[k] = v; });
                    Object.entries(m).forEach(([k, v]) => {
                      if (!['legacy_flat', 'global', 'binary', 'averaged', 'per_class', 'confusion_matrix', 'warnings', 'meta'].includes(k)) {
                        if (!(k in flat)) flat[k] = v;
                      }
                    });
                  }

                  return (
                    <tr
                      key={fr.fold}
                      className={`border-t border-border/60 ${fr.status !== 'ok' ? 'bg-destructive/10' : ''}`}
                    >
                      <td className="px-2 py-2 font-medium">{fr.fold}</td>
                      <td className="px-2 py-2">{fr.train_size ?? '—'}</td>
                      <td className="px-2 py-2">{fr.val_size ?? '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {fr.status !== 'ok' ? (
                          <span className="text-destructive">{fr.error ?? 'Erreur'}</span>
                        ) : (
                          fr.balancing_strategy ?? 'none'
                        )}
                      </td>
                      {topMetricKeys.map((k) => (
                        <td key={k} className="px-2 py-2">
                          {fr.status === 'ok' ? fmtMetric(flat[k] as number | null) : '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="text-xs italic text-muted-foreground">
        {hasHoldoutTest
          ? "Modèle sauvegardé = refit sur les données non-test. Le score holdout est l'évaluation finale indépendante."
          : "Modèle sauvegardé = refit final sur toutes les données. Les métriques CV sont l'estimation honnête de généralisation."}
      </p>
    </div>
  );
}
