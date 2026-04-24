import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Download,
  Loader2,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';
import type { PredictionResponse, PredictionRow, ShapLocalItem } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

function _confLevel(score: number | null, threshold = 0.5): 'high' | 'medium' | 'low' | 'uncertain' {
  if (score === null) return 'medium';
  const d = Math.abs(score - threshold);
  if (d < 0.1)  return 'uncertain';
  if (d < 0.2)  return 'low';
  if (d < 0.35) return 'medium';
  return 'high';
}

function _confTooltip(level: string, threshold: number): string {
  const t = (threshold * 100).toFixed(0);
  const margin = (v: number) => `${(Math.abs(v * 100)).toFixed(0)}%`;
  switch (level) {
    case 'high':      return `Le score est loin du seuil de décision (${t}%). Le modèle prédit avec une forte séparation entre les classes.`;
    case 'medium':    return `Le score est à distance modérée du seuil (${t}%). La prédiction est probable mais mérite attention.`;
    case 'low':       return `Le score est proche du seuil de décision (${t}%). La prédiction pourrait changer avec de légères variations des données. Vérification recommandée.`;
    case 'uncertain': return `Le score est très proche du seuil de décision (${t}%). Le modèle ne discrimine pas clairement entre les classes. Un avis clinique est indispensable.`;
    default: return '';
  }
}

const CONF_BADGE: Record<string, { badge: string; bar: string; label: string }> = {
  high:      { badge: 'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300', bar: '#10b981', label: 'Net'    },
  medium:    { badge: 'border-blue-400/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',               bar: '#3b82f6', label: 'Modéré' },
  low:       { badge: 'border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',          bar: '#f59e0b', label: 'Limite' },
  uncertain: { badge: 'border-red-400/50 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',                    bar: '#ef4444', label: 'Ambigu' },
};

/** Count predictions per confidence zone, respecting the real threshold. */
function _buildZoneCounts(rows: PredictionRow[], threshold: number) {
  const counts = { uncertain: 0, low: 0, medium: 0, high: 0 };
  for (const r of rows) {
    if (r.score === null) continue;
    counts[_confLevel(r.score, threshold)]++;
  }
  return [
    { level: 'uncertain', label: 'Ambigu',  count: counts.uncertain, color: '#ef4444', desc: 'Avis clinique requis' },
    { level: 'low',       label: 'Limite',  count: counts.low,       color: '#f59e0b', desc: 'Vérification recommandée' },
    { level: 'medium',    label: 'Modéré',  count: counts.medium,    color: '#3b82f6', desc: 'Résultat probable' },
    { level: 'high',      label: 'Net',     count: counts.high,      color: '#10b981', desc: 'Forte séparation' },
  ];
}

