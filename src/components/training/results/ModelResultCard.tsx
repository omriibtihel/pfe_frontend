import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Bot, Loader2, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ModelResult } from '@/types';
import { humanizeWarning, modelColors, toSeconds } from './trainingResultsHelpers';
import { formatMetricValue } from '@/utils/metricUtils';
import { ModelDetailModal } from './ModelDetailModal';

const AMBER_WARNING_KEYS = new Set([
  'threshold_calibrated_on_train_data_may_be_optimistic',
]);

const INFO_WARNING_KEYS = new Set([
  'threshold_optimization_disabled_multiclass',
  'threshold_optimization_skipped_no_validation_data',
  'threshold_optimization_skipped_predict_proba_not_available',
]);

const EVAL_SOURCE_CONFIG: Record<string, {
  label: string;
  colorClass: string;
  icon: string;
}> = {
  holdout_test: {
    label: "Test holdout",
    colorClass: "text-green-600 bg-green-50 border-green-200",
    icon: "✅"
  },
  cv_mean: {
    label: "Moyenne CV",
    colorClass: "text-blue-600 bg-blue-50 border-blue-200",
    icon: "🔄"
  },
  loo: {
    label: "LOO",
    colorClass: "text-blue-600 bg-blue-50 border-blue-200",
    icon: "🔄"
  },
  validation: {
    label: "Validation",
    colorClass: "text-orange-600 bg-orange-50 border-orange-200",
    icon: "⚠️"
  },
  train_only: {
    label: "Entraînement uniquement",
    colorClass: "text-red-600 bg-red-50 border-red-200",
    icon: "!"
  },
  unknown: {
    label: "Source inconnue",
    colorClass: "text-gray-500 bg-gray-50 border-gray-200",
    icon: "❓"
  },
};

interface ModelResultCardProps {
  result: ModelResult;
  index: number;
  isBestModel: boolean;
  sessionId: string;
  projectId: string;
  isActive?: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
  onSaveModel: (modelId: string) => void;
}

