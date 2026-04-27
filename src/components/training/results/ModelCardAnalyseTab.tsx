import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ModelResultDetail, ResidualAnalysisData } from '@/types';
import { CvResultsPanel } from './CvResultsPanel';
import { GridSearchResultsPanel } from './GridSearchResultsPanel';
import type { ClassificationView } from './trainingResultsHelpers';
import { humanizeWarning, toPercent } from './trainingResultsHelpers';

interface ModelCardAnalyseTabProps {
  result: ModelResultDetail;
  isRegression: boolean;
  classView: ClassificationView | null;
}

export function ModelCardAnalyseTab({ result, isRegression, classView }: ModelCardAnalyseTabProps) {
  const cv = result.analysis.crossValidation;
  const gs = result.analysis.gridSearch;

  const allWarnings = [
    ...(Array.isArray(result.analysis?.metricsWarnings) ? result.analysis.metricsWarnings : []),
    ...(Array.isArray(classView?.warnings) ? classView.warnings : []),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  return (
    <div className="space-y-4">
      {allWarnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {allWarnings.map((w) => (
            <p key={w} className="rounded-md border border-amber-300/60 bg-amber-50/60 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-300">
              ⚠ {humanizeWarning(w)}
            </p>
          ))}
        </div>
      )}

      {result.isCV && cv?.cvSummary && (
        <section aria-label="Résultats de validation croisée">
          <CvResultsPanel
            cvSummary={cv.cvSummary}
            cvFoldResults={cv.cvFoldResults ?? []}
            kFolds={cv.kFoldsUsed ?? undefined}
            hasHoldoutTest={result.hasHoldoutTest}
            cvTestMetrics={cv.cvTestMetrics}
            cvMeanMetrics={cv.cvMeanMetrics as Record<string, number> | null | undefined}
          />
        </section>
      )}

      {gs?.enabled && (
        <section
          aria-label={
            gs.searchType === 'random'
              ? 'Résultats RandomizedSearch'
              : 'Résultats GridSearch'
          }
        >
          <GridSearchResultsPanel
            gridSearch={gs}
            hyperparams={result.hyperparams ?? undefined}
          />
        </section>
      )}

      {!isRegression && classView && (
        <section aria-label="Métriques de classification détaillées">
          <Tabs defaultValue="summary" className="space-y-2">
            <TabsList className="grid h-7 w-full grid-cols-3 text-xs">
              <TabsTrigger value="summary" className="text-xs">Résumé</TabsTrigger>
              <TabsTrigger value="averages" className="text-xs">Moyennes</TabsTrigger>
              <TabsTrigger value="per_class" className="text-xs">Par classe</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-0 space-y-2">
              {(classView.balancedAccuracy != null || classView.specificity != null) && (
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-md border border-border/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Balanced Accuracy</p>
                    <p className="text-sm font-semibold">{toPercent(classView.balancedAccuracy)}</p>
                  </div>
                  <div
                    className="cursor-help rounded-md border border-border/60 px-2.5 py-1.5"
                    title="Taux de vrais négatifs (TNR). Proportion de cas négatifs correctement identifiés comme tels. Élevé = peu de fausses alarmes."
                  >
                    <p className="text-[10px] text-muted-foreground">Spécificité (TNR)</p>
                    <p className="text-sm font-semibold">{toPercent(classView.specificity)}</p>
                  </div>
                </div>
              )}

              {classView.confusion.matrix.length >= 2 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">Matrice de confusion</p>
                    <div className="flex items-center gap-2">
                      <LegendDot color="bg-emerald-400/70" label="Correct" />
                      <LegendDot color="bg-red-400/60" label="Erreur" />
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border/40">
                    <table className="w-full border-collapse text-xs" aria-label="Matrice de confusion">
                      <thead>
                        <tr>
                          <th
                            className="border-b border-r border-border/30 bg-muted/40 px-1.5 py-1 align-bottom"
                            style={{ minWidth: 44 }}
                            scope="col"
                          >
                            <div className="text-right text-[8px] font-medium leading-snug text-muted-foreground/50">
                              <div>↓Réel</div>
                              <div>Prédit→</div>
                            </div>
                          </th>
                          {classView.confusion.labels.map((label) => (
                            <th
                              key={`${result.id}-cm-h-${label}`}
                              scope="col"
                              className="border-b border-border/30 bg-muted/40 px-1.5 py-1.5 text-center font-semibold"
                              style={{ minWidth: 40 }}
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
                            <tr key={`${result.id}-cm-r-${rowIdx}`} className="border-t border-border/30">
                              <th
                                scope="row"
                                className="whitespace-nowrap border-r border-border/30 bg-muted/40 px-1.5 py-1 text-right text-[10px] font-semibold"
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
                                    <div className="flex min-h-[30px] flex-col items-center justify-center gap-0 px-1 py-1">
                                      <span className={`text-xs leading-none ${isDiag ? 'font-bold' : value > 0 ? 'font-semibold' : 'text-muted-foreground/40'}`}>
                                        {value}
                                      </span>
                                      {rowTotal > 0 && value > 0 && (
                                        <span className={`text-[8px] font-semibold leading-none ${isDiag ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
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
                  <table className="w-full text-xs" aria-label="Métriques moyennées">
                    <thead className="bg-muted/60">
                      <tr>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Moyenne</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Précision</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Rappel</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">F1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classView.averages.map((row) => (
                        <tr key={`${result.id}-avg-${row.key}`} className="border-t border-border/60">
                          <td className="px-2.5 py-1.5 font-medium">{row.label}</td>
                          <td className="px-2.5 py-1.5">{toPercent(row.precision)}</td>
                          <td className="px-2.5 py-1.5">{toPercent(row.recall)}</td>
                          <td className="px-2.5 py-1.5">{toPercent(row.f1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-2 text-xs text-muted-foreground">Aucune métrique disponible.</p>
              )}
            </TabsContent>

            <TabsContent value="per_class" className="mt-0">
              {classView.perClass.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-xs" aria-label="Métriques par classe">
                    <thead className="bg-muted/60">
                      <tr>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Classe</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Précision</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Rappel</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">F1</th>
                        <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classView.perClass.map((row) => (
                        <tr key={`${result.id}-pc-${row.label}`} className="border-t border-border/60">
                          <td className="px-2.5 py-1.5 font-medium">{row.label}</td>
                          <td className="px-2.5 py-1.5">{toPercent(row.precision)}</td>
                          <td className="px-2.5 py-1.5">{toPercent(row.recall)}</td>
                          <td className="px-2.5 py-1.5">{toPercent(row.f1)}</td>
                          <td className="px-2.5 py-1.5">{row.support != null ? Math.round(row.support) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-2 text-xs text-muted-foreground">Aucune métrique par classe disponible.</p>
              )}
            </TabsContent>
          </Tabs>
        </section>
      )}

      {isRegression && !result.analysis.residualAnalysis && (
        (() => {
          const w = result.analysis.artifactWarnings?.find((a) => a.artifact === 'residual_analysis');
          return w ? (
            <ArtifactUnavailable label="Analyse des résidus" reason={`${w.error} : ${w.detail}`} />
          ) : null;
        })()
      )}

      {isRegression &&
        result.analysis.residualAnalysis &&
        (() => {
          const ra = result.analysis.residualAnalysis as ResidualAnalysisData;
          const histData = ra.histogram.counts.map((count, i) => ({
            x: (ra.histogram.bin_edges[i] + ra.histogram.bin_edges[i + 1]) / 2,
            count,
          }));
          const qqData = ra.qq_points.map(([t, s]) => ({ theoretical: t, sample: s }));
          return (
            <section aria-label="Analyse des résidus">
              <p className="mb-1.5 text-xs font-medium">Analyse des résidus</p>
              <div className="mb-1.5 flex flex-wrap gap-1 text-[10px]">
                <span
                  className="rounded-full border border-border/50 bg-muted/60 px-1.5 py-0.5 text-muted-foreground"
                  title="Biais moyen du modèle (idéal : ≈ 0)"
                >
                  Moyenne résidu&nbsp;: {ra.stats.mean.toFixed(4)}
                </span>
                <span
                  className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-muted-foreground"
                  title="Asymétrie de la distribution des résidus (idéal : ≈ 0)"
                >
                  Skewness&nbsp;: {ra.stats.skewness.toFixed(3)}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    Math.abs(ra.stats.correlation_with_pred) > 0.2
                      ? 'border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'border-border/50 bg-muted/60 text-muted-foreground'
                  }`}
                  title="Corrélation résidus / prédictions (idéal : ≈ 0 — sinon pattern systématique)"
                >
                  Corr. pred&nbsp;: {ra.stats.correlation_with_pred.toFixed(3)}
                </span>
                <span className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-muted-foreground">
                  n&nbsp;=&nbsp;{ra.n_samples}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-center text-[10px] text-muted-foreground">Distribution des résidus</p>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-1.5" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={histData}
                        margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis
                          dataKey="x"
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v: number) => v.toFixed(1)}
                          label={{
                            value: 'Résidu',
                            position: 'insideBottom',
                            offset: -4,
                            fontSize: 10,
                          }}
                        />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip
                          formatter={(v: number) => [v, 'Effectif']}
                          labelFormatter={(v: number) => `Centre: ${Number(v).toFixed(3)}`}
                        />
                        <Bar
                          dataKey="count"
                          fill="hsl(217,91%,60%)"
                          radius={[2, 2, 0, 0]}
                          maxBarSize={24}
                        />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-center text-[10px] text-muted-foreground">Q-Q Plot (normalité)</p>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-1.5" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={qqData}
                        margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis
                          dataKey="theoretical"
                          type="number"
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v: number) => v.toFixed(1)}
                          label={{
                            value: 'Quantile théorique',
                            position: 'insideBottom',
                            offset: -4,
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          type="number"
                          tick={{ fontSize: 9 }}
                          tickFormatter={(v: number) => v.toFixed(1)}
                          label={{
                            value: 'Résidu',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 8,
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          formatter={(v: number) => v.toFixed(4)}
                          labelFormatter={(v: number) => `Z théorique: ${Number(v).toFixed(3)}`}
                        />
                        <ReferenceLine
                          stroke="#9ca3af"
                          strokeDasharray="4 4"
                          segment={[
                            {
                              x: qqData[0]?.theoretical ?? -3,
                              y: qqData[0]?.sample ?? -3,
                            },
                            {
                              x: qqData[qqData.length - 1]?.theoretical ?? 3,
                              y: qqData[qqData.length - 1]?.sample ?? 3,
                            },
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="sample"
                          stroke="#f59e0b"
                          dot={{ r: 2, fill: '#f59e0b' }}
                          strokeWidth={0}
                          name="Résidus"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}
    </div>
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

function ArtifactUnavailable({ label, reason }: { label: string; reason: string }) {
  return (
    <p className="py-1 text-xs text-muted-foreground">
      <span className="font-medium">{label} —</span> Calcul impossible : {reason}
    </p>
  );
}
