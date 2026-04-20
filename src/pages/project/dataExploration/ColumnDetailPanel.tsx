import { useEffect, useState } from 'react';
import { Target, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import databaseService from '@/services/databaseService';

import { KindIcon } from './KindIcon';
import { QualityBadge } from './QualityBadge';
import { fmt, pctLabel, kindLabel } from './types';
import type { ColProfile } from './types';

export function ColumnDetailPanel({
  col,
  totalRows,
  isTarget,
  onSetTarget,
  onClose,
  projectId,
  datasetId,
  versionId,
}: {
  col: ColProfile;
  totalRows: number;
  isTarget: boolean;
  onSetTarget: () => void;
  onClose: () => void;
  projectId: string;
  datasetId: number;
  versionId?: number | null;
}) {
  const missingPct = totalRows ? (col.missing / totalRows) * 100 : 0;

  const [chartData, setChartData] = useState<Array<{ label: string; count: number }> | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    setChartData(null);
    const sourceId = versionId || datasetId;
    if (!sourceId || (col.kind !== 'numeric' && col.kind !== 'categorical' && col.kind !== 'text')) return;
    setLoadingChart(true);
    const run = async () => {
      try {
        if (col.kind === 'numeric') {
          const res = versionId
            ? await databaseService.versionHist(projectId, versionId, { col: col.name, bins: 15 })
            : await databaseService.hist(projectId, datasetId, { col: col.name, bins: 15 });
          setChartData(res.rows.map((b) => ({ label: b.x0.toFixed(2), count: b.count })));
        } else {
          const res = versionId
            ? await databaseService.versionValueCounts(projectId, versionId, { col: col.name, top_k: 10 })
            : await databaseService.valueCounts(projectId, datasetId, { col: col.name, top_k: 10 });
          setChartData(res.rows.map((r) => ({ label: r.value || '(vide)', count: r.count })));
        }
      } catch {
        // silently ignore
      } finally {
        setLoadingChart(false);
      }
    };
    void run();
  }, [col.name, col.kind, projectId, datasetId, versionId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-4 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <KindIcon kind={col.kind} />
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{col.name}</p>
            <p className="text-xs text-muted-foreground">{col.dtype}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isTarget && (
            <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Target</Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {kindLabel(col.kind)}
          </Badge>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Missing */}
      <div className="mb-4 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Valeurs manquantes</span>
          <span className="font-medium">
            {col.missing} / {totalRows} ({pctLabel(col.missing, totalRows)})
          </span>
        </div>
        <Progress value={missingPct} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Uniques : {col.unique} ({pctLabel(col.unique, totalRows)})</span>
          <QualityBadge missing={col.missing} total={totalRows} />
        </div>
      </div>

      {/* Numeric stats */}
      {col.kind === 'numeric' && col.numeric && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Statistiques descriptives
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Min', col.numeric.min],
                ['Max', col.numeric.max],
                ['Moyenne', col.numeric.mean],
                ['Écart-type', col.numeric.std],
                ['P25', col.numeric.p25],
                ['Médiane (P50)', col.numeric.p50],
                ['P75', col.numeric.p75],
              ] as [string, number | null | undefined][]
            ).map(([label, val]) => (
              <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm">{fmt(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorical / text top values */}
      {(col.kind === 'categorical' || col.kind === 'text' || col.kind === 'datetime') &&
        col.topValues && col.topValues.length > 0 && (
          <div className="mb-4 flex-1 min-h-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Valeurs les plus fréquentes ({col.unique} uniques)
            </p>
            <div className="space-y-1.5 overflow-auto max-h-52">
              {col.topValues.map((tv) => {
                const pct = totalRows ? (tv.count / totalRows) * 100 : 0;
                return (
                  <div key={tv.value} className="flex items-center gap-2 text-sm">
                    <span className="w-28 truncate text-xs" title={tv.value}>
                      {tv.value || '(vide)'}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {tv.count} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Distribution chart */}
      {(col.kind === 'numeric' || col.kind === 'categorical' || col.kind === 'text') && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {col.kind === 'numeric' ? 'Distribution (histogramme)' : 'Distribution (fréquences)'}
          </p>
          {loadingChart ? (
            <div className="h-28 flex items-center justify-center text-xs text-muted-foreground">
              Chargement…
            </div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={110}>
              <BarChart
                data={chartData}
                margin={{ top: 2, right: 4, bottom: col.kind === 'numeric' ? 16 : 32, left: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  interval={col.kind === 'numeric' ? 'preserveStartEnd' : 0}
                  angle={col.kind !== 'numeric' ? -35 : 0}
                  textAnchor={col.kind !== 'numeric' ? 'end' : 'middle'}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [v, 'count']}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="hsl(221,83%,53%)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">
              Pas de données
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto pt-4 border-t border-border/60 flex gap-2">
        {!isTarget && (
          <Button size="sm" variant="outline" onClick={onSetTarget} className="flex-1">
            <Target className="h-3.5 w-3.5 mr-1.5" />
            Définir comme cible
          </Button>
        )}
      </div>
    </div>
  );
}