export function ModelResultCard({
  result,
  index,
  isBestModel,
  sessionId,
  projectId,
  isActive = false,
  isSaved = false,
  isSaving = false,
  onSaveModel,
}: ModelResultCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const color = modelColors[result.modelType] ?? 'from-slate-500 to-slate-600';
  const isAutomlNonBest = Boolean(result.automl && !result.automl.isBest);
  const isRegression = result.taskType === 'regression';

  const metricStatus = result.primaryMetric.status ?? 'success';
  const primaryDisplay =
    metricStatus !== 'success'
      ? null
      : formatMetricValue(result.primaryMetric.value, result.primaryMetric.name);
  const showCvLabel = Boolean(result.testIsCvMean ?? (result.isCV && !result.hasHoldoutTest));

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.1, type: 'spring', stiffness: 200, damping: 22 }}
        aria-label={`Résultats du modèle ${result.modelType.toUpperCase()}${isBestModel ? ' (meilleur modèle)' : ''}`}
      >
        <Card className={`h-full overflow-hidden ${isBestModel ? 'ring-1 ring-amber-400/50' : ''}`}>
          <div className={`h-1.5 bg-gradient-to-r ${color}`} aria-hidden="true" />

          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <CardTitle className="text-sm font-semibold">
                  {result.modelType.toUpperCase()}
                </CardTitle>
                {isBestModel && (
                  <Badge className="bg-amber-500 text-[11px] text-white">Meilleur</Badge>
                )}
                {isActive && (
                  <Badge className="gap-1 text-[11px] bg-primary text-primary-foreground">
                    <Zap className="h-2.5 w-2.5" aria-hidden="true" /> Actif
                  </Badge>
                )}
                {result.automl && (
                  <Badge
                    variant="outline"
                    className="gap-1 text-[11px] border-violet-500 text-violet-700 dark:text-violet-400"
                  >
                    <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                    {result.automl.bestEstimator ?? 'AutoML'}
                  </Badge>
                )}
                {isAutomlNonBest && (
                  <Badge
                    variant="outline"
                    className="text-[11px] border-muted-foreground/40 text-muted-foreground"
                  >
                    Comparaison
                  </Badge>
                )}
                {result.isCV && (
                  <Badge variant="outline" className="text-[11px]">
                    CV
                  </Badge>
                )}
                {result.evaluationSource && (() => {
                  const cfg = EVAL_SOURCE_CONFIG[result.evaluationSource.type]
                    ?? EVAL_SOURCE_CONFIG.unknown;
                  return (
                    <span className={`text-xs border rounded px-1.5 py-0.5 font-medium ${cfg.colorClass}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  );
                })()}
              </div>
              <Badge
                variant="outline"
                className="shrink-0 text-[11px]"
                aria-label={`Temps d'entraînement : ${toSeconds(result.trainingTime)}`}
              >
                {toSeconds(result.trainingTime)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pb-4">
            {/* Métrique principale */}
            <section
              aria-label="Métrique principale"
              className="rounded-lg bg-muted/40 px-4 py-3 text-center"
            >
              {metricStatus === 'error' ? (
                <>
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {result.primaryMetric.displayName}
                  </p>
                  <Badge className="mt-1 bg-destructive text-[10px] text-destructive-foreground">
                    Erreur de calcul
                  </Badge>
                </>
              ) : metricStatus === 'not_applicable' ? (
                <>
                  <p className="text-2xl font-bold text-muted-foreground">N/A</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {result.primaryMetric.displayName}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-primary">{primaryDisplay}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {result.primaryMetric.displayName}
                  </p>
                  {result.primaryMetric?.direction && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {result.primaryMetric.direction === "lower_is_better"
                        ? "↓ plus bas = mieux"
                        : "↑ plus haut = mieux"}
                    </span>
                  )}
                  {showCvLabel && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="mt-1 inline-block cursor-help text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2">
                          CV val.
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Moyenne des scores de validation des folds CV. Pas un jeu de test indépendant.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}
            </section>

            {result.evaluationSource && !result.evaluationSource.isIndependentTest && (
              <p className="text-xs text-orange-600 mt-1 italic">
                Pas de jeu de test indépendant — score = {result.evaluationSource.label}
              </p>
            )}

            {result.warnings && result.warnings.length > 0 && (() => {
              const amberWarnings = result.warnings!.filter((w) => AMBER_WARNING_KEYS.has(w));
              const infoWarnings = result.warnings!.filter((w) => INFO_WARNING_KEYS.has(w));
              if (amberWarnings.length === 0 && infoWarnings.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {amberWarnings.map((w) => (
                    <Tooltip key={w}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help items-center rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠ Seuil optimiste
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {humanizeWarning(w)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {infoWarnings.map((w) => (
                    <Tooltip key={w}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help items-center rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                          ℹ {humanizeWarning(w).split(' — ')[0].split(':')[0]}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {humanizeWarning(w)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              );
            })()}

            {/* Boutons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setDetailOpen(true)}
                aria-label={`Voir les détails de ${result.modelType.toUpperCase()}`}
              >
                Voir les détails
              </Button>

              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                variant={isSaved ? 'secondary' : 'default'}
                disabled={isSaving || isAutomlNonBest}
                onClick={() => onSaveModel(result.id)}
                title={
                  isAutomlNonBest
                    ? 'Ce modèle est affiché à titre comparatif uniquement. Seul le meilleur modèle AutoML peut être sauvegardé.'
                    : undefined
                }
                aria-label={
                  isAutomlNonBest
                    ? `${result.modelType.toUpperCase()} — comparaison uniquement`
                    : isSaving
                      ? 'Enregistrement en cours...'
                      : isSaved
                        ? `Retirer ${result.modelType.toUpperCase()} des modèles sauvegardés`
                        : `Sauvegarder ${result.modelType.toUpperCase()} pour les prédictions`
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Enregistrement...
                  </>
                ) : isSaved ? (
                  <>
                    <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Sauvegardé
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.article>

      {detailOpen && (
        <ModelDetailModal
          result={result}
          sessionId={sessionId}
          projectId={projectId}
          isRegression={isRegression}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}
