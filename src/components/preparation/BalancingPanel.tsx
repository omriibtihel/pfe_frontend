import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { MedHelp } from "@/components/ui/med-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trainingService } from "@/services/trainingService";
import type {
  TrainingBalanceAnalysis,
  TrainingBalancingConfig,
  TrainingBalancingStrategy,
  TrainingThresholdStrategy,
} from "@/types";
import { DEFAULT_TRAINING_BALANCING } from "@/types";
import { cn } from "@/lib/utils";
import { humanizeWarning } from "@/components/training/results/trainingResultsHelpers";

export interface BalancingPanelConfig {
  datasetVersionId: string;
  targetColumn: string;
  taskType: "classification" | "regression";
  balancing?: TrainingBalancingConfig;
  useSmote: boolean;
}

interface BalancingPanelProps {
  projectId: string;
  config: BalancingPanelConfig;
  onConfigChange: (updates: { balancing?: TrainingBalancingConfig; useSmote?: boolean }) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  balanced: "text-emerald-600 dark:text-emerald-400",
  mild: "text-sky-600 dark:text-sky-400",
  moderate: "text-amber-600 dark:text-amber-400",
  severe: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

const SCALE_KEYS: Record<string, string> = {
  tiny: "preparation.balancing.scaleTiny",
  small: "preparation.balancing.scaleSmall",
  medium: "preparation.balancing.scaleMedium",
  large: "preparation.balancing.scaleLarge",
};

const FALLBACK_STRATEGY_IDS: TrainingBalancingStrategy[] = [
  "none",
  "class_weight",
  "smote",
  "smote_tomek",
  "random_undersampling",
  "threshold_optimization",
];

const THRESHOLD_STRATEGY_IDS: TrainingThresholdStrategy[] = [
  "youden",
  "maximize_f1",
  "maximize_f2",
  "maximize_f_beta",
  "minimize_cost",
  "min_recall",
  "precision_recall_balance",
];

function isSmoteStrategy(strategy: TrainingBalancingStrategy): boolean {
  return strategy === "smote" || strategy === "smote_tomek";
}

export function BalancingPanel({ projectId, config, onConfigChange }: BalancingPanelProps) {
  const { t } = useTranslation();
  const [balanceAnalysis, setBalanceAnalysis] = useState<TrainingBalanceAnalysis | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [pendingStrategy, setPendingStrategy] = useState<TrainingBalancingStrategy | null>(null);

  const balancing: TrainingBalancingConfig = useMemo(
    () => ({
      strategy: config.balancing?.strategy ?? (config.useSmote ? "smote" : DEFAULT_TRAINING_BALANCING.strategy),
      applyThreshold: Boolean(config.balancing?.applyThreshold),
      thresholdStrategy: config.balancing?.thresholdStrategy ?? DEFAULT_TRAINING_BALANCING.thresholdStrategy,
      minRecallConstraint:
        typeof config.balancing?.minRecallConstraint === "number"
          ? config.balancing.minRecallConstraint
          : DEFAULT_TRAINING_BALANCING.minRecallConstraint,
      fBeta: typeof config.balancing?.fBeta === "number" ? config.balancing.fBeta : 2.0,
      costFn: typeof config.balancing?.costFn === "number" ? config.balancing.costFn : 1.0,
      costFp: typeof config.balancing?.costFp === "number" ? config.balancing.costFp : 1.0,
    }),
    [config.balancing, config.useSmote]
  );

  const applyBalancing = (updates: Partial<TrainingBalancingConfig>) => {
    const next: TrainingBalancingConfig = { ...balancing, ...updates };
    if (next.strategy === "threshold_optimization") {
      next.applyThreshold = true;
    }
    onConfigChange({ balancing: next, useSmote: isSmoteStrategy(next.strategy) });
  };

  const handleStrategyChange = (value: TrainingBalancingStrategy) => {
    if (balanceAnalysis && !balanceAnalysis.needs_balancing && value !== "none") {
      setPendingStrategy(value);
      return;
    }
    applyBalancing({ strategy: value });
  };

  useEffect(() => {
    let mounted = true;
    const versionId = String(config.datasetVersionId ?? "").trim();
    const target = String(config.targetColumn ?? "").trim();
    if (config.taskType !== "classification" || !versionId || !target) {
      setBalanceAnalysis(null);
      setBalanceError(null);
      setBalanceLoading(false);
      return () => { mounted = false; };
    }

    const fetchAnalysis = async () => {
      setBalanceLoading(true);
      try {
        const out = await trainingService.analyzeBalance(projectId, versionId, target);
        if (!mounted) return;
        setBalanceAnalysis(out);
        setBalanceError(null);
      } catch (e: unknown) {
        if (!mounted) return;
        setBalanceAnalysis(null);
        setBalanceError(e instanceof Error ? e.message : t("preparation.balancing.analysisError"));
      } finally {
        if (mounted) setBalanceLoading(false);
      }
    };
    fetchAnalysis();
    return () => { mounted = false; };
  }, [config.datasetVersionId, config.targetColumn, config.taskType, projectId]);

  useEffect(() => {
    if (!balanceAnalysis) return;
    const strategyMap = new Map(balanceAnalysis.available_strategies.map((item) => [item.id, item]));
    let changed = false;
    const next: TrainingBalancingConfig = { ...balancing };
    const currentStrategy = strategyMap.get(next.strategy);
    if (!currentStrategy || !currentStrategy.feasible) {
      next.strategy = balanceAnalysis.default_recommendation;
      changed = true;
    }
    if (next.strategy === "threshold_optimization" && !next.applyThreshold) {
      next.applyThreshold = true;
      changed = true;
    }
    if (changed) {
      onConfigChange({ balancing: next, useSmote: isSmoteStrategy(next.strategy) });
    }
  }, [balanceAnalysis, balancing, onConfigChange]);

  const currentStrategyInfo = useMemo(() => {
    if (!balanceAnalysis) return null;
    return balanceAnalysis.available_strategies.find((item) => item.id === balancing.strategy) ?? null;
  }, [balanceAnalysis, balancing.strategy]);

  return (
    <>
      <Card className="glass-premium shadow-card">
        <CardContent className="py-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{t("preparation.balancing.title")}</span>
              <Badge variant="outline" className="text-[10px]">
                {t("preparation.balancing.binaryBadge")}
              </Badge>
              <MedHelp title={t("preparation.balancing.helpTitle")}>
                <p>{t("preparation.balancing.helpP1")}</p>
                <p>
                  {t("preparation.balancing.helpP2Pre")}{" "}
                  <strong>{t("preparation.balancing.helpP2Bold")}</strong>{" "}
                  {t("preparation.balancing.helpP2Suf")}
                </p>
                <p>{t("preparation.balancing.helpP3")}</p>
              </MedHelp>
            </div>
            {config.taskType !== "classification" && (
              <p className="text-xs text-warning mt-1">{t("preparation.balancing.onlyClassification")}</p>
            )}
            {config.taskType === "classification" && balanceLoading && (
              <p className="text-xs text-muted-foreground mt-1">{t("preparation.balancing.analyzing")}</p>
            )}
            {config.taskType === "classification" && !balanceLoading && !!balanceError && (
              <p className="text-xs text-warning mt-1">{balanceError}</p>
            )}
            {config.taskType === "classification" && !balanceLoading && !!balanceAnalysis && (
              <div className="space-y-3 pt-1">

                {/* ── Distribution visuelle ── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("preparation.balancing.distTitle")}
                  </p>

                  {/* Barre empilée */}
                  <div
                    className="flex rounded-full overflow-hidden h-5 w-full border border-border/30"
                    title={`${String(balanceAnalysis.majority.label)}: ${(balanceAnalysis.majority.ratio * 100).toFixed(1)}% — ${String(balanceAnalysis.minority.label)}: ${(balanceAnalysis.minority.ratio * 100).toFixed(1)}%`}
                  >
                    <div
                      className="bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-[10px] font-semibold text-white transition-all"
                      style={{ width: `${balanceAnalysis.majority.ratio * 100}%` }}
                    >
                      {balanceAnalysis.majority.ratio >= 0.15 && `${(balanceAnalysis.majority.ratio * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-amber-400 dark:bg-amber-500 flex items-center justify-center text-[10px] font-semibold text-white transition-all"
                      style={{ width: `${balanceAnalysis.minority.ratio * 100}%` }}
                    >
                      {balanceAnalysis.minority.ratio >= 0.1 && `${(balanceAnalysis.minority.ratio * 100).toFixed(0)}%`}
                    </div>
                  </div>

                  {/* Légende classes */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 dark:bg-blue-600 shrink-0" />
                      <span className="font-semibold text-foreground truncate">
                        {String(balanceAnalysis.majority.label)}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {balanceAnalysis.majority.count.toLocaleString()} ({(balanceAnalysis.majority.ratio * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 justify-end">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 dark:bg-amber-500 shrink-0" />
                      <span className="font-semibold text-foreground truncate">
                        {String(balanceAnalysis.minority.label)}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {balanceAnalysis.minority.count.toLocaleString()} ({(balanceAnalysis.minority.ratio * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Stats condensées ── */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: t("preparation.balancing.total"), value: balanceAnalysis.n_samples.toLocaleString() },
                    {
                      label: t("preparation.balancing.ratioIR"),
                      value: `${Number(balanceAnalysis.imbalance_ratio).toFixed(1)} : 1`,
                    },
                    {
                      label: t("preparation.balancing.size"),
                      value: SCALE_KEYS[balanceAnalysis.dataset_scale]
                        ? t(SCALE_KEYS[balanceAnalysis.dataset_scale])
                        : balanceAnalysis.dataset_scale,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md bg-muted/40 px-2.5 py-1.5 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-xs font-semibold text-foreground leading-tight mt-0.5 truncate" title={value}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Niveau de déséquilibre + explication ── */}
                <div className={cn(
                  "rounded-lg border p-2.5 text-[11px] flex items-start gap-2",
                  balanceAnalysis.needs_balancing
                    ? "border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20"
                )}>
                  {balanceAnalysis.needs_balancing
                    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  }
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      <span className={LEVEL_COLORS[balanceAnalysis.imbalance_level] ?? ""}>
                        {t(`preparation.balancing.level.${balanceAnalysis.imbalance_level}`, balanceAnalysis.imbalance_level)}
                      </span>
                      {" — "}
                      {balanceAnalysis.needs_balancing
                        ? t("preparation.balancing.needsBalancing", {
                            ratio: Number(balanceAnalysis.imbalance_ratio).toFixed(1),
                            plural: Number(balanceAnalysis.imbalance_ratio) >= 2 ? "s" : "",
                            majority: String(balanceAnalysis.majority.label),
                            minority: String(balanceAnalysis.minority.label),
                          })
                        : t("preparation.balancing.balanced")
                      }
                    </p>
                    {balanceAnalysis.needs_balancing && (
                      <p className="text-muted-foreground">
                        {t("preparation.balancing.noBalanceHint", { majority: String(balanceAnalysis.majority.label) })}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Conseil métrique ── */}
                {balanceAnalysis.metric_advice?.length > 0 && (
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-500" />
                    <span>{balanceAnalysis.metric_advice[0]}</span>
                  </div>
                )}

              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">{t("preparation.balancing.strategyLabel")}</label>
            <Select
              value={balancing.strategy}
              onValueChange={(value) => handleStrategyChange(value as TrainingBalancingStrategy)}
              disabled={config.taskType !== "classification"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t("preparation.balancing.strategyPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(balanceAnalysis?.available_strategies
                  ?? FALLBACK_STRATEGY_IDS.map((id) => ({ id, label: t(`preparation.balancing.strategyFallback.${id}`) }))
                ).map((strategy) => (
                  <SelectItem
                    key={strategy.id}
                    value={strategy.id}
                    disabled={"feasible" in strategy ? !strategy.feasible : false}
                  >
                    <span className="flex items-center gap-2">
                      <span>{strategy.label}</span>
                      {"recommended" in strategy && strategy.recommended && (
                        <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 font-medium leading-none">
                          {t("preparation.balancing.recommended")}
                        </span>
                      )}
                      {"feasible" in strategy && !strategy.feasible && (
                        <span className="text-[10px] text-muted-foreground">{t("preparation.balancing.notFeasible")}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentStrategyInfo && !currentStrategyInfo.feasible && (
              <p className="text-[11px] text-destructive">
                {t("preparation.balancing.strategyNotFeasible", {
                  reason: currentStrategyInfo.infeasible_reason ?? t("preparation.balancing.defaultReason"),
                })}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/50 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={balancing.applyThreshold || balancing.strategy === "threshold_optimization"}
                disabled={config.taskType !== "classification" || balancing.strategy === "threshold_optimization"}
                onCheckedChange={(checked) => applyBalancing({ applyThreshold: Boolean(checked) })}
              />
              <span className="text-xs font-medium">{t("preparation.balancing.thresholdToggle")}</span>
              <MedHelp title={t("preparation.balancing.thresholdHelpTitle")}>
                <p>{t("preparation.balancing.thresholdHelpP1")}</p>
                <p>{t("preparation.balancing.thresholdHelpP2")}</p>
                <p>{t("preparation.balancing.thresholdHelpP3")}</p>
              </MedHelp>
            </label>
            {/* ── Bannière de guidance clinique — visible seulement si seuil activé ── */}
            {(balancing.applyThreshold || balancing.strategy === "threshold_optimization") && (
            <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20 p-3.5 flex gap-3">
              <Info className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
              <div className="space-y-1.5 text-[11px] text-sky-800 dark:text-sky-300">
                <p className="font-semibold">{t("preparation.balancing.bannerTitle")}</p>
                <ul className="space-y-1 text-sky-700 dark:text-sky-400">
                  <li>• <Trans i18nKey="preparation.balancing.bannerScreening" components={{ strong: <strong />, em: <em /> }} /></li>
                  <li>• <Trans i18nKey="preparation.balancing.bannerConfirm" components={{ strong: <strong />, em: <em /> }} /></li>
                  <li>• <Trans i18nKey="preparation.balancing.bannerRegulatory" components={{ strong: <strong />, em: <em /> }} /></li>
                  <li>• <Trans i18nKey="preparation.balancing.bannerGeneral" components={{ strong: <strong />, em: <em /> }} /></li>
                </ul>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] text-muted-foreground">{t("preparation.balancing.criterionLabel")}</label>
                <Select
                  value={balancing.thresholdStrategy}
                  onValueChange={(value) =>
                    applyBalancing({
                      thresholdStrategy: value as TrainingThresholdStrategy,
                      minRecallConstraint:
                        value === "min_recall" ? balancing.minRecallConstraint ?? 0.7 : null,
                    })
                  }
                  disabled={config.taskType !== "classification"}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THRESHOLD_STRATEGY_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {t(`preparation.balancing.thresholdStrategies.${id}.label`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Clinical explanation for selected strategy */}
                {THRESHOLD_STRATEGY_IDS.includes(balancing.thresholdStrategy) && (
                  <div className="rounded-md border border-sky-200/40 bg-sky-50/30 dark:border-sky-800/30 dark:bg-sky-950/20 px-2.5 py-2 mt-1.5 flex gap-2">
                    <Info className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed">
                      {t(`preparation.balancing.thresholdStrategies.${balancing.thresholdStrategy}.help`)}
                    </p>
                  </div>
                )}
              </div>
              {balancing.thresholdStrategy === "min_recall" && (
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">{t("preparation.balancing.minRecallLabel")}</label>
                  <Input
                    type="number"
                    step={0.01}
                    min={0.01}
                    max={0.99}
                    disabled={config.taskType !== "classification"}
                    value={balancing.minRecallConstraint ?? 0.7}
                    onChange={(e) =>
                      applyBalancing({
                        minRecallConstraint: Math.min(0.99, Math.max(0.01, Number(e.target.value) || 0.7)),
                      })
                    }
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t("preparation.balancing.minRecallHint")}
                  </p>
                </div>
              )}
            </div>

            {/* ── F-beta configurable ── */}
            {balancing.thresholdStrategy === "maximize_f_beta" && (
              <div className="mt-2 space-y-2 rounded-md border border-border/40 bg-muted/20 p-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-muted-foreground">
                    Beta&nbsp;=&nbsp;<span className="font-semibold text-foreground">{(balancing.fBeta ?? 2.0).toFixed(1)}</span>
                  </label>
                  <span className="text-[10px] font-medium text-primary">
                    {(balancing.fBeta ?? 2.0) < 0.8
                      ? t("preparation.balancing.betaDiagnostic")
                      : (balancing.fBeta ?? 2.0) < 1.2
                      ? t("preparation.balancing.betaBalanced")
                      : (balancing.fBeta ?? 2.0) < 2.5
                      ? t("preparation.balancing.betaScreening")
                      : t("preparation.balancing.betaMax")}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={balancing.fBeta ?? 2.0}
                  onChange={(e) => applyBalancing({ fBeta: parseFloat(e.target.value) })}
                  className="w-full accent-primary"
                  disabled={config.taskType !== "classification"}
                />
                {/* Repères cliniques nommés */}
                <div className="relative flex justify-between text-[9px] text-muted-foreground px-0.5">
                  {(["betaMark01", "betaMark1", "betaMark2", "betaMark5"] as const).map((k) => (
                    <span key={k} className="text-center whitespace-pre-line">{t(`preparation.balancing.${k}`)}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Coût asymétrique FN/FP ── */}
            {balancing.thresholdStrategy === "minimize_cost" && (
              <div className="mt-2 space-y-2 rounded-md border border-border/40 bg-muted/20 p-2.5">
                {/* Encadré d'ancrage clinique */}
                <div className="rounded-md bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 px-2.5 py-2 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  <Trans i18nKey="preparation.balancing.costAnchor" components={{ strong: <strong /> }} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    <Trans
                      i18nKey="preparation.balancing.costRatio"
                      components={{ strong: <strong className="font-semibold text-foreground" /> }}
                      values={{
                        ratio: ((balancing.costFn ?? 1) / Math.max(balancing.costFp ?? 1, 0.01)).toFixed(1),
                      }}
                    />
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      <Trans
                        i18nKey="preparation.balancing.costFnLabel"
                        components={{ strong: <span className="font-semibold text-foreground" /> }}
                        values={{ value: balancing.costFn ?? 1 }}
                      />
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={balancing.costFn ?? 1}
                      onChange={(e) => applyBalancing({ costFn: parseInt(e.target.value, 10) })}
                      className="w-full accent-destructive"
                      disabled={config.taskType !== "classification"}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1</span><span>20</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      <Trans
                        i18nKey="preparation.balancing.costFpLabel"
                        components={{ strong: <span className="font-semibold text-foreground" /> }}
                        values={{ value: balancing.costFp ?? 1 }}
                      />
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={balancing.costFp ?? 1}
                      onChange={(e) => applyBalancing({ costFp: parseInt(e.target.value, 10) })}
                      className="w-full accent-primary"
                      disabled={config.taskType !== "classification"}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1</span><span>20</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {config.taskType === "classification" && !!balanceAnalysis && !balanceAnalysis.needs_balancing && balancing.strategy !== "none" && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-[11px] flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span>
                <Trans
                  i18nKey="preparation.balancing.balancedWarning"
                  components={{ strong: <strong /> }}
                  values={{ strategy: balancing.strategy }}
                />
              </span>
            </div>
          )}

          {!!( balanceAnalysis?.warnings ?? []).filter((w) => w !== "dataset_is_already_balanced").length && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-[11px]">
              <p className="mb-1 font-medium text-amber-900 dark:text-amber-300">{t("preparation.balancing.warningsTitle")}</p>
              <ul className="space-y-1 text-amber-800 dark:text-amber-400">
                {(balanceAnalysis?.warnings ?? [])
                  .filter((w) => w !== "dataset_is_already_balanced")
                  .map((warning) => (
                    <li key={warning} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{humanizeWarning(warning)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={pendingStrategy !== null}
        onClose={() => setPendingStrategy(null)}
        icon={<AlertTriangle className="h-4 w-4 text-warning" />}
        title={t("preparation.balancing.modalTitle")}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingStrategy(null)}>
              {t("preparation.balancing.modalCancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingStrategy) applyBalancing({ strategy: pendingStrategy });
                setPendingStrategy(null);
              }}
            >
              {t("preparation.balancing.modalApply")}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          {balanceAnalysis?.summary_message && <p>{balanceAnalysis.summary_message}</p>}
          <p>
            <Trans
              i18nKey="preparation.balancing.modalQuestion"
              components={{ strong: <strong /> }}
              values={{ strategy: pendingStrategy ?? "" }}
            />
          </p>
        </div>
      </Modal>
    </>
  );
}

export default BalancingPanel;
