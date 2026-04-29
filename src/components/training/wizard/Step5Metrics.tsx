import { useEffect, useMemo } from "react";
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

const classificationMetricGroups: MetricGroup[] = [
  {
    id: "core",
    title: "Métriques principales",
    description: "Indicateurs essentiels pour évaluer et comparer les modèles.",
    options: [
      {
        value: "accuracy",
        label: "Exactitude globale",
        desc: "% de cas correctement classés",
        clinicalHelp: "ATTENTION : trompeuse si les classes sont déséquilibrées. Ex : si 95% des patients sont sains, un modèle qui dit toujours « sain » atteint 95% sans rien apprendre. Fiable uniquement quand les classes sont équilibrées.",
        range: "Fiable si dataset équilibré. Ignorer si déséquilibré.",
      },
      {
        value: "precision",
        label: "Valeur Prédictive Positive (VPP)",
        desc: "Parmi les cas détectés positifs, combien sont vraiment malades ?",
        clinicalHelp: "Répond à : « Si le modèle dit que ce patient est malade, quelle est la probabilité qu'il le soit vraiment ? ». Une VPP faible = beaucoup de fausses alarmes, ce qui génère des examens complémentaires inutiles.",
        range: "Acceptable > 70% | Bon > 85%",
      },
      {
        value: "recall",
        label: "Sensibilité (Rappel)",
        desc: "Parmi les vrais malades, combien le modèle a-t-il détectés ?",
        clinicalHelp: "Équivalent clinique de la SENSIBILITÉ d'un test. Répond à : « Le modèle manque-t-il des malades ? ». Une sensibilité faible = des diagnostics manqués (faux négatifs). CRITIQUE pour le dépistage.",
        range: "Dépistage : exiger ≥ 90% | Diagnostic général : > 80%",
      },
      {
        value: "f1",
        label: "Score F1",
        desc: "Compromis entre sensibilité et VPP",
        clinicalHelp: "Moyenne harmonique de la sensibilité et de la VPP. Utile quand les deux types d'erreurs comptent. Ne dépend pas du seuil de décision du modèle.",
        range: "Acceptable > 0.70 | Bon > 0.80 | Excellent > 0.90",
      },
      {
        value: "roc_auc",
        label: "Capacité discriminante (ROC AUC)",
        desc: "Capacité du modèle à séparer malades et sains",
        clinicalHelp: "Mesure comment le modèle distingue les cas positifs des négatifs, pour tous les seuils de décision possibles. Indépendant du seuil. 0.5 = aussi précis qu'une pièce de monnaie | 1.0 = parfait. Comparable à l'index C des scores cliniques.",
        range: "Médiocre < 0.70 | Acceptable 0.70–0.79 | Bon 0.80–0.89 | Excellent ≥ 0.90",
      },
      {
        value: "pr_auc",
        label: "Détection de cas rares (PR AUC)",
        desc: "Recommandé quand la maladie est rare",
        clinicalHelp: "Plus fiable que le ROC AUC quand la maladie est rare (< 20% de cas positifs). Mesure la précision à chaque niveau de sensibilité. À comparer avec la prévalence de référence : doit être nettement supérieur.",
        range: "Comparer à la prévalence : si 10% de cas → viser > 0.40",
      },
      {
        value: "confusion_matrix",
        label: "Tableau d'erreurs (Matrice de confusion)",
        desc: "Détail exact de chaque type d'erreur",
        clinicalHelp: "Montre combien de : Vrais Positifs (VP = malades détectés), Faux Positifs (FP = sains détectés comme malades), Vrais Négatifs (VN = sains correctement identifiés), Faux Négatifs (FN = malades non détectés). Les FN sont les cas manqués — les plus dangereux cliniquement.",
        range: "Plus les FN sont bas, mieux c'est en contexte clinique.",
      },
    ],
  },
  {
    id: "binary",
    title: "Classification binaire uniquement",
    description: "Métriques calculées sur la classe d'intérêt (ex : « malade »). Non applicable en multiclasse.",
    options: [
      {
        value: "f1_pos",
        label: "Score F1 de la classe positive",
        desc: "Score F1 calculé uniquement sur la maladie ciblée",
        clinicalHelp: "Identique au Score F1 mais calculé spécifiquement pour la classe positive (ex : le diagnostic que vous cherchez à détecter). Plus précis que le F1 global en cas de déséquilibre.",
        range: "Bon > 0.75 | Excellent > 0.85",
      },
    ],
  },
  {
    id: "macro",
    title: "Moyennes équilibrées (Macro)",
    description: "Traite chaque classe avec le même poids — recommandé si toutes les classes sont également importantes.",
    options: [
      {
        value: "precision_macro",
        label: "VPP équilibrée",
        desc: "Valeur prédictive positive moyenne sur toutes les classes",
        clinicalHelp: "Calcule la VPP séparément pour chaque classe puis fait la moyenne. Donne le même poids à une classe rare qu'à une classe fréquente. Recommandé quand toutes les pathologies ont la même importance.",
      },
      {
        value: "recall_macro",
        label: "Sensibilité équilibrée",
        desc: "Sensibilité moyenne sur toutes les classes",
        clinicalHelp: "Sensibilité calculée séparément pour chaque classe puis moyennée. Pénalise fortement si une classe rare est mal détectée.",
      },
      {
        value: "f1_macro",
        label: "Score F1 équilibré",
        desc: "Score F1 moyen sur toutes les classes",
        clinicalHelp: "Meilleure métrique pour la classification multiclasse quand toutes les pathologies comptent autant. Recommandé pour les diagnostics différentiels.",
      },
    ],
  },
  {
    id: "weighted",
    title: "Moyennes pondérées (Weighted)",
    description: "Chaque classe est pondérée par son nombre de cas — recommandé si certaines pathologies sont plus fréquentes.",
    options: [
      {
        value: "precision_weighted",
        label: "VPP pondérée par fréquence",
        desc: "VPP pondérée par le nombre de cas de chaque classe",
        clinicalHelp: "Donne plus de poids aux classes fréquentes. Reflète les performances globales sur la cohorte réelle. Peut masquer de mauvaises performances sur les maladies rares.",
      },
      {
        value: "recall_weighted",
        label: "Sensibilité pondérée",
        desc: "Sensibilité pondérée par le nombre de cas",
        clinicalHelp: "Sensibilité globale pondérée par la fréquence de chaque pathologie dans votre dataset.",
      },
      {
        value: "f1_weighted",
        label: "Score F1 pondéré",
        desc: "Score F1 pondéré par fréquence des classes",
        clinicalHelp: "Bon indicateur de performance globale sur votre cohorte. Recommandé pour les rapports généraux. Peut être trompeur si les classes sont très déséquilibrées.",
      },
    ],
  },
  {
    id: "micro",
    title: "Moyennes globales (Micro)",
    description: "Calculé sur l'ensemble des cas sans distinction de classe — résume la performance totale.",
    options: [
      {
        value: "precision_micro",
        label: "VPP globale",
        desc: "VPP calculée sur tous les cas",
        clinicalHelp: "Compte tous les vrais positifs et faux positifs ensemble. Dominé par les classes fréquentes. Rarement utile en médecine — préférer la Macro ou Weighted.",
      },
      {
        value: "recall_micro",
        label: "Sensibilité globale",
        desc: "Sensibilité calculée sur tous les cas",
        clinicalHelp: "Équivalent au taux de bons diagnostics sur l'ensemble du dataset.",
      },
      {
        value: "f1_micro",
        label: "Score F1 global",
        desc: "Score F1 calculé sur tous les cas",
        clinicalHelp: "En classification multiclasse, identique à l'exactitude globale. Peu informatif si les classes sont déséquilibrées.",
      },
    ],
  },
];

