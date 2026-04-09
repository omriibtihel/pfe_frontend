import { useEffect, useRef, useState } from 'react';
import {
  BarChart2, CheckCircle2, ChevronDown, ChevronUp, Sparkles, X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
  currentDefaults: TrainingPreprocessingDefaults;
  currentColumns: Record<string, TrainingPreprocessingColumnConfig>;
  /** Called when the profile is successfully fetched — lets parent access has_negative per column */
  onProfileLoaded?: (profile: DatasetProfile) => void;
  onApplyGlobalDefaults: (
    powerTransform: TrainingPreprocessingDefaults['numericPowerTransform'],
    scaling: TrainingPreprocessingDefaults['numericScaling'],
    imputation: TrainingPreprocessingDefaults['numericImputation'],
  ) => void;
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

const SCALING_LABELS: Record<string, string> = {
  none: 'Aucun', standard: 'Standard (z-score)', robust: 'Robust (IQR)',
  minmax: 'MinMax', maxabs: 'MaxAbs',
  yeo_johnson: 'Yeo-Johnson', box_cox: 'Box-Cox',
};
const IMPUTATION_LABELS: Record<string, string> = {
  none: 'Aucun', mean: 'Moyenne', median: 'Médiane', most_frequent: 'Fréquent',
};
const SCALING_COLORS: Record<string, string> = {
  yeo_johnson: 'bg-emerald-500/10 text-emerald-600 border-emerald-300/40',
  box_cox:     'bg-cyan-500/10 text-cyan-600 border-cyan-300/40',
  robust:                 'bg-amber-500/10 text-amber-600 border-amber-300/40',
  standard:               'bg-blue-500/10 text-blue-600 border-blue-300/40',
  minmax:                 'bg-violet-500/10 text-violet-600 border-violet-300/40',
  none:                   'bg-muted/60 text-muted-foreground border-border/40',
};
const IMPUTATION_COLORS: Record<string, string> = {
  median:       'bg-orange-500/10 text-orange-600 border-orange-300/40',
  mean:         'bg-sky-500/10 text-sky-600 border-sky-300/40',
  most_frequent:'bg-teal-500/10 text-teal-600 border-teal-300/40',
  none:         'bg-muted/60 text-muted-foreground border-border/40',
};

function Chip({ label, colors }: { label: string; colors: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${colors}`}>
      {label}
    </span>
  );
}

// ── Per-column recommendation logic (mirrors backend exactly) ─────────────────

function colPowerTransform(stat: ColumnDistributionStat): TrainingPreprocessingDefaults['numericPowerTransform'] {
  return stat.is_normal ? 'none' : 'yeo_johnson';
}

function colScaling(stat: ColumnDistributionStat): TrainingPreprocessingDefaults['numericScaling'] {
  if (!stat.is_normal) return 'standard';            // après yeo_johnson → ~Gaussien
  if (stat.abs_skewness >= 1.0) return 'robust';    // normal mais outliers
  return 'standard';
}

function colImputation(stat: ColumnDistributionStat): TrainingPreprocessingDefaults['numericImputation'] {
  if (!stat.has_missing) return 'none';
  return stat.abs_skewness >= 0.75 ? 'median' : 'mean';
}

function buildPerColumnRecs(
  profile: DatasetProfile,
): Record<string, PerColumnRecommendation> {
  const result: Record<string, PerColumnRecommendation> = {};
  for (const [col, stat] of Object.entries(profile.column_distribution ?? {})) {
    result[col] = { powerTransform: colPowerTransform(stat), scaling: colScaling(stat), imputation: colImputation(stat) };
  }
  return result;
}

function globalDefault(profile: DatasetProfile): {
  powerTransform: TrainingPreprocessingDefaults['numericPowerTransform'];
  scaling: TrainingPreprocessingDefaults['numericScaling'];
  imputation: TrainingPreprocessingDefaults['numericImputation'];
} {
  const { non_normal_ratio: nnr, avg_skewness: sk, has_missing_values, column_distribution } = profile;

  let powerTransform: TrainingPreprocessingDefaults['numericPowerTransform'];
  let scaling: TrainingPreprocessingDefaults['numericScaling'];

  if (Object.keys(column_distribution ?? {}).length > 0) {
    const ptCounts: Record<string, number> = {};
    const scCounts: Record<string, number> = {};
    for (const stat of Object.values(column_distribution)) {
      const pt = colPowerTransform(stat);
      const s  = colScaling(stat);
      ptCounts[pt] = (ptCounts[pt] ?? 0) + 1;
      scCounts[s]  = (scCounts[s]  ?? 0) + 1;
    }
    powerTransform = Object.entries(ptCounts).sort((a, b) => b[1] - a[1])[0][0] as TrainingPreprocessingDefaults['numericPowerTransform'];
    scaling        = Object.entries(scCounts).sort((a, b) => b[1] - a[1])[0][0] as TrainingPreprocessingDefaults['numericScaling'];
  } else if (nnr === 0 && sk === 0) {
    powerTransform = 'none'; scaling = 'none';
  } else if (nnr > 0) {
    powerTransform = 'yeo_johnson'; scaling = 'standard';
  } else if (sk >= 1.0) {
    powerTransform = 'none'; scaling = 'robust';
  } else {
    powerTransform = 'none'; scaling = 'standard';
  }

  const imputation: TrainingPreprocessingDefaults['numericImputation'] =
    !has_missing_values ? 'none' : sk >= 0.75 ? 'median' : 'mean';

  return { powerTransform, scaling, imputation };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DistributionInsightBanner({
  projectId,
  versionId,
  targetColumn,
  currentDefaults,
  currentColumns,
  onProfileLoaded,
  onApplyGlobalDefaults,
  onApplyPerColumn,
}: DistributionInsightBannerProps) {
  const [state, setState] = useState<FetchState>('idle');
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [appliedGlobal, setAppliedGlobal] = useState(false);
  const [appliedPerCol, setAppliedPerCol] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ready = Boolean(versionId) && Boolean(targetColumn?.trim());

  useEffect(() => {
    if (!ready) {
      setState('idle');
      setProfile(null);
      setAppliedGlobal(false);
      setAppliedPerCol(false);
      setDismissed(false);
      return;
    }

    setState('loading');
    setProfile(null);
    setAppliedGlobal(false);
    setAppliedPerCol(false);
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
  const globalRec = globalDefault(profile);
  const colEntries = Object.entries(colRecs);
  const hasColDist = colEntries.length > 0;

  // Columns whose individual recommendation differs from the global default
  const overrideCount = colEntries.filter(
    ([, rec]) => rec.powerTransform !== globalRec.powerTransform || rec.scaling !== globalRec.scaling || rec.imputation !== globalRec.imputation,
  ).length;

  const globalAlreadyApplied =
    currentDefaults.numericPowerTransform === globalRec.powerTransform &&
    currentDefaults.numericScaling === globalRec.scaling &&
    currentDefaults.numericImputation === globalRec.imputation;

  const handleApplyGlobal = () => {
    onApplyGlobalDefaults(globalRec.powerTransform, globalRec.scaling, globalRec.imputation);
    setAppliedGlobal(true);
    setAppliedPerCol(false);
  };

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
    if (Object.keys(configs).length) onApplyPerColumn(configs);
    setAppliedPerCol(true);
    setAppliedGlobal(false);
  };

  return (
    <Card className="glass-premium shadow-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          Analyse de distribution
          {hasColDist && overrideCount > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">
              {overrideCount} colonne{overrideCount > 1 ? 's' : ''} différentes du défaut
            </Badge>
          )}
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

        {/* Global default recommendation */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-semibold text-primary">Recommandation globale (défauts)</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Transformation :</span>
            <Chip label={SCALING_LABELS[globalRec.powerTransform] ?? globalRec.powerTransform} colors={SCALING_COLORS[globalRec.powerTransform] ?? SCALING_COLORS.none} />
            <span className="text-muted-foreground text-xs ml-1">Normalisation :</span>
            <Chip label={SCALING_LABELS[globalRec.scaling] ?? globalRec.scaling} colors={SCALING_COLORS[globalRec.scaling] ?? SCALING_COLORS.none} />
            <span className="text-muted-foreground text-xs ml-1">Imputation :</span>
            <Chip label={IMPUTATION_LABELS[globalRec.imputation] ?? globalRec.imputation} colors={IMPUTATION_COLORS[globalRec.imputation] ?? IMPUTATION_COLORS.none} />
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
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Manquants</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Transformation</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Normalisation</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground">Imputation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {colEntries.map(([col, rec]) => {
                    const stat = profile.column_distribution[col];
                    const differsFromGlobal = rec.powerTransform !== globalRec.powerTransform || rec.scaling !== globalRec.scaling || rec.imputation !== globalRec.imputation;
                    return (
                      <tr key={col} className={differsFromGlobal ? 'bg-amber-500/5' : ''}>
                        <td className="px-3 py-1.5 font-mono truncate max-w-[120px]" title={col}>
                          {col}
                          {differsFromGlobal && <span className="ml-1 text-amber-500">*</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {stat.is_normal
                            ? <span className="text-emerald-600 font-medium">Normale</span>
                            : <span className="text-rose-500 font-medium">Non-normale</span>}
                        </td>
                        <td className={`px-2 py-1.5 text-center font-mono ${stat.abs_skewness >= 1.5 ? 'text-amber-500 font-semibold' : ''}`}>
                          {stat.skewness.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {stat.has_missing
                            ? <span className="text-orange-500">Oui</span>
                            : <span className="text-muted-foreground">Non</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <Chip label={SCALING_LABELS[rec.powerTransform] ?? rec.powerTransform} colors={SCALING_COLORS[rec.powerTransform] ?? SCALING_COLORS.none} />
                            {stat.has_negative && rec.powerTransform === 'box_cox' && (
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
            {overrideCount > 0 && (
              <p className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/40">
                * Les colonnes marquées ont une recommandation individuelle différente du défaut global.
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {(appliedGlobal || appliedPerCol) && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {appliedPerCol ? 'Appliqué par colonne' : 'Appliqué aux défauts'}
            </span>
          )}
          <Button type="button" size="sm" variant="outline"
            disabled={globalAlreadyApplied || appliedGlobal}
            onClick={handleApplyGlobal}
            title="Applique la recommandation globale aux paramètres par défaut">
            Appliquer aux défauts
          </Button>
          {hasColDist && (
            <Button type="button" size="sm" variant="default"
              disabled={appliedPerCol}
              onClick={handleApplyPerColumn}
              title={`Applique la recommandation individuelle à chaque colonne${overrideCount > 0 ? ` (${overrideCount} surcharge${overrideCount > 1 ? 's' : ''})` : ''}`}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Appliquer par colonne
              {overrideCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">{overrideCount}</Badge>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
