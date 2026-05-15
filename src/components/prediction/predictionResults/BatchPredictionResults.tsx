import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  Loader2,
  Shuffle,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExplanationMethod, PredictionResponse, PredictionRow } from '@/types';

import { CounterfactualModal } from './CounterfactualModal';
import { ExplanationModal } from './ExplanationModal';
import { KpiCard } from './KpiCard';
import { METHOD_LABELS } from './ExplanationPanel';
import { PredictionBadge } from './PredictionBadge';
import { RowDetailsModal } from './RowDetailsModal';
import { ScoreBar } from './ScoreBar';
import { _buildZoneCounts, _confLevel, _fmt } from './helpers';
import { usePredictionExplanations } from './usePredictionExplanations';

const PAGE_SIZE = 20;

export function BatchPredictionResults({
  result,
  projectId,
}: {
  result: PredictionResponse;
  projectId: string;
}) {
  const navigate = useNavigate();

  const {
    getRowExplanations,
    fetchExplanations,
    runCounterfactual,
    cfLiveRunner,
    featureRanges,
    ensureFeatureRanges,
    loadingRows,
    isRowLoading,
    isCfLoading,
    cache,
    exportCsv,
    isExporting,
  } = usePredictionExplanations(projectId, result);

  const [page, setPage] = useState(0);
  const [explainMethod, setExplainMethod] = useState<ExplanationMethod>('shap');
  const [openModalRow, setOpenModalRow] = useState<PredictionRow | null>(null);
  const [openCfModalRow, setOpenCfModalRow] = useState<PredictionRow | null>(null);
  const [openDetailsRow, setOpenDetailsRow] = useState<PredictionRow | null>(null);

  const isClassification = result.taskType === 'classification';
  const totalRows = result.nRows ?? 0;
  const rows = result.rows ?? [];

  /** True when at least one explanation (SHAP or LIME, server-provided or cached) exists. */
  const hasAnyExplanation =
    rows.some((r) => (r.shap && r.shap.length > 0) || (r.lime && r.lime.length > 0)) ||
    Object.keys(cache).length > 0;

  const uncertainRows = useMemo(
    () => rows.filter((r) => _confLevel(r.score, result.thresholdUsed) === 'uncertain'),
    [rows, result.thresholdUsed],
  );

  const zoneCounts = useMemo(
    () => (isClassification ? _buildZoneCounts(rows, result.thresholdUsed ?? 0.5) : []),
    [rows, isClassification, result.thresholdUsed],
  );

  const classDist = result.summary?.classDistribution ?? null;
  const classEntries = classDist ? Object.entries(classDist).sort((a, b) => b[1] - a[1]) : [];

  const topFeatures = result.topFeatures ?? [];
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExplainRow = useCallback(
    async (row: PredictionRow) => {
      if (loadingRows.has(row.rowIndex)) return;
      setOpenModalRow(row);
      await fetchExplanations(row, explainMethod);
    },
    [loadingRows, fetchExplanations, explainMethod],
  );

  const handleMethodChange = useCallback(
    async (m: ExplanationMethod) => {
      setExplainMethod(m);
      if (openModalRow) {
        await fetchExplanations(openModalRow, m);
      }
    },
    [openModalRow, fetchExplanations],
  );

  // Lazy-load feature ranges once when the CF modal opens.
  useEffect(() => {
    if (openCfModalRow) ensureFeatureRanges();
  }, [openCfModalRow, ensureFeatureRanges]);

  return (
    <AppLayout>
      <div className="space-y-8 w-full">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 self-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/projects/${projectId}/predict`)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Nouvelle prédiction
          </Button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Résultats de prédiction</h1>
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground">
                  {result.modelType}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] tabular-nums">
                  {totalRows} ligne{totalRows > 1 ? 's' : ''}
                </span>
                {result.thresholdUsed !== 0.5 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <Target className="h-3 w-3" />
                    Seuil calibré : {result.thresholdUsed.toFixed(2)}
                  </span>
                )}
                {hasAnyExplanation && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/50 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                    <Sparkles className="h-3 w-3" />
                    Explicabilité activée
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={isExporting} className="shrink-0">
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* Drift warnings */}
        {result.driftWarnings && result.driftWarnings.length > 0 && (
          <div className="rounded-xl border border-l-4 border-l-amber-500 border-border bg-card shadow-sm p-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              Dérive de données détectée
              <span className="ml-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {result.driftWarnings.length} avertissement{result.driftWarnings.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="space-y-1.5 pl-9">
              {result.driftWarnings.map((w, i) => (
                <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none mt-0.5 ${
                      w.severity === 'critical'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {w.severity === 'critical' ? 'CRITIQUE' : 'AVERT.'}
                  </span>
                  <span>
                    <span className="font-mono font-semibold text-foreground">{w.column}</span> · {w.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Uncertain predictions alert */}
        {isClassification && uncertainRows.length > 0 && (
          <div className="rounded-xl border border-l-4 border-l-red-500 border-border bg-card shadow-sm p-4 flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {uncertainRows.length} prédiction{uncertainRows.length > 1 ? 's' : ''} incertaine
                {uncertainRows.length > 1 ? 's' : ''}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Score entre 40 % et 60 %
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Vérification clinique recommandée. Lignes concernées :{' '}
                <span className="font-mono text-foreground">
                  {uncertainRows
                    .map((r) => r.rowIndex + 1)
                    .slice(0, 8)
                    .join(', ')}
                  {uncertainRows.length > 8 ? ` … (+${uncertainRows.length - 8})` : ''}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Total lignes"
            value={String(totalRows)}
            tone="neutral"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
          />
          {isClassification ? (
            classEntries.slice(0, 2).map(([label, count], i) => {
              const lower = String(label).toLowerCase();
              const isPos =
                lower === '1' || lower === 'true' || lower === 'yes' || lower === 'positive' || lower === 'oui';
              return (
                <KpiCard
                  key={label}
                  title={`Classe "${label}"`}
                  value={String(count)}
                  sub={`${((count / totalRows) * 100).toFixed(1)} % du total`}
                  tone={i === 0 ? (isPos ? 'danger' : 'success') : isPos ? 'danger' : 'success'}
                  icon={isPos ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                />
              );
            })
          ) : (
            <>
              <KpiCard
                title="Moyenne"
                value={result.summary.mean?.toFixed(3) ?? '—'}
                tone="primary"
                icon={<Activity className="h-3.5 w-3.5" />}
              />
              <KpiCard
                title="Min / Max"
                value={`${result.summary.min?.toFixed(2) ?? '—'} / ${result.summary.max?.toFixed(2) ?? '—'}`}
                tone="neutral"
              />
            </>
          )}
          {isClassification && (
            <KpiCard
              title="Prédictions incertaines"
              value={String(uncertainRows.length)}
              sub={uncertainRows.length > 0 ? 'Score entre 40 % et 60 %' : 'Aucune incertitude'}
              tone={uncertainRows.length > 0 ? 'warning' : 'success'}
              icon={
                uncertainRows.length > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <Target className="h-3.5 w-3.5" />
                )
              }
            />
          )}
        </div>

        {/* Charts */}
        {isClassification && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Class distribution */}
            {classEntries.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    Distribution des prédictions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classEntries.map(([label, count]) => ({ label, count }))}
                        margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RechartsTooltip
                          formatter={(v: number) => [v, 'Effectif']}
                          contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={64}>
                          {classEntries.map(([label], i) => {
                            const lower = String(label).toLowerCase();
                            const isPos =
                              lower === '1' ||
                              lower === 'true' ||
                              lower === 'yes' ||
                              lower === 'positive' ||
                              lower === 'oui';
                            return <Cell key={`dist-${i}`} fill={isPos ? '#ef4444' : '#10b981'} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score zones */}
            {zoneCounts.some((z) => z.count > 0) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    Répartition par niveau de score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {zoneCounts.map((zone) => {
                    const pct = totalRows > 0 ? (zone.count / totalRows) * 100 : 0;
                    return (
                      <div key={zone.level} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="text-xs font-medium text-foreground">{zone.label}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{zone.desc}</span>
                          </div>
                          <span
                            className="text-xs tabular-nums font-semibold shrink-0 ml-2"
                            style={{ color: zone.color }}
                          >
                            {zone.count}
                            <span className="ml-1 font-normal text-muted-foreground">({pct.toFixed(0)} %)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: zone.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 mt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Seuil de décision</span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">
                      {((result.thresholdUsed ?? 0.5) * 100).toFixed(0)} %
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Results table */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border bg-muted/30">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Détail des prédictions
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                  {rows.length}
                </span>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Cliquez sur <span className="font-medium text-violet-600 dark:text-violet-400">Expliquer</span>{' '}
                pour les contributions SHAP/LIME ·{' '}
                <span className="font-medium text-amber-600 dark:text-amber-400">Que changer ?</span> pour explorer
                un contrefactuel
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 backdrop-blur-sm sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-10">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Prédiction
                    </th>
                    {isClassification && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">
                        Score
                      </th>
                    )}
                    {topFeatures.length > 0 && (
                      <th
                        className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground min-w-[280px]"
                        title="Trois variables jugées les plus importantes par le modèle (SHAP global)"
                      >
                        Variables clés du modèle
                      </th>
                    )}
                    <th
                      className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      colSpan={2}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const uncertain =
                      isClassification && _confLevel(row.score, result.thresholdUsed) === 'uncertain';
                    const entry = getRowExplanations(row);
                    const hasAny = Boolean(entry.shap?.length || entry.lime?.length);
                    const isLoadingRow = isRowLoading(row);
                    const hasCf = Boolean(entry.counterfactual);
                    const isLoadingCfRow = isCfLoading(row);
                    return (
                      <tr
                        key={row.rowIndex}
                        className={`border-b border-border/40 transition-colors ${
                          uncertain
                            ? 'bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50/70 dark:hover:bg-red-950/20'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums font-mono">
                          {row.rowIndex + 1}
                          {uncertain && (
                            <span className="ml-1 text-red-500" title="Prédiction incertaine">
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <PredictionBadge prediction={row.prediction} isClassification={isClassification} />
                        </td>
                        {isClassification && (
                          <td className="px-3 py-2.5">
                            <ScoreBar score={row.score} threshold={result.thresholdUsed} />
                          </td>
                        )}
                        {topFeatures.length > 0 &&
                          (() => {
                            const otherCount = Math.max(0, Object.keys(row.inputData).length - topFeatures.length);
                            return (
                              <td className="px-0 py-0">
                                <button
                                  type="button"
                                  onClick={() => setOpenDetailsRow(row)}
                                  className="group flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                                  title="Cliquer pour voir tous les détails de cette ligne"
                                >
                                  <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                                    {topFeatures.map((col, i) => (
                                      <span key={col} className="inline-flex items-baseline gap-1">
                                        {i > 0 && <span className="text-border mx-0.5 select-none">·</span>}
                                        <span
                                          className="text-[10px] uppercase tracking-wide text-muted-foreground"
                                          title={col}
                                        >
                                          {col.length > 14 ? col.slice(0, 13) + '…' : col}
                                        </span>
                                        <span className="font-mono tabular-nums font-semibold text-foreground">
                                          {_fmt(row.inputData[col])}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:border-primary/40 group-hover:text-primary transition-colors">
                                    {otherCount > 0 ? `+${otherCount}` : 'détails'}
                                    <ChevronRight className="h-3 w-3" />
                                  </span>
                                </button>
                              </td>
                            );
                          })()}
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isLoadingRow}
                            onClick={() => void handleExplainRow(row)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none transition-colors disabled:opacity-50 ${
                              hasAny
                                ? 'border-violet-400/50 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300'
                                : 'border-border bg-card text-violet-700 hover:bg-violet-500/10 hover:border-violet-400/50 dark:text-violet-300'
                            }`}
                            title={hasAny ? 'Voir les explications' : `Calculer (${METHOD_LABELS[explainMethod]})`}
                          >
                            {isLoadingRow ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            {hasAny ? `${METHOD_LABELS[explainMethod]} ✓` : 'Expliquer'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isLoadingCfRow}
                            onClick={() => setOpenCfModalRow(row)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none transition-colors disabled:opacity-50 ${
                              hasCf
                                ? 'border-amber-400/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                                : 'border-border bg-card text-amber-700 hover:bg-amber-500/10 hover:border-amber-400/50 dark:text-amber-300'
                            }`}
                            title={hasCf ? 'Voir le contrefactuel' : 'Calculer le contrefactuel (DiCE)'}
                          >
                            {isLoadingCfRow ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Shuffle className="h-3 w-3" />
                            )}
                            {hasCf ? 'CF ✓' : 'Que changer ?'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Aucune prédiction</p>
                <p className="text-xs text-muted-foreground">
                  Lancez une nouvelle analyse depuis la page de prédiction.
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)}
                  </span>{' '}
                  sur {rows.length}
                  <span className="ml-2 text-[10px] uppercase tracking-wide">
                    page {page + 1}/{totalPages}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" /> Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Explanation Modal — supports SHAP, LIME, or both */}
      {openModalRow &&
        (() => {
          const entry = getRowExplanations(openModalRow);
          return (
            <ExplanationModal
              row={openModalRow}
              shapItems={entry.shap}
              limeItems={entry.lime}
              method={explainMethod}
              onMethodChange={(m) => void handleMethodChange(m)}
              isLoading={isRowLoading(openModalRow)}
              isClassification={isClassification}
              onClose={() => setOpenModalRow(null)}
              projectId={projectId}
              modelId={result.modelId}
              modelName={result.modelType}
              projectName={`Projet ${projectId}`}
            />
          );
        })()}

      {/* Row Details Modal — full feature inspection */}
      {openDetailsRow != null && (
        <RowDetailsModal
          row={openDetailsRow}
          topFeatures={topFeatures}
          isClassification={isClassification}
          threshold={result.thresholdUsed ?? 0.5}
          onClose={() => setOpenDetailsRow(null)}
        />
      )}

      {/* Counterfactual Modal */}
      {openCfModalRow != null &&
        (() => {
          const cfEntry = getRowExplanations(openCfModalRow).counterfactual;
          return (
            <CounterfactualModal
              row={openCfModalRow}
              result={result}
              featureRanges={featureRanges}
              cachedResult={cfEntry}
              isLoadingAutoSuggest={isCfLoading(openCfModalRow)}
              onAutoSuggest={(featuresToVary) => runCounterfactual(openCfModalRow, featuresToVary)}
              liveRunner={cfLiveRunner}
              onClose={() => setOpenCfModalRow(null)}
            />
          );
        })()}
    </AppLayout>
  );
}
