import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Save, Layers, Target, Zap } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ModelResult, CvFoldResult, CvMetricsSummary } from '@/types';
import {
  buildClassificationView,
  buildFeatureImportanceChartData,
  clampPercent,
  getPreprocessingSummary,
  humanizeWarning,
  metricLabels,
  modelColors,
  toPercent,
  toNumber,
  toSeconds,
} from './trainingResultsHelpers';

interface ModelResultCardProps {
  result: ModelResult;
  index: number;
  isBestModel: boolean;
  isRegression: boolean;
  isActive?: boolean;
  onSaveModel: (modelId: string) => void;
}

export function ModelResultCard({ result, index, isBestModel, isRegression, isActive = false, onSaveModel }: ModelResultCardProps) {
  const color = modelColors[result.modelType] ?? 'from-slate-500 to-slate-600';
  const featureChartData = buildFeatureImportanceChartData(result);
  const classView = isRegression ? null : buildClassificationView(result);
  const isBinary = classView?.classificationType === 'binary';
  const aucMissing = !isRegression && classView?.rocAuc == null;

  const metricCards = isRegression
    ? [
        { key: 'r2', label: metricLabels.r2, value: toNumber(result.metrics?.r2) },
        { key: 'rmse', label: metricLabels.rmse, value: toNumber(result.metrics?.rmse) },
        { key: 'mae', label: metricLabels.mae, value: toNumber(result.metrics?.mae) },
      ]
    : [
        { key: 'accuracy', label: metricLabels.accuracy, value: toPercent(classView?.accuracy) },
        { key: 'roc_auc', label: metricLabels.roc_auc, value: toPercent(classView?.rocAuc) },
        { key: 'pr_auc', label: metricLabels.pr_auc, value: toPercent(classView?.prAuc) },
        {
          key: 'precision_main',
          label: isBinary ? `Precision (+${classView?.positiveLabel ?? ''})` : 'Precision (macro)',
          value: toPercent(classView?.precisionMain),
        },
        {
          key: 'recall_main',
          label: isBinary ? `Recall (+${classView?.positiveLabel ?? ''})` : 'Recall (macro)',
          value: toPercent(classView?.recallMain),
        },
        {
          key: 'f1_main',
          label: isBinary ? `F1 (+${classView?.positiveLabel ?? ''})` : 'F1 (macro)',
          value: toPercent(classView?.f1Main),
        },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
    >
      <Card className="overflow-hidden h-full">
        <div className={`h-2 bg-gradient-to-r ${color}`} />
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              {result.modelType.toUpperCase()}
              {isActive && (
                <Badge className="bg-primary text-primary-foreground gap-1">
                  <Zap className="h-3 w-3" /> Modèle actif
                </Badge>
              )}
              {isBestModel && <Badge className="bg-warning text-warning-foreground">Meilleur</Badge>}
              {!isRegression && classView?.classificationType && classView.classificationType !== 'unknown' && (
                <Badge variant="outline">{classView.classificationType}</Badge>
              )}
              {aucMissing && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  AUC indisponible
                </Badge>
              )}
            </CardTitle>
            <Badge variant="outline">{toSeconds(result.trainingTime)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {metricCards.map((metric) => (
              <div key={metric.key} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Train: {result.isCV ? '—' : toPercent(result.trainScore)}</span>
              <span>
                {result.isCV
                  ? result.hasHoldoutTest
                    ? `Test holdout: ${toPercent(result.testScore)}`
                    : `CV Mean: ${toPercent(result.testScore)}`
                  : `Test: ${toPercent(result.testScore)}`}
              </span>
            </div>
            {!result.isCV && (
              <>
                <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-primary h-full" style={{ width: `${clampPercent(result.trainScore)}%` }} />
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden flex mt-1">
                  <div className="bg-secondary h-full" style={{ width: `${clampPercent(result.testScore)}%` }} />
                </div>
              </>
            )}
          </div>

          {/* CV fold results panel */}
          {result.isCV && result.cvSummary && (
            <CvResultsPanel
              cvSummary={result.cvSummary as CvMetricsSummary}
              cvFoldResults={(result.cvFoldResults ?? []) as CvFoldResult[]}
              kFolds={result.kFoldsUsed as number | undefined}
              hasHoldoutTest={result.hasHoldoutTest}
              cvTestMetrics={result.cvTestMetrics as Record<string, unknown> | null | undefined}
              cvMeanMetrics={result.cvMeanMetrics as Record<string, number> | null | undefined}
            />
          )}

          {!isRegression && classView && (
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="averages">Averages</TabsTrigger>
                <TabsTrigger value="per_class">Per-class</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {classView.warnings.includes('dataset_is_already_balanced') && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-xs flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{humanizeWarning('dataset_is_already_balanced')}</span>
                  </div>
                )}

                {!!classView.warnings.filter((w) => w !== 'dataset_is_already_balanced').length && (
                  <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 text-xs text-amber-900">
                    <p className="font-medium mb-1">Avertissements</p>
                    <ul className="space-y-1">
                      {classView.warnings
                        .filter((w) => w !== 'dataset_is_already_balanced')
                        .map((warning, idx) => (
                          <li key={`${result.id}-w-${idx}`} className="flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{humanizeWarning(warning)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {(classView.balancedAccuracy != null || classView.specificity != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">Balanced Accuracy</p>
                      <p className="text-sm font-semibold">{toPercent(classView.balancedAccuracy)}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">Specificity (TNR)</p>
                      <p className="text-sm font-semibold">{toPercent(classView.specificity)}</p>
                    </div>
                  </div>
                )}

                {!!classView.confusion.matrix.length && (
                  <div>
                    <p className="text-sm font-medium mb-2">Matrice de confusion</p>
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">True \\ Pred</th>
                            {classView.confusion.labels.map((label) => (
                              <th key={`${result.id}-cm-h-${label}`} className="px-3 py-2 text-left font-medium">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {classView.confusion.matrix.map((row, rowIndex) => (
                            <tr key={`${result.id}-cm-r-${rowIndex}`} className="border-t border-border/60">
                              <td className="px-3 py-2 font-medium">{classView.confusion.labels[rowIndex] ?? rowIndex}</td>
                              {row.map((value, colIndex) => (
                                <td key={`${result.id}-cm-c-${rowIndex}-${colIndex}`} className="px-3 py-2">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="averages">
                {!!classView.averages.length ? (
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Average</th>
                          <th className="px-3 py-2 text-left font-medium">Precision</th>
                          <th className="px-3 py-2 text-left font-medium">Recall</th>
                          <th className="px-3 py-2 text-left font-medium">F1</th>
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
                  <p className="text-sm text-muted-foreground">Aucune metrique average disponible.</p>
                )}
              </TabsContent>

              <TabsContent value="per_class">
                {!!classView.perClass.length ? (
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Classe</th>
                          <th className="px-3 py-2 text-left font-medium">Precision</th>
                          <th className="px-3 py-2 text-left font-medium">Recall</th>
                          <th className="px-3 py-2 text-left font-medium">F1</th>
                          <th className="px-3 py-2 text-left font-medium">Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classView.perClass.map((row) => (
                          <tr key={`${result.id}-pc-${row.label}`} className="border-t border-border/60">
                            <td className="px-3 py-2 font-medium">{row.label}</td>
                            <td className="px-3 py-2">{toPercent(row.precision)}</td>
                            <td className="px-3 py-2">{toPercent(row.recall)}</td>
                            <td className="px-3 py-2">{toPercent(row.f1)}</td>
                            <td className="px-3 py-2">{row.support != null ? Math.round(row.support) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune metrique par classe disponible.</p>
                )}
              </TabsContent>
            </Tabs>
          )}

          {!!featureChartData.length && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Importance des features</p>
                <span className="text-xs text-muted-foreground">Top {featureChartData.length}</span>
              </div>
              <div className="h-56 rounded-lg border border-border/50 bg-muted/20 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={featureChartData}
                    layout="vertical"
                    margin={{ top: 6, right: 8, left: 8, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 1]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                    />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, _name, item) => [
                        Number(
                          (item as { payload?: { rawImportance?: number } } | undefined)?.payload?.rawImportance ?? value
                        ).toFixed(4),
                        'Importance',
                      ]}
                      labelFormatter={(_label, payload) =>
                        String(
                          (Array.isArray(payload)
                            ? (payload[0] as { payload?: { feature?: string } } | undefined)
                            : undefined
                          )?.payload?.feature ?? ''
                        )
                      }
                    />
                    <Bar dataKey="normalizedImportance" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="space-y-1 text-xs text-muted-foreground">
            {result.splitInfo && (
              <p>
                Split: {result.splitInfo.method || 'holdout'} | train {result.splitInfo.train_rows ?? 0} |
                val {result.splitInfo.val_rows ?? 0} | test {result.splitInfo.test_rows ?? 0}
              </p>
            )}
            {!!result.preprocessing && <p>Preprocessing: {getPreprocessingSummary(result)}</p>}
            {Array.isArray((result.preprocessing as any)?.droppedColumns) &&
              (result.preprocessing as any).droppedColumns.length > 0 && (
                <p>Dropped columns: {(result.preprocessing as any).droppedColumns.join(', ')}</p>
              )}
            {!!result.balancing && (
              <p>
                Balancing: strategy={String((result.balancing as any)?.strategy_applied ?? "-")} |
                refit={String((result.balancing as any)?.refit_metric ?? "-")} |
                IR={Number((result.balancing as any)?.imbalance_ratio ?? NaN).toFixed(2)}
              </p>
            )}
            {!!result.thresholding && (
              <p>
                Threshold: enabled={String(Boolean((result.thresholding as any)?.enabled))} |
                strategy={String((result.thresholding as any)?.strategy ?? "-")} |
                optimal={String((result.thresholding as any)?.optimal_threshold ?? "-")}
              </p>
            )}
            {!!result.smote && <p>SMOTE (legacy): {JSON.stringify(result.smote)}</p>}
            {!!(result.preprocessing as any)?.effectiveByColumn && (
              <details>
                <summary className="cursor-pointer">effectiveByColumn</summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                  {JSON.stringify((result.preprocessing as any).effectiveByColumn, null, 2)}
                </pre>
              </details>
            )}
          </div>

          <Button
            className="w-full"
            variant={isActive ? 'secondary' : 'default'}
            onClick={() => onSaveModel(result.id)}
          >
            {isActive ? (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Modèle actif
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer &amp; activer
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── CV Results Panel ─────────────────────────────────────────────────────────

function fmtMetric(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return '—';
  // Values ≤ 1 are usually ratios (accuracy, f1…) → show as %
  return Math.abs(v) <= 1.5 ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
}

interface CvResultsPanelProps {
  cvSummary: CvMetricsSummary;
  cvFoldResults: CvFoldResult[];
  kFolds?: number;
  hasHoldoutTest?: boolean;
  cvTestMetrics?: Record<string, unknown> | null;
  cvMeanMetrics?: Record<string, number> | null;
}

function _flattenMetrics(m: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  const _SKIP = new Set(['warnings', 'meta', 'confusion_matrix', 'per_class', 'averaged', 'binary', 'global', 'legacy_flat']);
  const lf = m['legacy_flat'] as Record<string, unknown> | undefined;
  const gl = m['global'] as Record<string, unknown> | undefined;
  if (lf) Object.entries(lf).forEach(([k, v]) => { if (typeof v === 'number' && !isNaN(v)) out[k] = v; });
  if (gl) Object.entries(gl).forEach(([k, v]) => { if (typeof v === 'number' && !isNaN(v) && !(k in out)) out[k] = v; });
  Object.entries(m).forEach(([k, v]) => { if (!_SKIP.has(k) && typeof v === 'number' && !isNaN(v) && !(k in out)) out[k] = v; });
  return out;
}

function CvResultsPanel({ cvSummary, cvFoldResults, kFolds, hasHoldoutTest, cvTestMetrics }: CvResultsPanelProps) {
  const meanEntries = Object.entries(cvSummary.mean ?? {}).filter(
    ([k]) => !['training_time_sec'].includes(k)
  );
  const successFolds = cvFoldResults.filter((f) => f.status === 'ok');
  const failedFolds = cvFoldResults.filter((f) => f.status !== 'ok');

  // Pick top metrics for the per-fold table (max 4)
  const topMetricKeys = meanEntries
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k]) => k);

  // Flatten holdout test metrics for display
  const testFlatEntries = cvTestMetrics
    ? Object.entries(_flattenMetrics(cvTestMetrics as Record<string, unknown>)).filter(([k]) => !['training_time_sec'].includes(k))
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          Résultats Cross-Validation ({kFolds ?? cvFoldResults.length} folds)
        </span>
        <Badge variant="default" className="text-xs">CV</Badge>
        {hasHoldoutTest && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Target className="h-3 w-3" />
            Test holdout séparé
          </Badge>
        )}
        {failedFolds.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {failedFolds.length} fold(s) échoué(s)
          </Badge>
        )}
      </div>

      {/* Holdout test final score — shown prominently when available */}
      {hasHoldoutTest && testFlatEntries.length > 0 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Score Test Holdout Final
            </span>
            <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-400">
              Évaluation indépendante
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {testFlatEntries.slice(0, 6).map(([k, v]) => (
              <div key={k} className="text-center rounded-md bg-emerald-100/60 dark:bg-emerald-900/30 p-2">
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{fmtMetric(v)}</p>
                <p className="text-xs text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CV Mean / Std summary */}
      {meanEntries.length > 0 && (
        <div>
          {hasHoldoutTest && (
            <p className="text-xs text-muted-foreground mb-1 font-medium">
              Métriques CV (validation croisée sur données non-test)
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Métrique</th>
                  <th className="px-3 py-2 text-left font-medium">Moyenne</th>
                  <th className="px-3 py-2 text-left font-medium">Std</th>
                  <th className="px-3 py-2 text-left font-medium">Min</th>
                  <th className="px-3 py-2 text-left font-medium">Max</th>
                </tr>
              </thead>
              <tbody>
                {meanEntries.map(([key, meanVal]) => (
                  <tr key={key} className="border-t border-border/60">
                    <td className="px-3 py-2 font-medium text-xs">{key}</td>
                    <td className="px-3 py-2 font-semibold text-primary">
                      {fmtMetric(meanVal)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      ±{fmtMetric(cvSummary.std?.[key])}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {fmtMetric(cvSummary.min?.[key])}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {fmtMetric(cvSummary.max?.[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-fold table */}
      {successFolds.length > 0 && topMetricKeys.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Détails par fold ({successFolds.length} folds réussis)
          </summary>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Fold</th>
                  <th className="px-2 py-2 text-left font-medium">Train</th>
                  <th className="px-2 py-2 text-left font-medium">Val</th>
                  <th className="px-2 py-2 text-left font-medium">Balancing</th>
                  {topMetricKeys.map((k) => (
                    <th key={k} className="px-2 py-2 text-left font-medium">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cvFoldResults.map((fr) => {
                  const flat: Record<string, number | null | unknown> = {};
                  if (fr.metrics && typeof fr.metrics === 'object') {
                    const m = fr.metrics as Record<string, unknown>;
                    const lf = m['legacy_flat'] as Record<string, unknown> | undefined;
                    const gl = m['global'] as Record<string, unknown> | undefined;
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

      <p className="text-xs text-muted-foreground italic">
        {hasHoldoutTest
          ? "Modèle sauvegardé = refit sur les données non-test. Le score test holdout est l'évaluation finale indépendante."
          : "Modèle sauvegardé = refit final sur toutes les données. Les métriques CV ci-dessus sont l'estimation honnête de généralisation."}
      </p>
    </div>
  );
}
