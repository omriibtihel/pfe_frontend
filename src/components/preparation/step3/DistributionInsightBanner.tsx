import { useEffect, useRef, useState } from 'react';
import {
  BarChart2, CheckCircle2, ChevronDown, ChevronUp, Sparkles, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trainingService } from '@/services/trainingService';
import type { ColumnDistributionStat, DatasetProfile } from '@/types/training';
import type { TrainingPreprocessingColumnConfig, TrainingPreprocessingDefaults } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PerColumnRecommendation {
  powerTransform: TrainingPreprocessingDefaults['numericPowerTransform'];
  scaling: TrainingPreprocessingDefaults['numericScaling'];
  imputation: TrainingPreprocessingDefaults['numericImputation'];
}

interface DistributionInsightBannerProps {
  projectId: string;
  versionId: string | number | null | undefined;
  targetColumn: string | null | undefined;
  currentColumns: Record<string, TrainingPreprocessingColumnConfig>;
  onProfileLoaded?: (profile: DatasetProfile) => void;
  onApplyPerColumn: (
    configs: Record<string, {
      numericPowerTransform?: TrainingPreprocessingDefaults['numericPowerTransform'];
      numericScaling?: TrainingPreprocessingDefaults['numericScaling'];
      numericImputation?: TrainingPreprocessingDefaults['numericImputation'];
    }>,
  ) => void;
}

type FetchState = 'idle' | 'loading' | 'done' | 'error';

// ── Labels ────────────────────────────────────────────────────────────────────

const TRANSFORM_LABELS: Record<string, string> = {
  none: 'Aucun', log: 'log(x)', sqrt: '√x',
  yeo_johnson: 'Yeo-Johnson', box_cox: 'Box-Cox',
};
const SCALING_LABELS: Record<string, string> = {
  none: 'Aucun', standard: 'Standard (z-score)', robust: 'Robust (IQR)',
  minmax: 'MinMax', maxabs: 'MaxAbs',
};
const IMPUTATION_LABELS: Record<string, string> = {
  none: 'Aucun', mean: 'Moyenne', median: 'Médiane', most_frequent: 'Fréquent',
};
const TRANSFORM_COLORS: Record<string, string> = {
  log:         'bg-orange-500/10 text-orange-600 border-orange-300/40',
  sqrt:        'bg-yellow-500/10 text-yellow-600 border-yellow-300/40',
  yeo_johnson: 'bg-emerald-500/10 text-emerald-600 border-emerald-300/40',
  box_cox:     'bg-cyan-500/10 text-cyan-600 border-cyan-300/40',
  none:        'bg-muted/60 text-muted-foreground border-border/40',
};
const SCALING_COLORS: Record<string, string> = {
  robust:   'bg-amber-500/10 text-amber-600 border-amber-300/40',
  standard: 'bg-blue-500/10 text-blue-600 border-blue-300/40',
  minmax:   'bg-violet-500/10 text-violet-600 border-violet-300/40',
  maxabs:   'bg-pink-500/10 text-pink-600 border-pink-300/40',
  none:     'bg-muted/60 text-muted-foreground border-border/40',
};
const IMPUTATION_COLORS: Record<string, string> = {
  median:        'bg-orange-500/10 text-orange-600 border-orange-300/40',
  mean:          'bg-sky-500/10 text-sky-600 border-sky-300/40',
  most_frequent: 'bg-teal-500/10 text-teal-600 border-teal-300/40',
  none:          'bg-muted/60 text-muted-foreground border-border/40',
};

