import { useMemo } from 'react';
import { Bookmark, Clock, Star, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ModelResult, TrainingSession } from '@/types';
import { toNumber, toPercent, toSeconds } from './trainingResultsHelpers';
import { formatMetricValue } from '@/utils/metricUtils';

interface ResultsOverviewProps {
  session: TrainingSession;
  bestModel: ModelResult | null | undefined;
  savedModelIds: Set<string>;
  onSaveModel: (id: string) => void;
}

export function ResultsOverview({
  session,
  bestModel,
  savedModelIds,
  onSaveModel,
}: ResultsOverviewProps) {
  const isRegression = session.config.taskType === 'regression';
  const isSaved = bestModel ? savedModelIds.has(bestModel.id) : false;

  const completedCount = session.results.length;

  const avgTime = useMemo(() => {
    const valid = session.results.filter((r) => r.trainingTime != null && r.trainingTime > 0);
    if (!valid.length) return null;
    return valid.reduce((s, r) => s + r.trainingTime, 0) / valid.length;
  }, [session.results]);

  const _pmStatus = bestModel?.primaryMetric.status ?? 'success';
  const primaryDisplayValue = !bestModel || _pmStatus !== 'success'
    ? '—'
    : formatMetricValue(
        bestModel.primaryMetric.value ?? bestModel.testScore,
        bestModel.primaryMetric.name,
      );

  return (
    <section aria-labelledby="overview-heading" className="space-y-3">
      <h2 id="overview-heading" className="text-lg font-semibold">Vue d'ensemble</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-800/40 dark:from-amber-950/20 dark:to-orange-950/20 md:col-span-2">
          <CardContent className="flex items-center gap-4 py-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40"
              aria-hidden="true"
            >
              <Trophy className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>

            {bestModel ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Meilleur modèle
                  </p>
                  <p className="text-xl font-bold">{bestModel.modelType.toUpperCase()}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {bestModel.primaryMetric.displayName}&nbsp;:{' '}
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        {primaryDisplayValue}
                      </span>
                    </span>
                    {!isRegression && bestModel.metrics.rocAuc != null && (
                      <span className="text-sm text-muted-foreground">
                        AUC-ROC&nbsp;:{' '}
                        <span className="font-semibold">{toPercent(bestModel.metrics.rocAuc)}</span>
                      </span>
                    )}
                    {bestModel.trainingTime != null && (
                      <Badge variant="outline" className="text-xs">
                        {toSeconds(bestModel.trainingTime)}
                      </Badge>
                    )}
                    {bestModel.evaluationSource && (
                      <span className="text-xs text-muted-foreground">
                        Source&nbsp;: {bestModel.evaluationSource.label}
                        {!bestModel.evaluationSource.isIndependentTest && (
                          <span className="text-orange-500 ml-1">
                            (pas de test indépendant)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => onSaveModel(bestModel.id)}
                  size="sm"
                  variant={isSaved ? 'secondary' : 'default'}
                  className={!isSaved ? 'shrink-0 bg-amber-600 text-white hover:bg-amber-700' : 'shrink-0'}
                  aria-label={
                    isSaved ? 'Modèle déjà sauvegardé' : `Sauvegarder ${bestModel.modelType.toUpperCase()}`
                  }
                >
                  <Star className={`mr-1.5 h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
                  {isSaved ? 'Sauvegardé' : 'Sauvegarder'}
                </Button>
              </>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Meilleur modèle
                </p>
                <p className="text-sm text-muted-foreground">
                  Aucun score d'évaluation disponible pour cette session.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <StatChip label="Modèles entraînés" value={String(completedCount)} />
          <StatChip
            icon={<Bookmark className="h-3.5 w-3.5" />}
            label="Sauvegardés"
            value={`${savedModelIds.size} / ${session.results.length}`}
            accent={savedModelIds.size > 0}
          />
          {avgTime != null && (
            <StatChip
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Temps moyen"
              value={toSeconds(avgTime)}
            />
          )}
          {bestModel && !isRegression && bestModel.metrics.f1 != null && (
            <StatChip label="F1 (meilleur)" value={toPercent(bestModel.metrics.f1)} accent />
          )}
          {bestModel && isRegression && (
            <>
              <StatChip label="RMSE (meilleur)" value={toNumber(bestModel.metrics.rmse)} accent />
              <StatChip label="MAE (meilleur)" value={toNumber(bestModel.metrics.mae)} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function StatChip({
  icon,
  label,
  value,
  accent = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-3">
      {icon && (
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className={`text-lg font-bold leading-tight ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
