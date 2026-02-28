import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, SlidersHorizontal, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
};

type MetricGroup = {
  id: string;
  title: string;
  description: string;
  options: MetricOption[];
};

const classificationMetricGroups: MetricGroup[] = [
  {
    id: "core",
    title: "Core metrics",
    description: "Mesures principales pour comparer rapidement les modeles.",
    options: [
      { value: "accuracy", label: "Accuracy", desc: "Proportion de predictions correctes" },
      { value: "precision", label: "Precision", desc: "Qualite des predictions positives" },
      { value: "recall", label: "Recall", desc: "Couverture des positifs reels" },
      { value: "f1", label: "F1 Score", desc: "Compromis precision / recall" },
      { value: "roc_auc", label: "ROC AUC", desc: "Aire sous la courbe ROC" },
      { value: "pr_auc", label: "PR AUC", desc: "Aire sous la courbe Precision-Recall" },
      { value: "f1_pos", label: "F1 Positif", desc: "F1 de la classe positive" },
      { value: "confusion_matrix", label: "Matrice de confusion", desc: "Tableau TP/FP/TN/FN" },
    ],
  },
  {
    id: "macro",
    title: "Macro averages",
    description: "Moyennes non ponderees, utiles pour classes desequilibrees.",
    options: [
      { value: "precision_macro", label: "Precision Macro", desc: "Precision moyenne par classe" },
      { value: "recall_macro", label: "Recall Macro", desc: "Recall moyen par classe" },
      { value: "f1_macro", label: "F1 Macro", desc: "F1 moyen par classe" },
    ],
  },
  {
    id: "weighted",
    title: "Weighted averages",
    description: "Moyennes ponderees par support de chaque classe.",
    options: [
      { value: "precision_weighted", label: "Precision Weighted", desc: "Precision ponderee" },
      { value: "recall_weighted", label: "Recall Weighted", desc: "Recall pondere" },
      { value: "f1_weighted", label: "F1 Weighted", desc: "F1 pondere" },
    ],
  },
  {
    id: "micro",
    title: "Micro averages",
    description: "Agregation globale sur l'ensemble des labels.",
    options: [
      { value: "precision_micro", label: "Precision Micro", desc: "Precision globale TP/FP" },
      { value: "recall_micro", label: "Recall Micro", desc: "Recall global TP/FN" },
      { value: "f1_micro", label: "F1 Micro", desc: "F1 global" },
    ],
  },
];

const regressionMetricGroups: MetricGroup[] = [
  {
    id: "errors",
    title: "Erreur",
    description: "Mesures de l'erreur de prediction (plus bas = mieux).",
    options: [
      { value: "mae", label: "MAE", desc: "Erreur absolue moyenne" },
      { value: "mse", label: "MSE", desc: "Erreur quadratique moyenne" },
      { value: "rmse", label: "RMSE", desc: "Racine de l'erreur quadratique" },
    ],
  },
  {
    id: "fit",
    title: "Qualite d'ajustement",
    description: "Mesure globale de la variance expliquee.",
    options: [{ value: "r2", label: "R2", desc: "Coefficient de determination" }],
  },
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
  const metricGroups =
    config.taskType === "classification" ? classificationMetricGroups : regressionMetricGroups;

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
      onConfigChange({ metrics: selectedMetrics });
    }
  }, [hasUnsupportedMetrics, onConfigChange, selectedMetrics]);

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

  const positiveLabelValue = config.positiveLabel == null ? "" : String(config.positiveLabel);

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
            Metriques d'evaluation
            <Badge variant="outline" className="text-[10px]">
              {config.taskType === "classification" ? "Classification" : "Regression"}
            </Badge>
            <Badge variant="secondary" className="ml-auto tabular-nums">
              {selectedMetrics.length}/{allMetrics.length} selectionnees
            </Badge>
          </CardTitle>

          <p className="text-xs text-muted-foreground">
            Selectionnez les metriques qui apparaitront dans la page de resultats.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={selectRecommended}>
              Selection recommandee
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              Tout selectionner
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Vider
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Selection active</p>
              <Badge variant={selectedMetrics.length > 0 ? "secondary" : "outline"} className="tabular-nums">
                {selectedMetrics.length} metrique(s)
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
                Aucune metrique selectionnee. Choisissez au moins une metrique pour continuer.
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
                      {selectedInGroup}/{group.options.length}
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
                          <div>
                            <span className="text-sm font-semibold">{option.label}</span>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.desc}</p>
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
            <p className="text-sm text-destructive">Selectionnez au moins une metrique.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-xl bg-secondary/10 p-2">
              <SlidersHorizontal className="h-4 w-4 text-secondary" />
            </div>
            Options avancees
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {config.taskType === "classification" && (
            <div className="rounded-xl border border-border/60 p-4">
              <Label htmlFor="positive-label-input" className="text-sm font-semibold">
                Classe positive (positiveLabel)
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Recommande pour les labels binaires non {"{0,1}"} afin de stabiliser ROC-AUC,
                PR-AUC et F1 positif.
              </p>
              <Input
                id="positive-label-input"
                value={positiveLabelValue}
                onChange={(e) =>
                  onConfigChange({
                    positiveLabel: e.target.value.trim() ? e.target.value : null,
                  })
                }
                placeholder="Ex: Yes, Malade, 1"
                className="mt-2"
              />
            </div>
          )}

          <div className="rounded-xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="training-debug-toggle" className="cursor-pointer text-sm font-semibold">
                  Mode debug training
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Envoie <code>debug=true</code> au backend pour logs detailles (splits, classes,
                  source AUC, etc.).
                </p>
              </div>
              <Switch
                id="training-debug-toggle"
                checked={Boolean(config.trainingDebug)}
                onCheckedChange={(checked) => onConfigChange({ trainingDebug: Boolean(checked) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