const regressionMetricGroups: MetricGroup[] = [
  {
    id: "errors",
    title: "Erreur de prédiction",
    description: "Mesure l'écart entre la valeur prédite et la valeur réelle — plus bas = mieux.",
    options: [
      {
        value: "mae",
        label: "Erreur absolue moyenne (MAE)",
        desc: "Écart moyen entre prédiction et valeur réelle",
        clinicalHelp: "Exprimé dans la même unité que la variable cible. Ex : si vous prédisez la glycémie en mmol/L, MAE = 0.5 signifie une erreur moyenne de 0.5 mmol/L. Facile à interpréter cliniquement.",
        range: "Interpréter selon l'unité clinique",
      },
      {
        value: "mse",
        label: "Erreur quadratique moyenne (MSE)",
        desc: "Pénalise davantage les grandes erreurs",
        clinicalHelp: "Pénalise les grandes erreurs de manière disproportionnée (erreur au carré). Utile si les erreurs importantes sont particulièrement dangereuses. Difficile à interpréter directement — préférer RMSE.",
      },
      {
        value: "rmse",
        label: "Erreur quadratique (RMSE)",
        desc: "Racine carrée du MSE — même unité que la variable",
        clinicalHelp: "Version interprétable du MSE : retourné dans l'unité de la variable cible. Sensible aux grandes erreurs. Recommandé si l'unité clinique est importante pour la communication.",
        range: "Interpréter selon l'unité clinique",
      },
    ],
  },
  {
    id: "fit",
    title: "Qualité d'ajustement",
    description: "Mesure quelle proportion de la variabilité clinique est expliquée par le modèle.",
    options: [
      {
        value: "r2",
        label: "Variance expliquée (R²)",
        desc: "Proportion de la variabilité expliquée par le modèle",
        clinicalHelp: "1.0 = le modèle explique toute la variabilité | 0.0 = le modèle n'est pas meilleur que la moyenne | Valeurs négatives = le modèle est pire que la moyenne. Comparable au R² des études de corrélation clinique.",
        range: "Médiocre < 0.50 | Acceptable 0.50–0.69 | Bon 0.70–0.89 | Excellent ≥ 0.90",
      },
    ],
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
          <p className="font-semibold">Quelles métriques choisir ?</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sky-700 dark:text-sky-400">
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">Données déséquilibrées (maladie rare)</p>
              <p>→ <strong>Sensibilité</strong> + <strong>VPP</strong> + <strong>Détection cas rares (PR AUC)</strong></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">Données équilibrées</p>
              <p>→ <strong>Exactitude globale</strong> + <strong>Capacité discriminante (ROC AUC)</strong></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">Priorité : ne pas manquer un malade</p>
              <p>→ Prioriser la <strong>Sensibilité</strong> (rappel) ≥ 90%</p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">Priorité : éviter les fausses alarmes</p>
              <p>→ Prioriser la <strong>VPP</strong> (précision) ≥ 85%</p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">Rapport général / audit</p>
              <p>→ <strong>Score F1</strong> + <strong>ROC AUC</strong> + <strong>Tableau d'erreurs</strong></p>
            </div>
            <div>
              <p className="font-medium text-sky-800 dark:text-sky-300">Si vous n'êtes pas sûr</p>
              <p>→ Cliquez sur <em>Sélection recommandée</em></p>
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
            Indicateurs d'évaluation
            <MedHelp title="Pourquoi plusieurs métriques ?" side="bottom">
              <p>Aucune métrique unique ne capture toute la qualité d'un modèle médical. Choisissez au moins 3 métriques complémentaires pour avoir une vision complète.</p>
              <p className="mt-1">Ex : un modèle peut avoir 95% d'exactitude mais détecter seulement 50% des malades — ce qui est inacceptable en clinique.</p>
            </MedHelp>
            <Badge variant="outline" className="text-[10px]">
              {config.taskType === "classification" ? "Classification" : "Régression"}
            </Badge>
            <Badge variant="secondary" className="ml-auto tabular-nums">
              {selectedMetrics.length}/{allMetrics.length} sélectionnées
            </Badge>
          </CardTitle>

          <p className="text-xs text-muted-foreground">
            Choisissez les indicateurs qui apparaîtront dans la page de résultats. Survolez le <strong>ℹ</strong> de chaque métrique pour une explication clinique.
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
            <p className="text-sm text-destructive">Selectionnez au moins une metrique.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
