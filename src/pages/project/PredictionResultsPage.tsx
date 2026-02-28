import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Target, Download, BarChart3, Activity, ArrowLeft, Loader2 } from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';
import type { PredictionResponse } from '@/types';

/** Format a value for display in the table cell. */
function _fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

export function PredictionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceFile, setSourceFile] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('lastPrediction');
    const fname = sessionStorage.getItem('lastPredictionFile') ?? '';
    if (raw) {
      try {
        setResult(JSON.parse(raw) as PredictionResponse);
        setSourceFile(fname);
      } catch {
        // ignore parse error
      }
    }
    setIsLoading(false);
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const isClassification = result?.taskType === 'classification';
  const classDist = result?.summary?.classDistribution ?? null;
  const avgScore = result?.summary?.avgScore;
  const totalRows = result?.nRows ?? 0;

  // For classification: count unique classes
  const classEntries = classDist
    ? Object.entries(classDist).sort((a, b) => b[1] - a[1])
    : [];
  const maxClassCount = classEntries.length > 0 ? Math.max(...classEntries.map(([, c]) => c)) : 1;

  // Dynamic column list for the results table
  const inputCols = result?.rows[0]
    ? Object.keys(result.rows[0].inputData).slice(0, 6) // show first 6 input cols
    : [];

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const handleExportCsv = useCallback(async () => {
    if (!id || !sourceFile || sourceFile === 'manual') {
      // For manual mode: build CSV client-side from stored result
      if (!result) return;
      const { rows, modelType } = result;
      if (!rows.length) return;
      const inputKeys = Object.keys(rows[0].inputData);
      const header = ['row_index', 'prediction', 'score', ...inputKeys].join(',');
      const lines = rows.map((r) => {
        const inputVals = inputKeys.map((k) => String(r.inputData[k] ?? ''));
        return [r.rowIndex, r.prediction, r.score ?? '', ...inputVals].join(',');
      });
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      _triggerDownload(blob, `predictions_${modelType}.csv`);
      toast({ title: 'Export CSV réussi' });
      return;
    }

    // For file mode: re-submit the file to the export endpoint
    // We don't keep the original File object in memory, so we use the stored JSON instead
    if (!result) return;
    setIsExporting(true);
    try {
      const { rows, modelType } = result;
      const inputKeys = Object.keys(rows[0]?.inputData ?? {});
      const header = ['row_index', 'prediction', 'score', ...inputKeys].join(',');
      const lines = rows.map((r) => {
        const vals = inputKeys.map((k) => String(r.inputData[k] ?? ''));
        return [r.rowIndex, r.prediction, r.score ?? '', ...vals].join(',');
      });
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      _triggerDownload(blob, `predictions_${modelType}.csv`);
      toast({ title: 'Export CSV réussi' });
    } finally {
      setIsExporting(false);
    }
  }, [id, result, sourceFile, toast]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!result) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center space-y-4 pt-16">
          <Target className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Aucun résultat disponible</h2>
          <p className="text-muted-foreground">
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => navigate(`/projects/${id}/predict`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Nouvelle prédiction
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Résultats de prédiction</h1>
            <p className="text-muted-foreground mt-1">
              {result.modelType} · {totalRows} ligne(s) · seuil{' '}
              {result.thresholdUsed !== 0.5 ? (
                <span className="font-medium text-amber-600">
                  {result.thresholdUsed.toFixed(2)}
                </span>
              ) : (
                <span>{result.thresholdUsed.toFixed(2)}</span>
              )}
            </p>
          </div>
          <Button onClick={handleExportCsv} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter CSV
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total lignes</p>
              <p className="text-3xl font-bold">{totalRows}</p>
            </CardContent>
          </Card>

          {isClassification ? (
            classEntries.slice(0, 2).map(([label, count]) => (
              <Card
                key={label}
                className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20"
              >
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground capitalize">{label}</p>
                  <p className="text-3xl font-bold text-primary">{count}</p>
                  <p className="text-xs text-muted-foreground">
                    {((count / totalRows) * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Moyenne</p>
                  <p className="text-3xl font-bold">{result.summary.mean?.toFixed(3) ?? '—'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Min / Max</p>
                  <p className="text-lg font-bold">
                    {result.summary.min?.toFixed(2) ?? '—'} /{' '}
                    {result.summary.max?.toFixed(2) ?? '—'}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {avgScore !== null && avgScore !== undefined && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Score moyen</p>
                <p className="text-3xl font-bold text-primary">
                  {(avgScore * 100).toFixed(0)}%
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Charts */}
        {isClassification && classEntries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Distribution des prédictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end justify-center gap-8">
                  {classEntries.map(([label, count]) => (
                    <div key={label} className="flex flex-col items-center">
                      <div
                        className="w-20 bg-gradient-to-t from-primary to-primary/60 rounded-t-lg transition-all"
                        style={{ height: `${(count / maxClassCount) * 140}px` }}
                      />
                      <p className="mt-2 font-medium capitalize text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Confidence gauge */}
            {avgScore !== null && avgScore !== undefined && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-secondary" />
                    Confiance moyenne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center">
                    <div className="relative w-40 h-40">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="80" cy="80" r="70" className="fill-none stroke-muted stroke-[12]" />
                        <circle
                          cx="80" cy="80" r="70"
                          className="fill-none stroke-primary stroke-[12]"
                          strokeDasharray={`${avgScore * 440} 440`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-3xl font-bold">{(avgScore * 100).toFixed(0)}%</p>
                          <p className="text-sm text-muted-foreground">Confiance</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Détail des prédictions</span>
              {result.thresholdUsed !== 0.5 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  seuil calibré : {result.thresholdUsed.toFixed(2)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">#</th>
                    <th className="px-3 py-3 text-left font-medium">Prédiction</th>
                    {isClassification && (
                      <th className="px-3 py-3 text-left font-medium">Score</th>
                    )}
                    {inputCols.map((col) => (
                      <th key={col} className="px-3 py-3 text-left font-medium capitalize">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.rowIndex} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{row.rowIndex + 1}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            isClassification
                              ? row.rowIndex % 2 === 0
                                ? 'default'
                                : 'secondary'
                              : 'outline'
                          }
                        >
                          {_fmt(row.prediction)}
                        </Badge>
                      </td>
                      {isClassification && (
                        <td className="px-3 py-2">
                          {row.score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${row.score * 100}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums">
                                {(row.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {inputCols.map((col) => (
                        <td key={col} className="px-3 py-2 text-muted-foreground">
                          {_fmt(row.inputData[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Aucune prédiction.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function _triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default PredictionResultsPage;
