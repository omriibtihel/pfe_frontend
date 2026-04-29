import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricsSummary, ModelResult, TrainingSession } from '@/types';
import { metricDirection } from '@/utils/metricUtils';
import {
  selectComparisonMetrics,
  toNumber,
  toPercent,
  toSeconds,
  type ComparisonMetric,
} from './trainingResultsHelpers';

/**
 * Returns true when lower values are "better" for the given column key.
 *
 * Model metrics delegate to the canonical metricDirection from metricUtils so
 * that additions to LOWER_IS_BETTER (e.g. mse, log_loss, brier_score) are
 * automatically honoured here without a second patch site.
 *
 * 'time' (training time) is handled explicitly: it is not a model metric and
 * therefore absent from metricUtils.LOWER_IS_BETTER, but a shorter training
 * time is still better for comparison purposes.
 *
 * Exported for unit tests — not part of the public API of this module.
 */
export function columnLowerIsBetter(key: string): boolean {
  if (key === 'time') return true;
  return metricDirection(key) === 'lower_is_better';
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  accuracy: 'Proportion de prédictions correctes.',
  precision: 'Parmi les positifs prédits, combien sont vraiment positifs.',
  recall: 'Parmi les vrais positifs, combien ont été détectés.',
  f1: 'Moyenne harmonique de la précision et du rappel.',
  roc_auc: 'Aire sous la courbe ROC. Discrimination entre classes.',
  pr_auc: 'Aire sous la courbe précision-rappel. Recommandé en cas de classes déséquilibrées.',
  f1_pos: 'F1 calculé sur la classe positive.',
  precision_macro: 'Précision moyenne (chaque classe pèse autant).',
  recall_macro: 'Rappel moyen (chaque classe pèse autant).',
  f1_macro: 'F1 moyen (chaque classe pèse autant).',
  precision_weighted: 'Précision pondérée par la fréquence des classes.',
  recall_weighted: 'Rappel pondéré par la fréquence des classes.',
  f1_weighted: 'F1 pondéré par la fréquence des classes.',
  precision_micro: 'Précision globale calculée sur tous les cas.',
  recall_micro: 'Rappel global calculé sur tous les cas.',
  f1_micro: 'F1 global calculé sur tous les cas.',
  r2: 'Coefficient de détermination (R²). Plus proche de 1 = meilleure explication de la variance.',
  rmse: "Racine de l'erreur quadratique moyenne. Pénalise les grandes erreurs.",
  mae: 'Erreur absolue moyenne. Robuste aux valeurs aberrantes.',
  mse: 'Erreur quadratique moyenne.',
  time: "Temps d'entraînement en secondes.",
};

interface SortConfig {
  key: string;
  dir: 'asc' | 'desc';
}

interface ModelsComparisonTableProps {
  session: TrainingSession;
  bestModel: ModelResult | null;
  isRegression: boolean;
}

