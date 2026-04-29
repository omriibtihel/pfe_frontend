import { useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Award,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Bot,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  Gauge,
  Loader2,
  Sigma,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricType, ModelResult } from '@/types';
import {
  humanizeWarning,
  modelColors,
  selectComparisonMetrics,
  toNumber,
  toPercent,
  toSeconds,
} from './trainingResultsHelpers';
import { metricDirection } from '@/utils/metricUtils';
import { ModelDetailModal } from './ModelDetailModal';

const AMBER_WARNING_KEYS = new Set([
  'threshold_calibrated_on_train_data_may_be_optimistic',
]);

const INFO_WARNING_KEYS = new Set([
  'threshold_optimization_disabled_multiclass',
  'threshold_optimization_skipped_no_validation_data',
  'threshold_optimization_skipped_predict_proba_not_available',
]);

const EVAL_SOURCE_CONFIG: Record<string, {
  label: string;
  colorClass: string;
  icon: string;
}> = {
  holdout_test: {
    label: "Test holdout",
    colorClass: "text-green-600 bg-green-50 border-green-200",
    icon: "✅"
  },
  cv_mean: {
    label: "Moyenne CV",
    colorClass: "text-blue-600 bg-blue-50 border-blue-200",
    icon: "🔄"
  },
  loo: {
    label: "LOO",
    colorClass: "text-blue-600 bg-blue-50 border-blue-200",
    icon: "🔄"
  },
  validation: {
    label: "Validation",
    colorClass: "text-orange-600 bg-orange-50 border-orange-200",
    icon: "⚠️"
  },
  train_only: {
    label: "Entraînement uniquement",
    colorClass: "text-red-600 bg-red-50 border-red-200",
    icon: "!"
  },
  unknown: {
    label: "Source inconnue",
    colorClass: "text-gray-500 bg-gray-50 border-gray-200",
    icon: "❓"
  },
};

interface ModelResultCardProps {
  result: ModelResult;
  index: number;
  isBestModel: boolean;
  sessionId: string;
  projectId: string;
  selectedMetrics?: MetricType[] | null;
  isActive?: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
  onSaveModel: (modelId: string) => void;
}

const METRIC_DECIMAL_KEYS = new Set(['r2', 'rmse', 'mae', 'mse']);

function formatComparisonMetric(metric: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return METRIC_DECIMAL_KEYS.has(metric) ? toNumber(value) : toPercent(value);
}

type MetricAccent = {
  text: string;
  bar: string;
  glow: string;
  iconBg: string;
  ring: string;
};

type IconType = ComponentType<{ className?: string }>;

