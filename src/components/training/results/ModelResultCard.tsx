import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, ChevronDown, Loader2, Settings2, Zap } from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BootstrapCIEntry, CvFoldResult, CvMetricsSummary, LearningCurveData, MetricType, ModelResult, PermutationImportanceItem, ResidualAnalysisData, ShapGlobalData } from '@/types';
import { CvResultsPanel } from './CvResultsPanel';
import { GridSearchResultsPanel } from './GridSearchResultsPanel';
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

const FI_PALETTE = [
  'hsl(217,91%,60%)',
  'hsl(245,75%,62%)',
  'hsl(265,68%,60%)',
  'hsl(195,78%,52%)',
  'hsl(172,66%,44%)',
  'hsl(145,55%,46%)',
  'hsl(30,90%,55%)',
  'hsl(340,70%,55%)',
];

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

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{result.modelType.toUpperCase()}</CardTitle>
              {isBestModel && <Badge className="bg-amber-500 text-xs text-white">Meilleur</Badge>}
              {isAutomlNonBest && (
                <Badge variant="outline" className="text-xs border-muted-foreground/50 text-muted-foreground">
                  Comparaison uniquement
                </Badge>
              )}
              {result.automl && (
                <Badge variant="outline" className="gap-1 text-xs border-violet-500 text-violet-700 dark:text-violet-400">
                  <Bot className="h-3 w-3" aria-hidden="true" />
                  {result.automl.bestEstimator ?? 'AutoML'}
                </Badge>
              )}
              {isActive && (
                <Badge className="gap-1 text-xs bg-primary text-primary-foreground">
                  <Zap className="h-3 w-3" aria-hidden="true" /> Actif
                </Badge>
              )}
              {!isRegression &&
                classView?.classificationType &&
                classView.classificationType !== 'unknown' && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {classView.classificationType === 'binary'
                      ? 'Binaire'
                      : classView.classificationType === 'multiclass'
                        ? 'Multi-classes'
                        : classView.classificationType}
                  </Badge>
                )}
            </div>
            <Badge
              variant="outline"
              className="shrink-0 text-xs"
              aria-label={`Temps d'entraînement : ${toSeconds(result.trainingTime)}`}
            >
              {toSeconds(result.trainingTime)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <section aria-label="Métriques clés">
            <div className="grid grid-cols-3 gap-2">
              {visibleMetricCards.map((metric) => (
                <div key={metric.key} className="rounded-lg bg-muted/50 p-2.5 text-center">
                  <p className="text-xl font-bold text-primary">{metric.value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
            {result.isCV && (
              <div className="mt-2 flex justify-end">
                <Badge variant="outline" className="text-xs gap-1">
                  {result.hasHoldoutTest ? 'Source : test holdout' : 'Source : moyenne CV'}
                </Badge>
              </div>
            )}

            {/* Brier score + Bootstrap CI strip */}
            {(() => {
              const bs = (result.metrics as Record<string, number | undefined>)?.brier_score;
              const ci = result.confidenceIntervals;
              const hasBrier = typeof bs === 'number';
              const hasCi = ci && Object.keys(ci.metrics ?? {}).length > 0;
              if (!hasBrier && !hasCi) return null;
              const ciEntry = (key: string): BootstrapCIEntry | undefined =>
                ci?.metrics?.[key] as BootstrapCIEntry | undefined;
              return (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hasBrier && (
                    <span
                      className="rounded-full border border-blue-400/40 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                      title="Brier score — mesure la qualité des probabilités prédites (0 = parfait, 1 = mauvais)"
                    >
                      Brier: {bs!.toFixed(3)}
                    </span>
                  )}
                  {(['accuracy', 'f1', 'roc_auc'] as const).map((k) => {
                    const e = ciEntry(k);
                    if (!e) return null;
                    const halfWidth = ((e.ci_high - e.ci_low) / 2 * 100).toFixed(1);
                    return (
                      <span
                        key={k}
                        className="rounded-full border border-muted-foreground/30 bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                        title={`IC ${((ci!.ci_level) * 100).toFixed(0)}% — [${(e.ci_low * 100).toFixed(1)}%, ${(e.ci_high * 100).toFixed(1)}%]`}
                      >
                        {k === 'roc_auc' ? 'AUC' : k.toUpperCase()}&nbsp;±{halfWidth}%
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          {!result.isCV && (
            <section aria-label="Scores train et test">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Train: {toPercent(result.trainScore)}</span>
                  <span>Test: {toPercent(result.testScore)}</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`Score train : ${toPercent(result.trainScore)}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${clampPercent(result.trainScore)}%` }}
                  />
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`Score test : ${toPercent(result.testScore)}`}
                >
                  <div
                    className="h-full rounded-full bg-secondary transition-all"
                    style={{ width: `${clampPercent(result.testScore)}%` }}
                  />
                </div>
              </div>
            </section>
          )}

          {result.isCV && (
            <div className="flex justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
              <span>Train: —</span>
              <span>
                {result.hasHoldoutTest
                  ? `Test holdout: ${toPercent(result.testScore)}`
                  : `CV moyenne: ${toPercent(result.testScore)}`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/50 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-controls={`details-${result.id}`}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            {expanded ? 'Réduire les détails' : 'Voir les détails'}
          </button>

          {expanded && (
            <div id={`details-${result.id}`} className="space-y-5">
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

              {result.isCV && result.cvSummary && (
                <section aria-label="Résultats de validation croisée">
                  <CvResultsPanel
                    cvSummary={result.cvSummary as CvMetricsSummary}
                    cvFoldResults={(result.cvFoldResults ?? []) as CvFoldResult[]}
                    kFolds={result.kFoldsUsed as number | undefined}
                    hasHoldoutTest={result.hasHoldoutTest}
                    cvTestMetrics={result.cvTestMetrics as Record<string, unknown> | null | undefined}
                    cvMeanMetrics={result.cvMeanMetrics as Record<string, number> | null | undefined}
                  />
                </section>
              )}

              {result.gridSearch?.enabled && (
                <section aria-label={result.gridSearch.searchType === 'random' ? 'Résultats RandomizedSearch' : 'Résultats GridSearch'}>
                  <GridSearchResultsPanel
                    gridSearch={result.gridSearch}
                    hyperparams={result.hyperparams ?? undefined}
                  />
                </section>
              )}

              {!isRegression && classView && (
                <section aria-label="Métriques de classification détaillées">
                  <Tabs defaultValue="summary" className="space-y-3">
                    <TabsList className="grid h-8 w-full grid-cols-3 text-xs">
                      <TabsTrigger value="summary" className="text-xs">
                        Résumé
                      </TabsTrigger>
                      <TabsTrigger value="averages" className="text-xs">
                        Moyennes
                      </TabsTrigger>
                      <TabsTrigger value="per_class" className="text-xs">
                        Par classe
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-0 space-y-3">
                      {(classView.balancedAccuracy != null || classView.specificity != null) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-border/60 p-2.5">
                            <p className="text-[11px] text-muted-foreground">Balanced Accuracy</p>
                            <p className="mt-0.5 text-sm font-semibold">
                              {toPercent(classView.balancedAccuracy)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border/60 p-2.5">
                            <p className="text-[11px] text-muted-foreground">Spécificité (TNR)</p>
                            <p className="mt-0.5 text-sm font-semibold">
                              {toPercent(classView.specificity)}
                            </p>
                          </div>
                        </div>
                      )}

                      {classView.confusion.matrix.length >= 2 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">Matrice de confusion</p>
                            <div className="flex items-center gap-3">
                              <LegendDot color="bg-emerald-400/70" label="Correct" />
                              <LegendDot color="bg-red-400/60" label="Erreur" />
                            </div>
                          </div>
                          <div className="overflow-hidden rounded-xl border border-border/40">
                            <table
                              className="w-full border-collapse text-xs"
                              aria-label="Matrice de confusion"
                            >
                              <thead>
                                <tr>
                                  <th
                                    className="border-b border-r border-border/30 bg-muted/40 px-2 py-2 align-bottom"
                                    style={{ minWidth: 52 }}
                                    scope="col"
                                  >
                                    <div className="text-right text-[9px] font-medium leading-snug text-muted-foreground/50">
                                      <div>↓ Réel</div>
                                      <div>Prédit →</div>
                                    </div>
                                  </th>
                                  {classView.confusion.labels.map((label) => (
                                    <th
                                      key={`${result.id}-cm-h-${label}`}
                                      scope="col"
                                      className="border-b border-border/30 bg-muted/40 px-2 py-2.5 text-center font-semibold"
                                      style={{ minWidth: 48 }}
                                    >
                                      {label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {classView.confusion.matrix.map((row, rowIdx) => {
                                  const rowTotal = row.reduce((s, v) => s + v, 0);
                                  return (
                                    <tr
                                      key={`${result.id}-cm-r-${rowIdx}`}
                                      className="border-t border-border/30"
                                    >
                                      <th
                                        scope="row"
                                        className="whitespace-nowrap border-r border-border/30 bg-muted/40 px-2 py-2 text-right text-[11px] font-semibold"
                                      >
                                        {classView.confusion.labels[rowIdx] ?? rowIdx}
                                      </th>
                                      {row.map((value, colIdx) => {
                                        const isDiag = rowIdx === colIdx;
                                        const pct = rowTotal > 0 ? value / rowTotal : 0;
                                        const bg = isDiag
                                          ? `rgba(16,185,129,${Math.max(0.1, pct * 0.65)})`
                                          : value > 0
                                            ? `rgba(239,68,68,${Math.max(0.05, pct * 0.5)})`
                                            : undefined;
                                        return (
                                          <td
                                            key={`${result.id}-cm-c-${rowIdx}-${colIdx}`}
                                            className="border-l border-border/20 p-0 text-center"
                                            style={bg ? { backgroundColor: bg } : undefined}
                                          >
                                            <div className="flex min-h-[40px] flex-col items-center justify-center gap-0.5 px-1 py-2">
                                              <span
                                                className={`text-sm leading-none ${isDiag ? 'font-bold' : value > 0 ? 'font-semibold' : 'text-muted-foreground/40'}`}
                                              >
                                                {value}
                                              </span>
                                              {rowTotal > 0 && value > 0 && (
                                                <span
                                                  className={`text-[9px] font-semibold leading-none ${isDiag ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}
                                                >
                                                  {(pct * 100).toFixed(0)}%
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="averages" className="mt-0">
                      {classView.averages.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full text-sm" aria-label="Métriques moyennées">
                            <thead className="bg-muted/60">
                              <tr>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Moyenne
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Précision
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Rappel
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  F1
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {classView.averages.map((row) => (
                                <tr key={`${result.id}-avg-${row.key}`} className="border-t border-border/60">
                                  <td className="px-3 py-2 font-medium">{row.label}</td>
                                  <td className="px-3 py-2">{toPercent(row.precision)}</td>
                                  <td className="px-3 py-2">{toPercent(row.recall)}</td>
                                  <td className="px-3 py-2">{toPercent(row.f1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="py-2 text-sm text-muted-foreground">Aucune métrique disponible.</p>
                      )}
                    </TabsContent>

                    <TabsContent value="per_class" className="mt-0">
                      {classView.perClass.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border/60">
                          <table className="w-full text-sm" aria-label="Métriques par classe">
                            <thead className="bg-muted/60">
                              <tr>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Classe
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Précision
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Rappel
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  F1
                                </th>
                                <th scope="col" className="px-3 py-2 text-left font-medium">
                                  Support
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {classView.perClass.map((row) => (
                                <tr
                                  key={`${result.id}-pc-${row.label}`}
                                  className="border-t border-border/60"
                                >
                                  <td className="px-3 py-2 font-medium">{row.label}</td>
                                  <td className="px-3 py-2">{toPercent(row.precision)}</td>
                                  <td className="px-3 py-2">{toPercent(row.recall)}</td>
                                  <td className="px-3 py-2">{toPercent(row.f1)}</td>
                                  <td className="px-3 py-2">
                                    {row.support != null ? Math.round(row.support) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="py-2 text-sm text-muted-foreground">
                          Aucune métrique par classe disponible.
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </section>
              )}

              {featureChartData.length > 0 && (
                <section aria-label="Importance des variables">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Importance des variables</p>
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                      Top {featureChartData.length}
                    </span>
                  </div>
                  <div
                    className="rounded-lg border border-border/50 bg-muted/20 p-2"
                    style={{ height: `${Math.min(300, Math.max(160, featureChartData.length * 30 + 40))}px` }}
                    role="img"
                    aria-label={`Graphique d'importance des ${featureChartData.length} variables principales`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={featureChartData}
                        layout="vertical"
                        margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis type="number" domain={[0, 1]} hide />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={112}
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(100,100,100,0.08)' }}
                          contentStyle={{ borderRadius: '8px', fontSize: '12px', padding: '8px 12px' }}
                          formatter={(_value, _name, item) => {
                            const payload = (
                              item as { payload?: { rawImportance?: number; displayImportance?: number } } | undefined
                            )?.payload;
                            const raw = Number(payload?.rawImportance);
                            const disp = Number(payload?.displayImportance);
                            if (!Number.isFinite(raw)) return ['—', 'Importance'];
                            const pct = Number.isFinite(disp) ? ` (${(disp * 100).toFixed(1)}%)` : '';
                            const rawLabel =
                              raw >= 10 ? raw.toFixed(1) : raw >= 1 ? raw.toFixed(3) : raw.toFixed(4);
                            return [`${rawLabel}${pct}`, 'Importance'];
                          }}
                          labelFormatter={(_label, payload) =>
                            String(
                              (
                                Array.isArray(payload)
                                  ? (payload[0] as { payload?: { feature?: string } } | undefined)
                                  : undefined
                              )?.payload?.feature ?? '',
                            )
                          }
                        />
                        <Bar dataKey="normalizedImportance" radius={[0, 4, 4, 0]} maxBarSize={20}>
                          {featureChartData.map((_, idx) => (
                            <Cell key={`fi-cell-${idx}`} fill={FI_PALETTE[idx % FI_PALETTE.length]} />
                          ))}
                          <LabelList
                            dataKey="displayImportance"
                            position="right"
                            formatter={(v: unknown) => {
                              const n = Number(v);
                              return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '';
                            }}
                            style={{ fontSize: '10px', fontWeight: 500 }}
                          />
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {result.curves && (result.curves.roc || result.curves.pr || result.curves.calibration) && (
                <section aria-label="Courbes de diagnostic">
                  <p className="mb-2 text-sm font-medium">Courbes de diagnostic</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {result.curves.roc && (
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground text-center">ROC Curve</p>
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-2" style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={result.curves.roc.map(([fpr, tpr]) => ({ fpr, tpr }))}
                              margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                              <XAxis dataKey="fpr" type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 10 }} label={{ value: 'FPR', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                              <YAxis type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 10 }} label={{ value: 'TPR', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10 }} />
                              <Tooltip formatter={(v: number) => v.toFixed(3)} labelFormatter={(v: number) => `FPR: ${v.toFixed(3)}`} />
                              <ReferenceLine stroke="#6b7280" strokeDasharray="4 4" segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} />
                              <Line type="monotone" dataKey="tpr" stroke="#8b5cf6" dot={false} strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {result.curves.pr && (
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground text-center">Precision-Recall Curve</p>
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-2" style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={result.curves.pr.map(([recall, precision]) => ({ recall, precision }))}
                              margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                              <XAxis dataKey="recall" type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 10 }} label={{ value: 'Recall', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                              <YAxis type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 10 }} label={{ value: 'Precision', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10 }} />
                              <Tooltip formatter={(v: number) => v.toFixed(3)} labelFormatter={(v: number) => `Recall: ${v.toFixed(3)}`} />
                              <Line type="monotone" dataKey="precision" stroke="#06b6d4" dot={false} strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {result.curves.calibration && (
                      <div>
                        <div className="mb-1 flex items-center justify-center gap-2">
                          <p className="text-xs text-muted-foreground text-center">Courbe de calibration</p>
                          <span
                            className="rounded-full border border-emerald-400/50 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            title="Brier score — mesure la calibration (0 = parfait)"
                          >
                            Brier&nbsp;{result.curves.calibration.brier_score.toFixed(3)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-2" style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={result.curves.calibration.points.map(([mp, fp]) => ({ predicted: mp, actual: fp }))}
                              margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                              <XAxis dataKey="predicted" type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 10 }} label={{ value: 'Probabilité prédite', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                              <YAxis type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 10 }} label={{ value: 'Fraction réelle', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10 }} />
                              <Tooltip formatter={(v: number) => v.toFixed(3)} labelFormatter={(v: number) => `Prédit: ${v.toFixed(3)}`} />
                              <ReferenceLine stroke="#9ca3af" strokeDasharray="4 4" segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} />
                              <Line type="monotone" dataKey="actual" stroke="#10b981" dot={{ r: 3, fill: '#10b981' }} strokeWidth={2} name="Modèle" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {result.learningCurves && (() => {
                const lc: LearningCurveData = result.learningCurves!;
                const lcData = lc.train_sizes.map((s, i) => ({
                  samples: s,
                  train: lc.train_mean[i],
                  val: lc.val_mean[i],
                }));
                const scoringLabel = lc.scoring === 'r2' ? 'R²' : lc.scoring.replace('neg_', '-').replace('_', ' ').toUpperCase();
                return (
                  <section aria-label="Courbes d'apprentissage">
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-sm font-medium">Courbes d&apos;apprentissage</p>
                      <span className="text-[11px] text-muted-foreground">({scoringLabel})</span>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Montre si le modèle bénéficierait de plus de données. Un écart important train/val indique du surapprentissage.
                    </p>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2" style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lcData} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                          <XAxis dataKey="samples" tick={{ fontSize: 10 }} label={{ value: 'Échantillons', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(2)} />
                          <Tooltip
                            formatter={(v: number, name: string) => [v?.toFixed(3) ?? '—', name === 'train' ? 'Entraînement' : 'Validation']}
                            labelFormatter={(v: number) => `${v} échantillons`}
                          />
                          <Line type="monotone" dataKey="train" stroke="#8b5cf6" dot={false} strokeWidth={2} name="train" />
                          <Line type="monotone" dataKey="val" stroke="#06b6d4" dot={false} strokeWidth={2} strokeDasharray="5 3" name="val" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1 flex gap-3 justify-center">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="inline-block h-0.5 w-4 rounded bg-violet-500" /> Entraînement
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="inline-block h-0.5 w-4 rounded bg-cyan-500 opacity-70 border-dashed" style={{ borderTop: '2px dashed' }} /> Validation
                      </span>
                    </div>
                  </section>
                );
              })()}

              {result.permutationImportance && result.permutationImportance.length > 0 && (() => {
                const pi: PermutationImportanceItem[] = result.permutationImportance!;
                const maxMean = Math.max(...pi.map((d) => Math.abs(d.mean)), 1e-9);
                return (
                  <section aria-label="Importance par permutation">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Importance par permutation</p>
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                        Top {pi.length}
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Mesure la chute de performance quand une variable est mélangée aléatoirement (test set). Valeur négative = variable peu utile ou bruitée.
                    </p>
                    <div
                      className="rounded-lg border border-border/50 bg-muted/20 p-2"
                      style={{ height: `${Math.min(320, Math.max(160, pi.length * 28 + 40))}px` }}
                      role="img"
                      aria-label={`Graphique d'importance par permutation — ${pi.length} variables`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={pi.map((d) => ({
                            label: d.feature.length > 18 ? `${d.feature.slice(0, 16)}…` : d.feature,
                            feature: d.feature,
                            importance: d.mean,
                            normalizedImportance: d.mean / maxMean,
                          }))}
                          layout="vertical"
                          margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128,128,128,0.15)" />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="label" width={116} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={{ fill: 'rgba(100,100,100,0.08)' }}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', padding: '8px 12px' }}
                            formatter={(_v: unknown, _n: string, item: { payload?: { importance?: number } }) => {
                              const v = item?.payload?.importance;
                              if (v == null) return ['—', 'Importance'];
                              return [v.toFixed(4), 'Chute de score'];
                            }}
                            labelFormatter={(_l: unknown, payload: unknown[]) => {
                              const p = (payload?.[0] as { payload?: { feature?: string } })?.payload;
                              return String(p?.feature ?? '');
                            }}
                          />
                          <Bar dataKey="normalizedImportance" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {pi.map((d, idx) => (
                              <Cell
                                key={`pi-cell-${idx}`}
                                fill={d.mean < 0 ? 'hsl(0,70%,55%)' : FI_PALETTE[idx % FI_PALETTE.length]}
                              />
                            ))}
                            <LabelList
                              dataKey="importance"
                              position="right"
                              formatter={(v: unknown) => {
                                const n = Number(v);
                                return Number.isFinite(n) ? n.toFixed(3) : '';
                              }}
                              style={{ fontSize: '10px', fontWeight: 500 }}
                            />
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                );
              })()}

              {result.shapGlobal && result.shapGlobal.summary.length > 0 && (() => {
                const sg: ShapGlobalData = result.shapGlobal!;
                const maxAbs = Math.max(...sg.summary.map((d) => d.mean_abs_shap), 1e-9);
                const explainerLabel: Record<string, string> = {
                  tree: 'TreeSHAP',
                  linear: 'LinearSHAP',
                  kernel: 'KernelSHAP',
                };
                return (
                  <section aria-label="SHAP — importance globale">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">SHAP — Importance globale</p>
                        <span className="rounded-full border border-violet-400/40 bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                          {explainerLabel[sg.explainer_type] ?? sg.explainer_type}
                        </span>
                      </div>
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                        Top {sg.summary.length} · n={sg.n_samples}
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Contribution moyenne de chaque variable à la prédiction (valeur absolue). La couleur indique la direction&nbsp;: bleu&nbsp;=&nbsp;pousse vers le bas, orange&nbsp;=&nbsp;pousse vers le haut.
                    </p>
                    <div
                      className="rounded-lg border border-border/50 bg-muted/20 p-2"
                      style={{ height: `${Math.min(340, Math.max(180, sg.summary.length * 28 + 40))}px` }}
                      role="img"
                      aria-label={`SHAP global — ${sg.summary.length} variables`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={sg.summary.map((d) => ({
                            label: d.feature.length > 18 ? `${d.feature.slice(0, 16)}…` : d.feature,
                            feature: d.feature,
                            mean_abs_shap: d.mean_abs_shap,
                            mean_shap: d.mean_shap,
                            normalized: d.mean_abs_shap / maxAbs,
                          }))}
                          layout="vertical"
                          margin={{ top: 4, right: 64, left: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128,128,128,0.15)" />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="label" width={116} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={{ fill: 'rgba(100,100,100,0.08)' }}
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', padding: '8px 12px' }}
                            formatter={(_v: unknown, _n: string, item: { payload?: { mean_abs_shap?: number; mean_shap?: number } }) => {
                              const abs = item?.payload?.mean_abs_shap;
                              const signed = item?.payload?.mean_shap;
                              if (abs == null) return ['—', 'SHAP'];
                              return [`|SHAP|=${abs.toFixed(4)}  (μ=${signed != null ? signed.toFixed(4) : '—'})`, 'Importance'];
                            }}
                            labelFormatter={(_l: unknown, payload: unknown[]) =>
                              String((payload?.[0] as { payload?: { feature?: string } })?.payload?.feature ?? '')
                            }
                          />
                          <Bar dataKey="normalized" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {sg.summary.map((d, idx) => (
                              <Cell
                                key={`shap-cell-${idx}`}
                                fill={d.mean_shap < 0 ? 'hsl(217,91%,60%)' : 'hsl(30,90%,55%)'}
                              />
                            ))}
                            <LabelList
                              dataKey="mean_abs_shap"
                              position="right"
                              formatter={(v: unknown) => {
                                const n = Number(v);
                                return Number.isFinite(n) ? n.toFixed(3) : '';
                              }}
                              style={{ fontSize: '10px', fontWeight: 500 }}
                            />
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1 flex gap-3 justify-center">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(30,90%,55%)]" /> Pousse vers le haut
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(217,91%,60%)]" /> Pousse vers le bas
                      </span>
                    </div>
                  </section>
                );
              })()}

              {result.residualAnalysis && (() => {
                const ra: ResidualAnalysisData = result.residualAnalysis!;
                const histData = ra.histogram.counts.map((count, i) => ({
                  x: ((ra.histogram.bin_edges[i] + ra.histogram.bin_edges[i + 1]) / 2),
                  count,
                }));
                const qqData = ra.qq_points.map(([t, s]) => ({ theoretical: t, sample: s }));
                return (
                  <section aria-label="Analyse des résidus">
                    <p className="mb-1 text-sm font-medium">Analyse des résidus</p>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Diagnostics sur les erreurs du modèle (test set). Idéalement : distribution symétrique centrée en 0, Q-Q aligné sur la diagonale.
                    </p>
                    <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-muted-foreground" title="Biais moyen du modèle (idéal : ≈ 0)">
                        Moyenne résidu&nbsp;: {ra.stats.mean.toFixed(4)}
                      </span>
                      <span className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-muted-foreground" title="Asymétrie de la distribution des résidus (idéal : ≈ 0)">
                        Skewness&nbsp;: {ra.stats.skewness.toFixed(3)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 ${Math.abs(ra.stats.correlation_with_pred) > 0.2 ? 'border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'border-border/50 bg-muted/60 text-muted-foreground'}`}
                        title="Corrélation résidus / prédictions (idéal : ≈ 0 — sinon pattern systématique)"
                      >
                        Corr. pred&nbsp;: {ra.stats.correlation_with_pred.toFixed(3)}
                      </span>
                      <span className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-muted-foreground">
                        n&nbsp;=&nbsp;{ra.n_samples}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground text-center">Distribution des résidus</p>
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-2" style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={histData} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                              <XAxis dataKey="x" tick={{ fontSize: 9 }} tickFormatter={(v: number) => v.toFixed(1)} label={{ value: 'Résidu', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 9 }} />
                              <Tooltip formatter={(v: number) => [v, 'Effectif']} labelFormatter={(v: number) => `Centre: ${Number(v).toFixed(3)}`} />
                              <Bar dataKey="count" fill="hsl(217,91%,60%)" radius={[2, 2, 0, 0]} maxBarSize={24} />
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground text-center">Q-Q Plot (normalité)</p>
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-2" style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={qqData} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                              <XAxis dataKey="theoretical" type="number" tick={{ fontSize: 9 }} tickFormatter={(v: number) => v.toFixed(1)} label={{ value: 'Quantile théorique', position: 'insideBottom', offset: -4, fontSize: 10 }} />
                              <YAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v: number) => v.toFixed(1)} label={{ value: 'Résidu', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10 }} />
                              <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={(v: number) => `Z théorique: ${Number(v).toFixed(3)}`} />
                              <ReferenceLine
                                stroke="#9ca3af"
                                strokeDasharray="4 4"
                                segment={[
                                  { x: qqData[0]?.theoretical ?? -3, y: qqData[0]?.sample ?? -3 },
                                  { x: qqData[qqData.length - 1]?.theoretical ?? 3, y: qqData[qqData.length - 1]?.sample ?? 3 },
                                ]}
                              />
                              <Line type="monotone" dataKey="sample" stroke="#f59e0b" dot={{ r: 2, fill: '#f59e0b' }} strokeWidth={0} name="Résidus" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })()}

              <TechnicalDetails result={result} />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              className="flex-1"
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
                className="shrink-0 rounded border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary flex items-center gap-1"
                aria-label="Ce modèle est le modèle actif"
              >
                <Zap className="h-3 w-3" aria-hidden="true" /> Actif
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <div className={`h-2.5 w-2.5 rounded-sm ${color}`} aria-hidden="true" />
      {label}
    </div>
  );
}