export function ModelsComparisonTable({
  session,
  bestModel,
  isRegression,
}: ModelsComparisonTableProps) {
  const metricColumns = useMemo<ComparisonMetric[]>(
    () =>
      selectComparisonMetrics(
        session.config?.metrics,
        isRegression ? 'regression' : 'classification',
        5,
      ),
    [session.config?.metrics, isRegression],
  );

  const defaultSortKey = metricColumns[0]?.metric ?? (isRegression ? 'rmse' : 'accuracy');
  const [sort, setSort] = useState<SortConfig>({
    key: defaultSortKey,
    dir: columnLowerIsBetter(defaultSortKey) ? 'asc' : 'desc',
  });

  const getMetricValue = (r: ModelResult, summaryKey: keyof MetricsSummary): number | null => {
    const value = r.metrics?.[summaryKey];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  const sorted = useMemo(() => {
    const sortColumn = metricColumns.find((c) => c.metric === sort.key);
    return [...session.results].sort((a, b) => {
      const av = sort.key === 'time'
        ? a.trainingTime ?? null
        : sortColumn ? getMetricValue(a, sortColumn.summaryKey) : null;
      const bv = sort.key === 'time'
        ? b.trainingTime ?? null
        : sortColumn ? getMetricValue(b, sortColumn.summaryKey) : null;
      const na = av == null ? Number.NaN : Number(av);
      const nb = bv == null ? Number.NaN : Number(bv);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      if (columnLowerIsBetter(sort.key)) return sort.dir === 'asc' ? na - nb : nb - na;
      return sort.dir === 'desc' ? nb - na : na - nb;
    });
  }, [session.results, sort, metricColumns]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' },
    );

  const fmt = (key: string, val: number | null): React.ReactNode => {
    if (val == null || !Number.isFinite(val)) {
      return <span className="text-muted-foreground/40">—</span>;
    }
    if (key === 'time') return toSeconds(val);
    if (key === 'r2' || key === 'rmse' || key === 'mae' || key === 'mse') return toNumber(val);
    return toPercent(val);
  };

  return (
    <section aria-labelledby="comparison-heading">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle id="comparison-heading" className="text-base font-semibold">
              Comparaison des modèles
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {session.results.length} modèle{session.results.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Cliquez sur un en-tête pour trier. La ligne en doré est le meilleur modèle.
          </p>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              role="grid"
              aria-label="Comparaison des performances des modèles"
            >
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Modèle
                  </th>
                  {metricColumns.map((col) => (
                    <th
                      key={col.metric}
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-muted-foreground"
                      title={METRIC_DESCRIPTIONS[col.metric]}
                    >
                      <button
                        onClick={() => toggleSort(col.metric)}
                        className="group flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Trier par ${col.label}${sort.key === col.metric ? (sort.dir === 'desc' ? ' - décroissant' : ' - croissant') : ''}`}
                      >
                        <span>{col.label}</span>
                        <SortIcon colKey={col.metric} sort={sort} />
                      </button>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                    title={METRIC_DESCRIPTIONS.time}
                  >
                    <button
                      onClick={() => toggleSort('time')}
                      className="group flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Trier par Temps${sort.key === 'time' ? (sort.dir === 'desc' ? ' - décroissant' : ' - croissant') : ''}`}
                    >
                      <span>Temps</span>
                      <SortIcon colKey="time" sort={sort} />
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((result) => {
                  const isBest = result.id === bestModel?.id;
                  return (
                    <tr
                      key={result.id}
                      className={[
                        'border-b border-border/50 transition-colors hover:bg-muted/30',
                        isBest ? 'bg-amber-50/70 dark:bg-amber-950/20' : '',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isBest && (
                            <Trophy
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label="Meilleur modèle"
                            />
                          )}
                          <span
                            className={`font-semibold ${isBest ? 'text-amber-700 dark:text-amber-400' : ''}`}
                          >
                            {result.modelType.toUpperCase()}
                          </span>
                          {result.isCV && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              CV
                            </Badge>
                          )}
                          {result.automl && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-violet-400 text-violet-600">
                              AutoML
                            </Badge>
                          )}
                          {result.evaluationSource && (
                            <span
                              className={`text-[10px] border rounded px-1 py-0.5 ${
                                result.evaluationSource.isIndependentTest
                                  ? 'text-green-600 border-green-300 bg-green-50'
                                  : result.evaluationSource.type === 'train_only'
                                    ? 'text-red-600 border-red-300 bg-red-50'
                                    : 'text-blue-600 border-blue-300 bg-blue-50'
                              }`}
                            >
                              {result.evaluationSource.label}
                            </span>
                          )}
                        </div>
                      </td>

                      {metricColumns.map((col) => {
                        const val = getMetricValue(result, col.summaryKey);
                        const isActiveSort = sort.key === col.metric;
                        return (
                          <td
                            key={col.metric}
                            className={`px-4 py-3 tabular-nums ${isActiveSort ? 'font-semibold text-primary' : ''}`}
                          >
                            {fmt(col.metric, val)}
                          </td>
                        );
                      })}
                      <td
                        className={`px-4 py-3 tabular-nums ${sort.key === 'time' ? 'font-semibold text-primary' : ''}`}
                      >
                        {fmt('time', result.trainingTime ?? null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SortIcon({ colKey, sort }: { colKey: string; sort: SortConfig }) {
  if (sort.key !== colKey) {
    return (
      <ArrowUpDown
        className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-70"
        aria-hidden="true"
      />
    );
  }
  return sort.dir === 'desc' ? (
    <ArrowDown className="h-3 w-3 text-primary" aria-hidden="true" />
  ) : (
    <ArrowUp className="h-3 w-3 text-primary" aria-hidden="true" />
  );
}