function Chip({ label, colors }: { label: string; colors: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${colors}`}>
      {label}
    </span>
  );
}

// ── Per-column recommendation logic ───────────────────────────────────────────

function colPowerTransform(stat: ColumnDistributionStat): TrainingPreprocessingDefaults['numericPowerTransform'] {
  if (stat.is_normal_practical) return 'none';
  return stat.recommended_transform as TrainingPreprocessingDefaults['numericPowerTransform'];
}

function colScaling(stat: ColumnDistributionStat): TrainingPreprocessingDefaults['numericScaling'] {
  if (stat.is_normal_practical) return 'standard';
  if (stat.distribution_shape === 'heavy_tailed') return 'robust';
  return stat.skewness_level === 'mild' ? 'robust' : 'standard';
}

function colImputation(stat: ColumnDistributionStat): TrainingPreprocessingDefaults['numericImputation'] {
  if (!stat.has_missing) return 'none';
  return stat.abs_skewness >= 0.75 ? 'median' : 'mean';
}

function buildPerColumnRecs(profile: DatasetProfile): Record<string, PerColumnRecommendation> {
  const result: Record<string, PerColumnRecommendation> = {};
  for (const [col, stat] of Object.entries(profile.column_distribution ?? {})) {
    result[col] = {
      powerTransform: colPowerTransform(stat),
      scaling: colScaling(stat),
      imputation: colImputation(stat),
    };
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DistributionInsightBanner({
  projectId,
  versionId,
  targetColumn,
  currentColumns,
  onProfileLoaded,
  onApplyPerColumn,
}: DistributionInsightBannerProps) {
  const [state, setState] = useState<FetchState>('idle');
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [applied, setApplied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ready = Boolean(versionId) && Boolean(targetColumn?.trim());

  useEffect(() => {
    if (!ready) {
      setState('idle');
      setProfile(null);
      setApplied(false);
      setDismissed(false);
      return;
    }

    setState('loading');
    setProfile(null);
    setApplied(false);
    setDismissed(false);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    trainingService
      .profileDataset(projectId, versionId!, targetColumn!.trim(), { signal: ctrl.signal })
      .then((p) => { if (!ctrl.signal.aborted) { setProfile(p); setState('done'); onProfileLoaded?.(p); } })
      .catch(() => { if (!ctrl.signal.aborted) setState('error'); });

    return () => ctrl.abort();
  }, [projectId, versionId, targetColumn, ready]);

  if (!ready || dismissed) return null;

  if (state === 'loading') {
    return (
      <Card className="glass-premium shadow-card border-primary/20">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (state === 'error' || !profile) return null;

  const colRecs = buildPerColumnRecs(profile);
  const colEntries = Object.entries(colRecs);
  const hasColDist = colEntries.length > 0;

  const handleApplyPerColumn = () => {
    const configs: Record<string, { numericPowerTransform?: string; numericScaling?: string; numericImputation?: string }> = {};
    for (const [col, rec] of Object.entries(colRecs)) {
      const current = currentColumns[col] ?? {};
      const entry: Record<string, string> = {};
      if (current.numericPowerTransform !== rec.powerTransform) entry.numericPowerTransform = rec.powerTransform;
      if (current.numericScaling !== rec.scaling) entry.numericScaling = rec.scaling;
      if (current.numericImputation !== rec.imputation) entry.numericImputation = rec.imputation;
      if (Object.keys(entry).length) configs[col] = entry;
    }
    if (Object.keys(configs).length) {
      onApplyPerColumn(
        configs as Record<string, {
          numericPowerTransform?: TrainingPreprocessingDefaults['numericPowerTransform'];
          numericScaling?: TrainingPreprocessingDefaults['numericScaling'];
          numericImputation?: TrainingPreprocessingDefaults['numericImputation'];
        }>,
      );
    }
    setApplied(true);
  };

  return (
    <Card className="glass-premium shadow-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          Analyse de distribution
          <div className="ml-auto flex items-center gap-1">
            {hasColDist && (
              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => setShowTable(v => !v)}>
                {showTable ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showTable ? 'Masquer' : 'Détails par colonne'}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => setDismissed(true)} title="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Non-normales</p>
            <p className="text-lg font-bold">{Math.round(profile.non_normal_ratio * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">des features</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Skewness moy.</p>
            <p className={`text-lg font-bold ${profile.avg_skewness >= 1.5 ? 'text-amber-500' : ''}`}>
              {profile.avg_skewness.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">|skewness|</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Très asymétriques</p>
            <p className={`text-lg font-bold ${profile.highly_skewed_count > 0 ? 'text-amber-500' : ''}`}>
              {profile.highly_skewed_count}
            </p>
            <p className="text-[10px] text-muted-foreground">cols (|sk| ≥ 1.5)</p>
          </div>
        </div>

        {/* Per-column detail table */}
        {showTable && hasColDist && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 sticky top-0">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Colonne</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Normalité</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Skewness</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Transformation</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Normalisation</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Imputation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {colEntries.map(([col, rec]) => {
                    const stat = profile.column_distribution[col];
                    return (
                      <tr key={col}>
                        <td className="px-3 py-1.5 font-mono truncate max-w-[120px]" title={col}>{col}</td>
                        <td className="px-2 py-1.5 text-center">
                          {stat.is_normal_practical
                            ? <span className="text-emerald-600 font-medium">Pratique</span>
                            : <span className="text-rose-500 font-medium">Non-normale</span>}
                        </td>
                        <td className={`px-2 py-1.5 text-center font-mono ${stat.abs_skewness >= 1.5 ? 'text-amber-500 font-semibold' : ''}`}>
                          {stat.skewness.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <Chip label={TRANSFORM_LABELS[rec.powerTransform] ?? rec.powerTransform} colors={TRANSFORM_COLORS[rec.powerTransform] ?? TRANSFORM_COLORS.none} />
                            {stat.has_non_positive && rec.powerTransform === 'box_cox' && (
                              <span className="text-[10px] text-destructive font-semibold">X&lt;0 !</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Chip label={SCALING_LABELS[rec.scaling] ?? rec.scaling} colors={SCALING_COLORS[rec.scaling] ?? SCALING_COLORS.none} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Chip label={IMPUTATION_LABELS[rec.imputation] ?? rec.imputation} colors={IMPUTATION_COLORS[rec.imputation] ?? IMPUTATION_COLORS.none} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action */}
        <div className="flex items-center justify-end gap-2">
          {applied && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Appliqué par colonne
            </span>
          )}
          {hasColDist && (
            <Button type="button" size="sm" variant="default"
              disabled={applied}
              onClick={handleApplyPerColumn}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Appliquer par colonne
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
