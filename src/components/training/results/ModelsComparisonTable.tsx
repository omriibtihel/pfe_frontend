import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ModelResult, TrainingSession } from '@/types';
import { metricDirection } from '@/utils/metricUtils';
import { toNumber, toPercent, toSeconds } from './trainingResultsHelpers';

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
  accuracy: 'Proportion de prédictions correctes sur le jeu de test.',
  f1: 'Moyenne harmonique de la précision et du rappel.',
  rocAuc: 'Aire sous la courbe ROC. Mesure la discrimination du modèle entre les classes.',
  r2: 'Coefficient de détermination (R²). Plus proche de 1 = meilleure explication de la variance.',
  rmse: "Racine de l'erreur quadratique moyenne. Pénalise les grandes erreurs.",
  mae: 'Erreur absolue moyenne. Robuste aux valeurs aberrantes.',
  time: "Temps d'entraînement en secondes.",
};

interface SortConfig {
  key: string;
  dir: 'asc' | 'desc';
}

interface EnrichedRow {
  result: ModelResult;
  accuracy: number | null;
  f1: number | null;
  rocAuc: number | null;
  r2: number | null;
  rmse: number | null;
  mae: number | null;
  time: number | null;
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
  const [sort, setSort] = useState<SortConfig>({
    key: isRegression ? 'rmse' : 'rocAuc',
    dir: isRegression ? 'asc' : 'desc',
  });

  const columns: Array<{ key: keyof Omit<EnrichedRow, 'result'>; label: string }> = isRegression
    ? [
        { key: 'r2', label: 'R²' },
        { key: 'rmse', label: 'RMSE' },
        { key: 'mae', label: 'MAE' },
        { key: 'time', label: 'Temps' },
      ]
    : [
        { key: 'accuracy', label: 'Accuracy' },
        { key: 'f1', label: 'F1-score' },
        { key: 'rocAuc', label: 'AUC-ROC' },
        { key: 'time', label: 'Temps' },
      ];

  const enriched = useMemo<EnrichedRow[]>(
    () =>
      session.results.map((r) => ({
        result: r,
        accuracy: r.metrics.accuracy ?? null,
        f1: r.metrics.f1 ?? null,
        rocAuc: r.metrics.rocAuc ?? null,
        r2: r.metrics.r2 ?? null,
        rmse: r.metrics.rmse ?? null,
        mae: r.metrics.mae ?? null,
        time: r.trainingTime ?? null,
      })),
    [session.results],
  );

  const sorted = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const av = (a[sort.key as keyof EnrichedRow] as number | null) ?? Number.NEGATIVE_INFINITY;
      const bv = (b[sort.key as keyof EnrichedRow] as number | null) ?? Number.NEGATIVE_INFINITY;
      const na = Number(av);
      const nb = Number(bv);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      if (columnLowerIsBetter(sort.key)) return sort.dir === 'asc' ? na - nb : nb - na;
      return sort.dir === 'desc' ? nb - na : na - nb;
    });
  }, [enriched, sort]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' },
    );

  const fmt = (key: string, val: number | null): React.ReactNode => {
    if (val == null || !Number.isFinite(val)) {
      return <span className="text-muted-foreground/40">—</span>;
    }
    if (key === 'time') return toSeconds(val);
    if (key === 'r2' || key === 'rmse' || key === 'mae') return toNumber(val);
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
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className="px-4 py-3 text-left font-medium text-muted-foreground"
                      title={METRIC_DESCRIPTIONS[col.key]}
                    >
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="group flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Trier par ${col.label}${sort.key === col.key ? (sort.dir === 'desc' ? ' - décroissant' : ' - croissant') : ''}`}
                      >
                        <span>{col.label}</span>
                        <SortIcon colKey={col.key} sort={sort} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sorted.map(({ result, ...vals }) => {
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

                      {columns.map((col) => {
                        const val = vals[col.key as keyof typeof vals] as number | null;
                        const isActiveSort = sort.key === col.key;
                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-3 tabular-nums ${isActiveSort ? 'font-semibold text-primary' : ''}`}
                          >
                            {fmt(col.key, val)}
                          </td>
                        );
                      })}
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
