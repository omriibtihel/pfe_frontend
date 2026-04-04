import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Bot, ChevronDown, Loader2, Settings2, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BootstrapCIEntry, MetricType, ModelResult } from '@/types';
import { ModelCardAnalyseTab } from './ModelCardAnalyseTab';
import { ModelCardCourbesTab, ModelCardVariablesTab } from './ModelCardVariablesTab';
import {
  buildClassificationView,
  buildFeatureImportanceChartData,
  clampPercent,
  getPreprocessingSummary,
  metricLabels,
  modelColors,
  toNumber,
  toPercent,
  toSeconds,
} from './trainingResultsHelpers';

interface ModelResultCardProps {
  result: ModelResult;
  index: number;
  isBestModel: boolean;
  isRegression: boolean;
  isActive?: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
  defaultExpanded?: boolean;
  /** Quand défini, seules les métriques présentes dans cette liste sont affichées (config manuelle). */
  displayMetrics?: MetricType[] | null;
  onSaveModel: (modelId: string) => void;
}

export function ModelResultCard({
  result,
  index,
  isBestModel,
  isRegression,
  isActive = false,
  isSaved = false,
  isSaving = false,
  defaultExpanded = false,
  displayMetrics,
  onSaveModel,
}: ModelResultCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const color = modelColors[result.modelType] ?? 'from-slate-500 to-slate-600';
  const featureChartData = useMemo(() => buildFeatureImportanceChartData(result), [result]);
  const classView = useMemo(
    () => (isRegression ? null : buildClassificationView(result)),
    [result, isRegression],
  );
  const isBinary = classView?.classificationType === 'binary';
  const isAutomlNonBest = Boolean(result.automl && !result.automl.isBest);

  const hasAnalyse =
    (!isRegression && classView !== null) ||
    (isRegression && result.residualAnalysis != null) ||
    (result.isCV && result.cvSummary != null) ||
    result.gridSearch?.enabled === true;
  const hasVariables =
    featureChartData.length > 0 ||
    (result.permutationImportance?.length ?? 0) > 0 ||
    (result.shapGlobal?.summary?.length ?? 0) > 0;
  const hasCourbes =
    Boolean(result.curves?.roc || result.curves?.pr || result.curves?.calibration) ||
    result.learningCurves != null;
  const hasDetails =
    result.automl != null ||
    !!(result.splitInfo || result.preprocessing || result.balancing || result.thresholding || result.smote);

  const defaultTab =
    hasAnalyse ? 'analyse' : hasVariables ? 'variables' : hasCourbes ? 'courbes' : 'details';
  const tabCount = [hasAnalyse, hasVariables, hasCourbes, hasDetails].filter(Boolean).length;
  const gridColsClass =
    ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as Record<number, string>)[tabCount] ?? 'grid-cols-4';

  const metricCards = isRegression
    ? [
        { key: 'r2', label: metricLabels.r2, value: toNumber(result.metrics?.r2), relatedMetrics: ['r2'] as MetricType[] },
        { key: 'rmse', label: metricLabels.rmse, value: toNumber(result.metrics?.rmse), relatedMetrics: ['rmse'] as MetricType[] },
        { key: 'mae', label: metricLabels.mae, value: toNumber(result.metrics?.mae), relatedMetrics: ['mae'] as MetricType[] },
      ]
    : [
        {
          key: 'accuracy',
          label: metricLabels.accuracy,
          value: toPercent(classView?.accuracy),
          relatedMetrics: ['accuracy'] as MetricType[],
        },
        {
          key: 'roc_auc',
          label: metricLabels.roc_auc,
          value: toPercent(classView?.rocAuc),
          relatedMetrics: ['roc_auc'] as MetricType[],
        },
        {
          key: 'pr_auc',
          label: metricLabels.pr_auc,
          value: toPercent(classView?.prAuc),
          relatedMetrics: ['pr_auc'] as MetricType[],
        },
        {
          key: 'precision_main',
          label: isBinary ? `Précision (+${classView?.positiveLabel ?? ''})` : 'Précision (macro)',
          value: toPercent(classView?.precisionMain),
          relatedMetrics: ['precision', 'precision_macro', 'precision_weighted', 'precision_micro'] as MetricType[],
        },
        {
          key: 'recall_main',
          label: isBinary ? `Rappel (+${classView?.positiveLabel ?? ''})` : 'Rappel (macro)',
          value: toPercent(classView?.recallMain),
          relatedMetrics: ['recall', 'recall_macro', 'recall_weighted', 'recall_micro'] as MetricType[],
        },
        {
          key: 'f1_main',
          label: isBinary ? `F1 (+${classView?.positiveLabel ?? ''})` : 'F1 (macro)',
          value: toPercent(classView?.f1Main),
          relatedMetrics: ['f1', 'f1_macro', 'f1_weighted', 'f1_micro', 'f1_pos'] as MetricType[],
        },
      ];

  const displayMetricSet = displayMetrics ? new Set(displayMetrics) : null;
  const visibleMetricCards = displayMetricSet
    ? metricCards.filter((card) => card.relatedMetrics.some((m) => displayMetricSet.has(m)))
    : metricCards;

  return (
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
              <CardTitle className="text-sm font-semibold">{result.modelType.toUpperCase()}</CardTitle>
              {isBestModel && <Badge className="bg-amber-500 text-[11px] text-white">Meilleur</Badge>}
              {isActive && (
                <Badge className="gap-1 text-[11px] bg-primary text-primary-foreground">
                  <Zap className="h-2.5 w-2.5" aria-hidden="true" /> Actif
                </Badge>
              )}
              {result.automl && (
                <Badge variant="outline" className="gap-1 text-[11px] border-violet-500 text-violet-700 dark:text-violet-400">
                  <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                  {result.automl.bestEstimator ?? 'AutoML'}
                </Badge>
              )}
              {isAutomlNonBest && (
                <Badge variant="outline" className="text-[11px] border-muted-foreground/40 text-muted-foreground">
                  Comparaison
                </Badge>
              )}
              {!isRegression &&
                classView?.classificationType &&
                classView.classificationType !== 'unknown' && (
                  <Badge variant="outline" className="text-[11px]">
                    {classView.classificationType === 'binary' ? 'Binaire' : 'Multi-classes'}
                  </Badge>
                )}
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

        <CardContent className="space-y-3 pb-3">
          <section aria-label="Métriques clés">
            <div className="grid grid-cols-3 gap-1.5">
              {visibleMetricCards.map((metric) => (
                <div key={metric.key} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                  <p className="text-base font-bold text-primary">{metric.value}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>

            {/* Brier + CI + source CV — sur une même ligne condensée */}
            {(() => {
              const bs = (result.metrics as Record<string, number | undefined>)?.brier_score;
              const ci = result.confidenceIntervals;
              const hasBrier = typeof bs === 'number';
              const hasCi = ci && Object.keys(ci.metrics ?? {}).length > 0;
              const ciEntry = (key: string): BootstrapCIEntry | undefined =>
                ci?.metrics?.[key] as BootstrapCIEntry | undefined;
              const showStrip = hasBrier || hasCi || result.isCV;
              if (!showStrip) return null;
              return (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {result.isCV && (
                    <span className="rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {result.hasHoldoutTest ? 'holdout' : 'CV moy.'}
                    </span>
                  )}
                  {hasBrier && (
                    <span
                      className="rounded-full border border-blue-400/40 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                      title="Brier score (0 = parfait)"
                    >
                      Brier {bs!.toFixed(3)}
                    </span>
                  )}
                  {hasCi && (['accuracy', 'f1', 'roc_auc'] as const).map((k) => {
                    const e = ciEntry(k);
                    if (!e) return null;
                    const hw = ((e.ci_high - e.ci_low) / 2 * 100).toFixed(1);
                    return (
                      <span
                        key={k}
                        className="rounded-full border border-muted-foreground/30 bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                        title={`IC ${(ci!.ci_level * 100).toFixed(0)}% [${(e.ci_low * 100).toFixed(1)}%–${(e.ci_high * 100).toFixed(1)}%]`}
                      >
                        {k === 'roc_auc' ? 'AUC' : k.toUpperCase()} ±{hw}%
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          {/* Barre train / test */}
          {!result.isCV ? (
            <section aria-label="Scores train et test">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-8 shrink-0">Train</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Train ${toPercent(result.trainScore)}`}>
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${clampPercent(result.trainScore)}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right">{toPercent(result.trainScore)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-8 shrink-0">Test</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Test ${toPercent(result.testScore)}`}>
                  <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${clampPercent(result.testScore)}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right">{toPercent(result.testScore)}</span>
              </div>
            </section>
          ) : (
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Train: —</span>
              <span>{result.hasHoldoutTest ? `Test holdout: ${toPercent(result.testScore)}` : `CV moy.: ${toPercent(result.testScore)}`}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-border/40 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-controls={`details-${result.id}`}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            {expanded ? 'Réduire' : 'Voir les détails'}
          </button>

          {expanded && (
            <div id={`details-${result.id}`}>
              {tabCount === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucun détail disponible.
                </p>
              ) : (
                <Tabs defaultValue={defaultTab} key={result.id} className="space-y-3">
                  <TabsList className={`grid h-8 w-full text-xs ${gridColsClass}`}>
                    {hasAnalyse && (
                      <TabsTrigger value="analyse" className="text-xs">
                        Analyse
                      </TabsTrigger>
                    )}
                    {hasVariables && (
                      <TabsTrigger value="variables" className="text-xs">
                        Variables
                      </TabsTrigger>
                    )}
                    {hasCourbes && (
                      <TabsTrigger value="courbes" className="text-xs">
                        Courbes
                      </TabsTrigger>
                    )}
                    {hasDetails && (
                      <TabsTrigger value="details" className="text-xs">
                        Détails
                      </TabsTrigger>
                    )}
                  </TabsList>
                  {hasAnalyse && (
                    <TabsContent value="analyse" className="mt-0">
                      <ModelCardAnalyseTab
                        result={result}
                        isRegression={isRegression}
                        classView={classView}
                      />
                    </TabsContent>
                  )}
                  {hasVariables && (
                    <TabsContent value="variables" className="mt-0">
                      <ModelCardVariablesTab result={result} featureChartData={featureChartData} />
                    </TabsContent>
                  )}
                  {hasCourbes && (
                    <TabsContent value="courbes" className="mt-0">
                      <ModelCardCourbesTab result={result} />
                    </TabsContent>
                  )}
                  {hasDetails && (
                    <TabsContent value="details" className="mt-0">
                      <ModelCardDetailsTab result={result} />
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              className="flex-1 h-8 text-xs"
              variant={isSaved ? 'secondary' : 'default'}
              disabled={isSaving || isAutomlNonBest}
              onClick={() => onSaveModel(result.id)}
              title={
                isAutomlNonBest
                  ? 'Ce modèle est affiché à titre comparatif uniquement. Seul le meilleur modèle AutoML peut être sauvegardé pour les prédictions.'
                  : undefined
              }
              aria-label={
                isAutomlNonBest
                  ? `${result.modelType.toUpperCase()} — comparaison uniquement, non disponible pour la prédiction`
                  : isSaving
                    ? 'Enregistrement en cours...'
                    : isSaved
                      ? `Retirer ${result.modelType.toUpperCase()} des modèles sauvegardés`
                      : `Sauvegarder ${result.modelType.toUpperCase()} pour les prédictions`
              }
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Enregistrement...
                </>
              ) : isSaved ? (
                <>
                  <BookmarkCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  Sauvegardé
                </>
              ) : (
                <>
                  <Bookmark className="mr-2 h-4 w-4" aria-hidden="true" />
                  Enregistrer
                </>
              )}
            </Button>
            {isActive && (
              <span
                className="shrink-0 flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary"
                aria-label="Ce modèle est le modèle actif"
              >
                <Zap className="h-2.5 w-2.5" aria-hidden="true" /> Actif
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
}

function TechnicalDetails({ result }: { result: ModelResult }) {
  const hasContent =
    result.splitInfo ||
    result.preprocessing ||
    result.balancing ||
    result.thresholding ||
    result.smote;

  if (!hasContent) return null;

  return (
    <details className="group">
      <summary className="list-none cursor-pointer select-none text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded flex items-center gap-1.5">
        <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        Détails techniques
      </summary>

      <div className="mt-2 space-y-1.5 border-l-2 border-border/40 pl-5 text-xs text-muted-foreground">
        {result.splitInfo && (
          <p>
            <span className="font-medium text-foreground">Split :</span>{' '}
            {result.splitInfo.method ?? 'holdout'} · train {result.splitInfo.train_rows ?? 0} · val{' '}
            {result.splitInfo.val_rows ?? 0} · test {result.splitInfo.test_rows ?? 0}
          </p>
        )}
        {result.preprocessing && (
          <p>
            <span className="font-medium text-foreground">Prétraitement :</span>{' '}
            {getPreprocessingSummary(result)}
          </p>
        )}
        {Array.isArray(result.preprocessing?.droppedColumns) &&
          result.preprocessing.droppedColumns.length > 0 && (
            <p>
              <span className="font-medium text-foreground">Colonnes supprimées :</span>{' '}
              {result.preprocessing.droppedColumns.join(', ')}
            </p>
          )}
        {result.balancing && (
          <p>
            <span className="font-medium text-foreground">Balancing :</span>{' '}
            stratégie={String(result.balancing.strategy_applied ?? '—')} · refit=
            {String(result.balancing.refit_metric ?? '—')} · IR=
            {Number(result.balancing.imbalance_ratio ?? Number.NaN).toFixed(2)}
          </p>
        )}
        {result.thresholding && (
          <p>
            <span className="font-medium text-foreground">Seuil :</span>{' '}
            activé={String(Boolean(result.thresholding.enabled))} · stratégie=
            {String(result.thresholding.strategy ?? '—')} · optimal=
            {typeof result.thresholding.optimal_threshold === 'number'
              ? result.thresholding.optimal_threshold.toFixed(3)
              : '—'}
            {typeof result.thresholding.improvement_delta === 'number' && (
              <> · gain F1=
                <span className={result.thresholding.improvement_delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                  {result.thresholding.improvement_delta > 0 ? '+' : ''}
                  {(result.thresholding.improvement_delta * 100).toFixed(1)}%
                </span>
              </>
            )}
            {Array.isArray(result.thresholding.warnings) && result.thresholding.warnings.length > 0 && (
              <> · <span className="text-yellow-600 dark:text-yellow-400">⚠ {result.thresholding.warnings.join(', ')}</span></>
            )}
          </p>
        )}
        {result.smote && (
          <p>
            <span className="font-medium text-foreground">SMOTE (legacy) :</span>{' '}
            {JSON.stringify(result.smote)}
          </p>
        )}
        {result.preprocessing?.effectiveByColumn && (
          <details className="group/inner">
            <summary className="list-none cursor-pointer select-none hover:text-foreground flex items-center gap-1">
              <span
                className="inline-block transition-transform group-open/inner:rotate-90"
                aria-hidden="true"
              >
                ›
              </span>
              effectiveByColumn
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[10px]">
              {JSON.stringify(result.preprocessing.effectiveByColumn, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </details>
  );
}

function ModelCardDetailsTab({ result }: { result: ModelResult }) {
  return (
    <div className="space-y-4">
      {result.automl && (
        <section aria-label="Informations AutoML">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">AutoML — FLAML</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Meilleur modèle trouvé</span>
              <span className="font-medium text-foreground">
                {result.automl.bestEstimator ?? '—'}
              </span>
              <span>Itérations explorées</span>
              <span className="font-medium text-foreground">
                {result.automl.nIterations ?? '—'}
              </span>
              <span>Temps total</span>
              <span className="font-medium text-foreground">
                {result.automl.totalTimeS != null
                  ? `${result.automl.totalTimeS.toFixed(1)}s`
                  : '—'}
                {result.automl.timeBudgetS != null
                  ? ` / ${result.automl.timeBudgetS}s budget`
                  : ''}
              </span>
              <span>Métrique optimisée</span>
              <span className="font-medium text-foreground">
                {result.automl.metricOptimized ?? '—'}
              </span>
            </div>
          </div>
        </section>
      )}
      <TechnicalDetails result={result} />
    </div>
  );
}