const ACCENT_PRESETS: Record<string, MetricAccent> = {
  slate:   { text: 'text-slate-700 dark:text-slate-300',     bar: 'bg-slate-400',   glow: 'bg-slate-200/60 dark:bg-slate-700/30',  iconBg: 'bg-slate-100 dark:bg-slate-800/40',   ring: 'group-hover:ring-slate-300/60 dark:group-hover:ring-slate-600/40' },
  blue:    { text: 'text-blue-700 dark:text-blue-300',       bar: 'bg-blue-400',    glow: 'bg-blue-200/60 dark:bg-blue-800/30',    iconBg: 'bg-blue-50 dark:bg-blue-900/30',      ring: 'group-hover:ring-blue-300/60 dark:group-hover:ring-blue-700/40' },
  sky:     { text: 'text-sky-700 dark:text-sky-300',         bar: 'bg-sky-400',     glow: 'bg-sky-200/60 dark:bg-sky-800/30',      iconBg: 'bg-sky-50 dark:bg-sky-900/30',        ring: 'group-hover:ring-sky-300/60 dark:group-hover:ring-sky-700/40' },
  cyan:    { text: 'text-cyan-700 dark:text-cyan-300',       bar: 'bg-cyan-400',    glow: 'bg-cyan-200/60 dark:bg-cyan-800/30',    iconBg: 'bg-cyan-50 dark:bg-cyan-900/30',      ring: 'group-hover:ring-cyan-300/60 dark:group-hover:ring-cyan-700/40' },
  teal:    { text: 'text-teal-700 dark:text-teal-300',       bar: 'bg-teal-400',    glow: 'bg-teal-200/60 dark:bg-teal-800/30',    iconBg: 'bg-teal-50 dark:bg-teal-900/30',      ring: 'group-hover:ring-teal-300/60 dark:group-hover:ring-teal-700/40' },
  emerald: { text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-400', glow: 'bg-emerald-200/60 dark:bg-emerald-800/30', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'group-hover:ring-emerald-300/60 dark:group-hover:ring-emerald-700/40' },
  indigo:  { text: 'text-indigo-700 dark:text-indigo-300',   bar: 'bg-indigo-400',  glow: 'bg-indigo-200/60 dark:bg-indigo-800/30', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',  ring: 'group-hover:ring-indigo-300/60 dark:group-hover:ring-indigo-700/40' },
  stone:   { text: 'text-stone-700 dark:text-stone-300',     bar: 'bg-stone-400',   glow: 'bg-stone-200/60 dark:bg-stone-700/30',  iconBg: 'bg-stone-100 dark:bg-stone-800/40',   ring: 'group-hover:ring-stone-300/60 dark:group-hover:ring-stone-600/40' },
};

const METRIC_THEME: Record<string, { color: keyof typeof ACCENT_PRESETS; icon: IconType }> = {
  accuracy:           { color: 'slate',   icon: Target },
  precision:          { color: 'indigo',  icon: Crosshair },
  recall:             { color: 'teal',    icon: Eye },
  f1:                 { color: 'blue',    icon: Award },
  roc_auc:            { color: 'cyan',    icon: Activity },
  pr_auc:             { color: 'sky',     icon: TrendingUp },
  f1_pos:             { color: 'emerald', icon: Zap },
  f1_macro:           { color: 'blue',    icon: Sigma },
  f1_weighted:        { color: 'blue',    icon: Sigma },
  f1_micro:           { color: 'blue',    icon: Sigma },
  precision_macro:    { color: 'indigo',  icon: Sigma },
  precision_weighted: { color: 'indigo',  icon: Sigma },
  precision_micro:    { color: 'indigo',  icon: Sigma },
  recall_macro:       { color: 'teal',    icon: Sigma },
  recall_weighted:    { color: 'teal',    icon: Sigma },
  recall_micro:       { color: 'teal',    icon: Sigma },
  r2:                 { color: 'emerald', icon: BarChart3 },
  rmse:               { color: 'stone',   icon: Gauge },
  mae:                { color: 'stone',   icon: Gauge },
  mse:                { color: 'stone',   icon: Gauge },
};

const RATIO_LIKE_METRICS = new Set([
  'accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'pr_auc',
  'f1_pos', 'f1_macro', 'f1_weighted', 'f1_micro',
  'precision_macro', 'precision_weighted', 'precision_micro',
  'recall_macro', 'recall_weighted', 'recall_micro',
  'r2',
]);

export function ModelResultCard({
  result,
  index,
  isBestModel,
  sessionId,
  projectId,
  selectedMetrics,
  isActive = false,
  isSaved = false,
  isSaving = false,
  onSaveModel,
}: ModelResultCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const color = modelColors[result.modelType] ?? 'from-slate-500 to-slate-600';
  const isAutomlNonBest = Boolean(result.automl && !result.automl.isBest);
  const isRegression = result.taskType === 'regression';

  const comparisonMetrics = selectComparisonMetrics(
    selectedMetrics,
    isRegression ? 'regression' : 'classification',
    6,
  );
  const primaryName = (result.primaryMetric.name ?? '').toLowerCase();
  const metricStatus = result.primaryMetric.status ?? 'success';
  const showCvLabel = Boolean(result.testIsCvMean ?? (result.isCV && !result.hasHoldoutTest));

  return (
    <>
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
                <CardTitle className="text-sm font-semibold">
                  {result.modelType.toUpperCase()}
                </CardTitle>
                {isBestModel && (
                  <Badge className="bg-amber-500 text-[11px] text-white">Meilleur</Badge>
                )}
                {isActive && (
                  <Badge className="gap-1 text-[11px] bg-primary text-primary-foreground">
                    <Zap className="h-2.5 w-2.5" aria-hidden="true" /> Actif
                  </Badge>
                )}
                {result.automl && (
                  <Badge
                    variant="outline"
                    className="gap-1 text-[11px] border-violet-500 text-violet-700 dark:text-violet-400"
                  >
                    <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                    {result.automl.bestEstimator ?? 'AutoML'}
                  </Badge>
                )}
                {isAutomlNonBest && (
                  <Badge
                    variant="outline"
                    className="text-[11px] border-muted-foreground/40 text-muted-foreground"
                  >
                    Comparaison
                  </Badge>
                )}
                {result.isCV && (
                  <Badge variant="outline" className="text-[11px]">
                    CV
                  </Badge>
                )}
                {result.evaluationSource && (() => {
                  const cfg = EVAL_SOURCE_CONFIG[result.evaluationSource.type]
                    ?? EVAL_SOURCE_CONFIG.unknown;
                  return (
                    <span className={`text-xs border rounded px-1.5 py-0.5 font-medium ${cfg.colorClass}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  );
                })()}
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

          <CardContent className="space-y-4 pb-4">
            {comparisonMetrics.length > 0 ? (
              <section
                aria-label="Métriques"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {comparisonMetrics.map((m, idx) => {
                  const isPrimary = m.metric === primaryName;
                  const status = isPrimary ? metricStatus : 'success';
                  const rawValue = result.metrics?.[m.summaryKey];
                  const numericValue =
                    typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
                  const display =
                    status === 'error'
                      ? '—'
                      : status === 'not_applicable'
                        ? 'N/A'
                        : formatComparisonMetric(m.metric, numericValue);
                  const direction = metricDirection(m.metric);
                  const DirectionIcon = direction === 'lower_is_better' ? ChevronDown : ChevronUp;
                  const directionTitle =
                    direction === 'lower_is_better' ? 'Plus bas = mieux' : 'Plus haut = mieux';
                  const theme = METRIC_THEME[m.metric] ?? { color: 'slate' as const, icon: Sigma };
                  const accent = ACCENT_PRESETS[theme.color];
                  const Icon = theme.icon;
                  const valueColor = status === 'success' ? accent.text : 'text-muted-foreground';

                  const showProgress =
                    status === 'success' &&
                    numericValue != null &&
                    RATIO_LIKE_METRICS.has(m.metric);
                  const progressPct = showProgress
                    ? Math.max(0, Math.min(100, numericValue * 100))
                    : 0;

                  return (
                    <motion.div
                      key={m.metric}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + idx * 0.04, duration: 0.25, ease: 'easeOut' }}
                      whileHover={{ y: -3 }}
                      className={`group relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm ring-1 ring-transparent transition-[box-shadow,ring] duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:ring-2 ${accent.ring}`}
                    >
                      <span
                        className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-80 ${accent.glow}`}
                        aria-hidden="true"
                      />

                      <div className="relative flex items-start justify-between">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent.iconBg}`}>
                          <Icon className={`h-3.5 w-3.5 ${accent.text}`} />
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full opacity-60 transition-opacity group-hover:opacity-100 ${accent.text}`}
                              aria-label={directionTitle}
                            >
                              <DirectionIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{directionTitle}</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="relative mt-2 space-y-0.5">
                        <p className={`text-2xl font-bold tracking-tight tabular-nums leading-none ${valueColor}`}>
                          {display}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                          {m.label}
                        </p>
                      </div>

                      {showProgress && (
                        <div className="relative mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted/60">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ delay: 0.25 + idx * 0.04, duration: 0.7, ease: 'easeOut' }}
                            className={`h-full rounded-full ${accent.bar}`}
                          />
                        </div>
                      )}

                      {isPrimary && status === 'error' && (
                        <Badge className="relative mt-1.5 bg-destructive text-[9px] text-destructive-foreground">
                          Erreur
                        </Badge>
                      )}
                      {isPrimary && showCvLabel && status === 'success' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="relative mt-1 inline-block cursor-help text-[9px] text-muted-foreground/70 underline decoration-dotted underline-offset-2">
                              CV val.
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            Moyenne des scores de validation des folds CV. Pas un jeu de test indépendant.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </motion.div>
                  );
                })}
              </section>
            ) : null}

            {result.evaluationSource && !result.evaluationSource.isIndependentTest && (
              <p className="text-xs text-orange-600 mt-1 italic">
                Pas de jeu de test indépendant — score = {result.evaluationSource.label}
              </p>
            )}

            {result.warnings && result.warnings.length > 0 && (() => {
              const amberWarnings = result.warnings!.filter((w) => AMBER_WARNING_KEYS.has(w));
              const infoWarnings = result.warnings!.filter((w) => INFO_WARNING_KEYS.has(w));
              if (amberWarnings.length === 0 && infoWarnings.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {amberWarnings.map((w) => (
                    <Tooltip key={w}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help items-center rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠ Seuil optimiste
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {humanizeWarning(w)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {infoWarnings.map((w) => (
                    <Tooltip key={w}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help items-center rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                          ℹ {humanizeWarning(w).split(' — ')[0].split(':')[0]}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {humanizeWarning(w)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              );
            })()}

            {/* Boutons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setDetailOpen(true)}
                aria-label={`Voir les détails de ${result.modelType.toUpperCase()}`}
              >
                Voir les détails
              </Button>

              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                variant={isSaved ? 'secondary' : 'default'}
                disabled={isSaving || isAutomlNonBest}
                onClick={() => onSaveModel(result.id)}
                title={
                  isAutomlNonBest
                    ? 'Ce modèle est affiché à titre comparatif uniquement. Seul le meilleur modèle AutoML peut être sauvegardé.'
                    : undefined
                }
                aria-label={
                  isAutomlNonBest
                    ? `${result.modelType.toUpperCase()} — comparaison uniquement`
                    : isSaving
                      ? 'Enregistrement en cours...'
                      : isSaved
                        ? `Retirer ${result.modelType.toUpperCase()} des modèles sauvegardés`
                        : `Sauvegarder ${result.modelType.toUpperCase()} pour les prédictions`
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Enregistrement...
                  </>
                ) : isSaved ? (
                  <>
                    <BookmarkCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Sauvegardé
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.article>

      {detailOpen && (
        <ModelDetailModal
          result={result}
          sessionId={sessionId}
          projectId={projectId}
          isRegression={isRegression}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}