function _triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, accent = false }: { title: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <p className={`text-2xl font-bold ${accent ? 'text-primary' : ''}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score, threshold = 0.5 }: { score: number | null; threshold?: number }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const level = _confLevel(score, threshold);
  const style = CONF_BADGE[level];
  const pct = Math.round(score * 100);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: style.bar }} />
        </div>
        <span className="text-xs tabular-nums font-medium" style={{ color: style.bar }}>{pct}%</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`cursor-default rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
              {style.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-center text-xs">
            {_confTooltip(level, threshold)}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function ShapPanel({ items }: { items: ShapLocalItem[] }) {
  const top = items.slice(0, 8);
  const maxAbs = Math.max(...top.map((d) => Math.abs(d.shap_value)), 1e-9);

  return (
    <div className="py-3 px-2 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
          <Sparkles className="h-3 w-3" /> Contributions SHAP
        </span>
        <span className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-400" /> baisse
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" /> hausse
          </span>
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {top.map((item) => {
          const pct = (Math.abs(item.shap_value) / maxAbs) * 100;
          const isPos = item.shap_value > 0;
          const color = isPos ? '#f97316' : '#60a5fa';

          return (
            <div key={item.feature} className="grid items-center gap-2" style={{ gridTemplateColumns: '140px 1fr 60px 52px' }}>
              {/* Feature name */}
              <span className="text-[11px] text-foreground truncate" title={item.feature}>
                {item.feature}
              </span>

              {/* Bar — centered axis */}
              <div className="relative h-3 rounded-sm bg-muted/40 overflow-hidden">
                <div
                  className="absolute top-0 h-full rounded-sm"
                  style={{
                    width: `${pct / 2}%`,
                    backgroundColor: color,
                    opacity: 0.75,
                    ...(isPos ? { left: '50%' } : { right: '50%' }),
                  }}
                />
                <div className="absolute inset-y-0 left-1/2 w-px bg-border/80" />
              </div>

              {/* SHAP value */}
              <span
                className="text-[11px] tabular-nums font-semibold text-right"
                style={{ color }}
              >
                {isPos ? '+' : ''}{item.shap_value.toFixed(3)}
              </span>

              {/* Input value */}
              <span className="text-[10px] text-muted-foreground text-right truncate font-mono" title={item.data != null ? String(item.data) : ''}>
                {item.data != null ? _fmt(item.data) : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShapModal({
  row,
  items,
  isClassification,
  onClose,
}: {
  row: PredictionRow;
  items: ShapLocalItem[];
  isClassification: boolean;
  onClose: () => void;
}) {
  const descParts = [
    `Prédiction : ${String(row.prediction)}`,
    isClassification && row.score != null ? `Score : ${(row.score * 100).toFixed(1)}%` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={<Sparkles className="h-5 w-5" />}
      title={`Explication SHAP — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <p className="text-[11px] text-muted-foreground">
          Impact{' '}
          <span className="font-medium text-orange-600 dark:text-orange-400">positif ↑</span>
          {' '}ou{' '}
          <span className="font-medium text-blue-600 dark:text-blue-400">négatif ↓</span>
          {' '}de chaque variable par rapport à la prédiction moyenne du modèle.
        </p>
      }
    >
      <ShapPanel items={items} />
    </Modal>
  );
}

function PredictionBadge({ prediction, isClassification }: { prediction: string | number; isClassification: boolean }) {
  const val = String(prediction);
  if (!isClassification) {
    return <span className="font-mono text-sm font-semibold">{_fmt(prediction)}</span>;
  }
  const lower = val.toLowerCase();
  const isPositive = lower === '1' || lower === 'true' || lower === 'yes' || lower === 'oui' || lower === 'positive';
  const isNegative = lower === '0' || lower === 'false' || lower === 'no' || lower === 'non' || lower === 'negative';
  const cls = isPositive
    ? 'bg-red-50 text-red-700 border-red-400/50 dark:bg-red-950/30 dark:text-red-300'
    : isNegative
      ? 'bg-emerald-50 text-emerald-700 border-emerald-400/50 dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'bg-muted text-foreground border-border';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {val}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function PredictionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [parseError, setParseError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [shapModal, setShapModal] = useState<{ row: PredictionRow; items: ShapLocalItem[] } | null>(null);
  const [shapCache, setShapCache] = useState<Record<number, ShapLocalItem[]>>({});
  const [loadingShapRows, setLoadingShapRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    setParseError(false);
    const raw = sessionStorage.getItem('lastPrediction');
    if (raw) {
      try {
        setResult(JSON.parse(raw) as PredictionResponse);
      } catch (e) {
        console.error('[PredictionResultsPage] Failed to parse prediction response:', e);
        toast({ title: 'Erreur de chargement', description: "Les résultats de prédiction n'ont pas pu être chargés. Réessayez.", variant: 'destructive' });
        setParseError(true);
      }
    }
    setIsLoading(false);
  }, []);

  const isClassification = result?.taskType === 'classification';
  const totalRows = result?.nRows ?? 0;
  const rows = result?.rows ?? [];
  const hasShap = rows.some((r) => r.shap && r.shap.length > 0) || Object.keys(shapCache).length > 0;

  const uncertainRows = useMemo(
    () => rows.filter((r) => _confLevel(r.score, result?.thresholdUsed) === 'uncertain'),
    [rows],
  );

  const zoneCounts = useMemo(
    () => (isClassification ? _buildZoneCounts(rows, result?.thresholdUsed ?? 0.5) : []),
    [rows, isClassification, result?.thresholdUsed],
  );

  const classDist = result?.summary?.classDistribution ?? null;
  const classEntries = classDist
    ? Object.entries(classDist).sort((a, b) => b[1] - a[1])
    : [];

  const inputCols = rows[0] ? Object.keys(rows[0].inputData).slice(0, 5) : [];

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExplainRow = useCallback(async (row: PredictionRow) => {
    if (!id || !result || loadingShapRows.has(row.rowIndex)) return;

    // If already cached, open modal directly
    const cached = row.shap ?? shapCache[row.rowIndex];
    if (cached && cached.length > 0) {
      setShapModal({ row, items: cached });
      return;
    }

    setLoadingShapRows((prev) => new Set(prev).add(row.rowIndex));
    try {
      const explained = await predictionService.predictManualWithSavedModelExplain(
        id,
        result.modelId,
        [row.inputData],
      );
      const shap = explained.rows[0]?.shap;
      if (shap && shap.length > 0) {
        setShapCache((prev) => ({ ...prev, [row.rowIndex]: shap }));
        setShapModal({ row, items: shap });
      } else {
        toast({ title: 'SHAP indisponible pour ce modèle', variant: 'destructive' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Impossible de calculer les explications.';
      console.error('[Expliquer] SHAP error:', err);
      toast({ title: 'Erreur SHAP', description: msg, variant: 'destructive' });
    } finally {
      setLoadingShapRows((prev) => { const s = new Set(prev); s.delete(row.rowIndex); return s; });
    }
  }, [id, result, loadingShapRows, shapCache, toast]);

  const handleExportCsv = useCallback(async () => {
    if (!id || !result) return;
    setIsExporting(true);
    try {
      const { blob, filename } = await predictionService.exportResultsCsv(
        id,
        result.modelId,
        result.modelType,
        result.rows,
      );
      _triggerDownload(blob, filename ?? `predictions_${result.modelType}.csv`);
      toast({ title: 'Export CSV réussi' });
    } catch (err) {
      toast({ title: 'Erreur export', description: err instanceof Error ? err.message : 'Impossible d\'exporter.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }, [id, result, toast]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (parseError) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-4 pt-16" data-testid="prediction-parse-error">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Erreur de chargement</h2>
          <p className="text-sm text-muted-foreground">
            Les résultats de prédiction sont corrompus ou illisibles. Relancez une prédiction.
          </p>
          <Button onClick={() => navigate(`/projects/${id}/predict`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Nouvelle prédiction
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!result) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-4 pt-16" data-testid="prediction-empty">
          <Target className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Aucun résultat disponible</h2>
          <p className="text-sm text-muted-foreground">
            Retournez à la page de prédiction et lancez une analyse.
          </p>
          <Button onClick={() => navigate(`/projects/${id}/predict`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 w-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-xs" onClick={() => navigate(`/projects/${id}/predict`)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Nouvelle prédiction
            </Button>
            <h1 className="text-2xl font-bold">Résultats de prédiction</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-medium uppercase">{result.modelType}</span>
              <span>·</span>
              <span>{totalRows} ligne{totalRows > 1 ? 's' : ''}</span>
              {result.thresholdUsed !== 0.5 && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 font-medium">seuil {result.thresholdUsed.toFixed(2)}</span>
                </>
              )}
              {hasShap && (
                <Badge variant="outline" className="gap-1 text-xs border-violet-400/50 text-violet-600 dark:text-violet-400">
                  <Sparkles className="h-3 w-3" /> SHAP
                </Badge>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Exporter CSV
          </Button>
        </div>

        {/* Drift warnings */}
        {result.driftWarnings && result.driftWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Dérive de données détectée — {result.driftWarnings.length} avertissement{result.driftWarnings.length > 1 ? 's' : ''}
            </div>
            <ul className="space-y-1">
              {result.driftWarnings.map((w, i) => (
                <li key={i} className={`text-xs flex items-start gap-2 ${w.severity === 'critical' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${w.severity === 'critical' ? 'bg-red-100 dark:bg-red-950/40' : 'bg-amber-100 dark:bg-amber-950/40'}`}>
                    {w.severity === 'critical' ? 'CRITIQUE' : 'AVERT.'}
                  </span>
                  <span><strong>[{w.column}]</strong> {w.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Uncertain predictions alert */}
        {isClassification && uncertainRows.length > 0 && (
          <div className="rounded-xl border border-red-300/60 bg-red-50/80 dark:bg-red-950/20 dark:border-red-900 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                {uncertainRows.length} prédiction{uncertainRows.length > 1 ? 's' : ''} incertaine{uncertainRows.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Score entre 40 % et 60 % — vérification clinique recommandée.
                Lignes concernées : {uncertainRows.map((r) => r.rowIndex + 1).slice(0, 8).join(', ')}
                {uncertainRows.length > 8 ? `… (+${uncertainRows.length - 8})` : ''}
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total lignes" value={String(totalRows)} />
          {isClassification ? (
            classEntries.slice(0, 2).map(([label, count]) => (
              <KpiCard
                key={label}
                title={`Classe "${label}"`}
                value={String(count)}
                sub={`${((count / totalRows) * 100).toFixed(1)}%`}
                accent
              />
            ))
          ) : (
            <>
              <KpiCard title="Moyenne" value={result.summary.mean?.toFixed(3) ?? '—'} />
              <KpiCard title="Min / Max" value={`${result.summary.min?.toFixed(2) ?? '—'} / ${result.summary.max?.toFixed(2) ?? '—'}`} />
            </>
          )}
          {isClassification && (
            <KpiCard
              title="Prédictions incertaines"
              value={String(uncertainRows.length)}
              sub={uncertainRows.length > 0 ? 'Score entre 40% et 60%' : 'Aucune incertitude'}
              accent={uncertainRows.length > 0}
            />
          )}
        </div>

        {/* Charts */}
        {isClassification && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Class distribution */}
            {classEntries.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Distribution des prédictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classEntries.map(([label, count]) => ({ label, count }))} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v: number) => [v, 'Effectif']} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                          {classEntries.map(([label], i) => {
                            const lower = String(label).toLowerCase();
                            const isPos = lower === '1' || lower === 'true' || lower === 'yes' || lower === 'positive';
                            return (
                              <Cell key={`dist-${i}`} fill={isPos ? '#ef4444' : '#10b981'} />
                            );
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-secondary" />
                    Répartition par niveau de score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {zoneCounts.map((zone) => {
                    const pct = totalRows > 0 ? (zone.count / totalRows) * 100 : 0;
                    return (
                      <div key={zone.level}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="text-xs font-medium">{zone.label}</span>
                            <span className="text-[11px] text-muted-foreground">{zone.desc}</span>
                          </div>
                          <span className="text-xs tabular-nums font-semibold" style={{ color: zone.color }}>
                            {zone.count} <span className="font-normal text-muted-foreground">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: zone.color, opacity: 0.8 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Seuil de décision : <span className="font-medium">{((result?.thresholdUsed ?? 0.5) * 100).toFixed(0)}%</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Results table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                Détail des prédictions
                <span className="text-[11px] text-muted-foreground font-normal">
                  · Cliquez sur <span className="text-violet-600 dark:text-violet-400">Expliquer</span> pour obtenir les contributions SHAP par ligne
                </span>
              </CardTitle>
              {result.thresholdUsed !== 0.5 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  seuil calibré : {result.thresholdUsed.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-10">#</th>
                    <th className="px-3 py-2.5 text-left font-medium">Prédiction</th>
                    {isClassification && (
                      <th className="px-3 py-2.5 text-left font-medium min-w-[180px]">Score (probabilité)</th>
                    )}
                    {inputCols.map((col) => (
                      <th key={col} className="px-3 py-2.5 text-left font-medium max-w-[120px] truncate">
                        {col}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 w-24 text-right font-medium text-muted-foreground">
                      <span className="flex items-center justify-end gap-1">
                        <Sparkles className="h-3 w-3 text-violet-500" /> SHAP
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const uncertain = isClassification && _confLevel(row.score, result.thresholdUsed) === 'uncertain';
                    const shapItems = row.shap ?? shapCache[row.rowIndex] ?? null;
                    const isLoadingShap = loadingShapRows.has(row.rowIndex);
                    return (
                      <tr
                        key={row.rowIndex}
                        className={`border-t border-border/40 transition-colors ${uncertain ? 'bg-red-50/40 dark:bg-red-950/10' : 'hover:bg-muted/30'}`}
                      >
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">
                          {row.rowIndex + 1}
                          {uncertain && <span className="ml-1 text-red-500" title="Prédiction incertaine">⚠</span>}
                        </td>
                        <td className="px-3 py-2">
                          <PredictionBadge prediction={row.prediction} isClassification={isClassification} />
                        </td>
                        {isClassification && (
                          <td className="px-3 py-2">
                            <ScoreBar score={row.score} threshold={result.thresholdUsed} />
                          </td>
                        )}
                        {inputCols.map((col) => (
                          <td key={col} className="px-3 py-2 text-muted-foreground max-w-[120px] truncate" title={_fmt(row.inputData[col])}>
                            {_fmt(row.inputData[col])}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={isLoadingShap}
                            onClick={() => void handleExplainRow(row)}
                            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                              shapItems
                                ? 'border-violet-400/50 bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300'
                                : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
                            }`}
                            title={shapItems ? 'Voir les explications SHAP' : 'Calculer les explications SHAP'}
                          >
                            {isLoadingShap ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            {shapItems ? 'SHAP ✓' : 'Expliquer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">Aucune prédiction.</p>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} sur {rows.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <TrendingDown className="h-3 w-3 mr-1 rotate-90" /> Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant <TrendingUp className="h-3 w-3 ml-1 rotate-90" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SHAP Modal */}
      {shapModal && (
        <ShapModal
          row={shapModal.row}
          items={shapModal.items}
          isClassification={isClassification}
          onClose={() => setShapModal(null)}
        />
      )}
    </AppLayout>
  );
}

export default PredictionResultsPage;
