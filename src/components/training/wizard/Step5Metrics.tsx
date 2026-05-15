import { useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { BarChart3, Info, TrendingUp } from "lucide-react";
import { MedHelp } from "@/components/ui/med-help";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MetricType, TrainingConfig } from "@/types";

interface Step5Props {
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

type MetricOption = {
  value: MetricType;
  label: string;
  desc: string;
  /** Explication clinique complète pour la bulle d'aide */
  clinicalHelp?: string;
  /** Plages d'interprétation: "Bon si > 0.80" */
  range?: string;
};

type MetricGroup = {
  id: string;
  title: string;
  description: string;
  options: MetricOption[];
};

/** Structural definition — labels/descs/help/range are resolved via i18n at render time. */
type MetricGroupDef = {
  id: string;
  options: { value: MetricType; hasHelp: boolean; hasRange: boolean }[];
};

const classificationMetricGroupDefs: MetricGroupDef[] = [
  { id: "core", options: [
    { value: "accuracy", hasHelp: true, hasRange: true },
    { value: "precision", hasHelp: true, hasRange: true },
    { value: "recall", hasHelp: true, hasRange: true },
    { value: "f1", hasHelp: true, hasRange: true },
    { value: "roc_auc", hasHelp: true, hasRange: true },
    { value: "pr_auc", hasHelp: true, hasRange: true },
    { value: "confusion_matrix", hasHelp: true, hasRange: true },
  ]},
  { id: "binary", options: [
    { value: "f1_pos", hasHelp: true, hasRange: true },
  ]},
  { id: "macro", options: [
    { value: "precision_macro", hasHelp: true, hasRange: false },
    { value: "recall_macro", hasHelp: true, hasRange: false },
    { value: "f1_macro", hasHelp: true, hasRange: false },
  ]},
  { id: "weighted", options: [
    { value: "precision_weighted", hasHelp: true, hasRange: false },
    { value: "recall_weighted", hasHelp: true, hasRange: false },
    { value: "f1_weighted", hasHelp: true, hasRange: false },
  ]},
  { id: "micro", options: [
    { value: "precision_micro", hasHelp: true, hasRange: false },
    { value: "recall_micro", hasHelp: true, hasRange: false },
    { value: "f1_micro", hasHelp: true, hasRange: false },
  ]},
];

const regressionMetricGroupDefs: MetricGroupDef[] = [
  { id: "errors", options: [
    { value: "mae", hasHelp: true, hasRange: true },
    { value: "mse", hasHelp: true, hasRange: false },
    { value: "rmse", hasHelp: true, hasRange: true },
  ]},
  { id: "fit", options: [
    { value: "r2", hasHelp: true, hasRange: true },
  ]},
];

const recommendedClassificationMetrics: MetricType[] = [
  "accuracy",
  "f1",
  "roc_auc",
  "pr_auc",
  "confusion_matrix",
];

const recommendedRegressionMetrics: MetricType[] = ["mae", "rmse", "r2"];

export function Step5Metrics({ config, onConfigChange }: Step5Props) {
  const { t } = useTranslation();

  const metricGroups = useMemo<MetricGroup[]>(() => {
    const defs = config.taskType === "classification" ? classificationMetricGroupDefs : regressionMetricGroupDefs;
    return defs.map((g) => ({
      id: g.id,
      title: t(`training.step5.groups.${g.id}.title`),
      description: t(`training.step5.groups.${g.id}.description`),
      options: g.options.map((o) => ({
        value: o.value,
        label: t(`training.step5.metrics.${o.value}.label`),
        desc: t(`training.step5.metrics.${o.value}.desc`),
        clinicalHelp: o.hasHelp ? t(`training.step5.metrics.${o.value}.help`) : undefined,
        range: o.hasRange ? t(`training.step5.metrics.${o.value}.range`) : undefined,
      })),
    }));
  }, [config.taskType, t]);

  const allMetrics = useMemo(
    () => metricGroups.flatMap((group) => group.options.map((option) => option.value)),
    [metricGroups]
  );
  const allowedMetricSet = useMemo(() => new Set(allMetrics), [allMetrics]);

  const selectedMetrics = useMemo(
    () =>
      config.metrics.filter((metric): metric is MetricType =>
        allowedMetricSet.has(metric as MetricType)
      ),
    [allowedMetricSet, config.metrics]
  );
  const selectedSet = useMemo(() => new Set(selectedMetrics), [selectedMetrics]);

  const hasUnsupportedMetrics = config.metrics.some(
    (metric) => !allowedMetricSet.has(metric as MetricType)
  );

  useEffect(() => {
    if (hasUnsupportedMetrics) {
      onConfigChange({ metrics: allMetrics });
    }
  }, [hasUnsupportedMetrics, onConfigChange, allMetrics]);

  const metricDetails = useMemo(() => {
    const lookup = new Map<MetricType, MetricOption>();
    for (const group of metricGroups) {
      for (const option of group.options) {
        lookup.set(option.value, option);
      }
    }
    return lookup;
  }, [metricGroups]);

  const recommendedMetrics =
    config.taskType === "classification"
      ? recommendedClassificationMetrics
      : recommendedRegressionMetrics;

  const applyMetrics = (nextMetrics: MetricType[]) => {
    const unique = Array.from(new Set(nextMetrics)).filter((metric) => allowedMetricSet.has(metric));
    onConfigChange({ metrics: unique });
  };

  const toggleMetric = (metric: MetricType) => {
    if (selectedSet.has(metric)) {
      applyMetrics(selectedMetrics.filter((current) => current !== metric));
      return;
    }
    applyMetrics([...selectedMetrics, metric]);
  };

  const selectRecommended = () => {
    applyMetrics(recommendedMetrics.filter((metric) => allowedMetricSet.has(metric)));
  };

  const selectAll = () => {
    applyMetrics(allMetrics);
  };

  const clearSelection = () => {
    applyMetrics([]);
  };

  return (
    <div className="space-y-6">

      {/* ── Guide clinique de sélection ── */}
      <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20 p-4 flex gap-3">
        <Info className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
        <div className="space-y-2 text-[12px] text-sky-800 dark:text-sky-300">
          <p className="font-semibold">{t("training.step5.guideTitle")}</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sky-700 dark:text-sky-400">
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">{t("training.step5.guideImbalanced")}</p>
              <p><Trans i18nKey="training.step5.guideImbalancedHint" components={{ strong: <strong /> }} /></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">{t("training.step5.guideBalanced")}</p>
              <p><Trans i18nKey="training.step5.guideBalancedHint" components={{ strong: <strong /> }} /></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">{t("training.step5.guideSensitivity")}</p>
              <p><Trans i18nKey="training.step5.guideSensitivityHint" components={{ strong: <strong /> }} /></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">{t("training.step5.guidePrecision")}</p>
              <p><Trans i18nKey="training.step5.guidePrecisionHint" components={{ strong: <strong /> }} /></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">{t("training.step5.guideReport")}</p>
              <p><Trans i18nKey="training.step5.guideReportHint" components={{ strong: <strong /> }} /></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">{t("training.step5.guideUnsure")}</p>
              <p><Trans i18nKey="training.step5.guideUnsureHint" components={{ em: <em /> }} /></p>
            </div>
          </div>
        </div>
      </div>

      <Card className="glass-premium shadow-card">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <div className="rounded-xl bg-accent/10 p-2">
              {config.taskType === "classification" ? (
                <BarChart3 className="h-4 w-4 text-accent" />
              ) : (
                <TrendingUp className="h-4 w-4 text-accent" />
              )}
            </div>
            {t("training.step5.cardTitle")}
            <MedHelp title={t("training.step5.helpTitle")} side="bottom">
              <p>{t("training.step5.helpP1")}</p>
              <p className="mt-1">{t("training.step5.helpP2")}</p>
            </MedHelp>
            <Badge variant="outline" className="text-[10px]">
              {config.taskType === "classification" ? t("training.step5.taskClassification") : t("training.step5.taskRegression")}
            </Badge>
            <Badge variant="secondary" className="ml-auto tabular-nums">
              {t("training.step5.countSelected", { selected: selectedMetrics.length, total: allMetrics.length })}
            </Badge>
          </CardTitle>

          <p className="text-xs text-muted-foreground">
            <Trans i18nKey="training.step5.cardDesc" components={{ strong: <strong /> }} />
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={selectRecommended}>
              {t("training.step5.btnRecommended")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              {t("training.step5.btnAll")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              {t("training.step5.btnClear")}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t("training.step5.activeSelection")}</p>
              <Badge variant={selectedMetrics.length > 0 ? "secondary" : "outline"} className="tabular-nums">
                {t("training.step5.metricsCount", { n: selectedMetrics.length })}
              </Badge>
            </div>
            {selectedMetrics.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedMetrics.map((metric) => (
                  <Badge key={metric} variant="outline">
                    {metricDetails.get(metric)?.label ?? metric}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("training.step5.emptyHint")}
              </p>
            )}
          </div>

          <div className="space-y-4">
            {metricGroups.map((group, groupIndex) => {
              const selectedInGroup = group.options.filter((option) =>
                selectedSet.has(option.value)
              ).length;

              return (
                <div key={group.id} className="space-y-3 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{group.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>
                    </div>
                    <Badge variant={selectedInGroup > 0 ? "secondary" : "outline"} className="tabular-nums">
                      {t("training.step5.groupCount", { selected: selectedInGroup, total: group.options.length })}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.options.map((option, optionIndex) => {
                      const selected = selectedSet.has(option.value);
                      return (
                        <motion.label
                          key={option.value}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: groupIndex * 0.03 + optionIndex * 0.02 }}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200",
                            selected
                              ? "border-accent bg-accent/5 shadow-sm"
                              : "border-border hover:border-accent/30"
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleMetric(option.value)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold">{option.label}</span>
                              {option.clinicalHelp && (
                                <MedHelp title={option.label} side="top">
                                  <p>{option.clinicalHelp}</p>
                                  {option.range && (
                                    <p className="mt-1.5 font-medium text-foreground/80">📊 {option.range}</p>
                                  )}
                                </MedHelp>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.desc}</p>
                            {option.range && (
                              <p className="mt-1 text-[10px] text-muted-foreground/70 italic">{option.range}</p>
                            )}
                          </div>
                        </motion.label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedMetrics.length === 0 && (
            <p className="text-sm text-destructive">{t("training.step5.errEmpty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
