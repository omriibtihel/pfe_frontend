import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
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

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  balanced:  { label: "Équilibré",  color: "text-emerald-600 dark:text-emerald-400" },
  mild:      { label: "Léger",      color: "text-sky-600 dark:text-sky-400" },
  moderate:  { label: "Modéré",     color: "text-amber-600 dark:text-amber-400" },
  severe:    { label: "Sévère",     color: "text-orange-600 dark:text-orange-400" },
  critical:  { label: "Critique",   color: "text-red-600 dark:text-red-400" },
};

const SCALE_LABELS: Record<string, string> = {
  tiny:   "très petit (< 200 lignes)",
  small:  "petit (200–2 000 lignes)",
  medium: "moyen (2 000–50 000 lignes)",
  large:  "grand (> 50 000 lignes)",
};

const fallbackBalancingStrategies: Array<{ id: TrainingBalancingStrategy; label: string }> = [
  { id: "none", label: "Aucun rééquilibrage" },
  { id: "class_weight", label: "Poids de classes" },
  { id: "smote", label: "SMOTE" },
  { id: "smote_tomek", label: "SMOTE + Tomek" },
  { id: "random_undersampling", label: "Sous-échantillonnage aléatoire" },
  { id: "threshold_optimization", label: "Optimisation du seuil" },
];

const thresholdStrategyOptions: Array<{ id: TrainingThresholdStrategy; label: string }> = [
  { id: "maximize_f1", label: "Maximiser F1" },
  { id: "maximize_f2", label: "Maximiser F2 (rappel)" },
  { id: "min_recall", label: "Rappel minimum garanti" },
  { id: "precision_recall_balance", label: "Équilibre précision/rappel" },
];

function isSmoteStrategy(strategy: TrainingBalancingStrategy): boolean {
  return strategy === "smote" || strategy === "smote_tomek";
}

export function BalancingPanel({ projectId, config, onConfigChange }: BalancingPanelProps) {
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
      } catch (e: any) {
        if (!mounted) return;
        setBalanceAnalysis(null);
        setBalanceError(String(e?.message || "Analyse du déséquilibre indisponible."));
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
              <span className="font-semibold text-sm">Gestion du desequilibre</span>
              <Badge variant="outline" className="text-[10px]">
                Classification binaire
              </Badge>
            </div>
            {config.taskType !== "classification" && (
              <p className="text-xs text-warning mt-1">Disponible uniquement en classification.</p>
            )}
            {config.taskType === "classification" && balanceLoading && (
              <p className="text-xs text-muted-foreground mt-1">Analyse du déséquilibre en cours…</p>
            )}
            {config.taskType === "classification" && !balanceLoading && !!balanceError && (
              <p className="text-xs text-warning mt-1">{balanceError}</p>
            )}
            {config.taskType === "classification" && !balanceLoading && !!balanceAnalysis && (
              <div className="space-y-3 pt-1">

                {/* ── Distribution visuelle ── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Distribution de la colonne cible
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
                    { label: "Total",  value: balanceAnalysis.n_samples.toLocaleString() },
                    {
                      label: "Ratio IR",
                      value: `${Number(balanceAnalysis.imbalance_ratio).toFixed(1)} : 1`,
                    },
                    {
                      label: "Taille",
                      value: SCALE_LABELS[balanceAnalysis.dataset_scale] ?? balanceAnalysis.dataset_scale,
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
                      <span className={LEVEL_LABELS[balanceAnalysis.imbalance_level]?.color ?? ""}>
                        {LEVEL_LABELS[balanceAnalysis.imbalance_level]?.label ?? balanceAnalysis.imbalance_level}
                      </span>
                      {" — "}
                      {balanceAnalysis.needs_balancing
                        ? `pour ${Number(balanceAnalysis.imbalance_ratio).toFixed(1)} exemple${Number(balanceAnalysis.imbalance_ratio) >= 2 ? "s" : ""} « ${String(balanceAnalysis.majority.label)} », il n'y a qu'un seul « ${String(balanceAnalysis.minority.label)} ».`
                        : "les deux classes sont bien représentées."
                      }
                    </p>
                    {balanceAnalysis.needs_balancing && (
                      <p className="text-muted-foreground">
                        Sans correction, le modèle risque d'ignorer la classe minoritaire et de n'apprendre qu'à prédire
                        {" «"}{String(balanceAnalysis.majority.label)}{"»"}.
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
            <label className="text-xs text-muted-foreground">Strategie</label>
            <Select
              value={balancing.strategy}
              onValueChange={(value) => handleStrategyChange(value as TrainingBalancingStrategy)}
              disabled={config.taskType !== "classification"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choisir une strategie" />
              </SelectTrigger>
              <SelectContent>
                {(balanceAnalysis?.available_strategies ?? fallbackBalancingStrategies).map((strategy) => (
                  <SelectItem
                    key={strategy.id}
                    value={strategy.id}
                    disabled={"feasible" in strategy ? !strategy.feasible : false}
                  >
                    <span className="flex items-center gap-2">
                      <span>{strategy.label}</span>
                      {"recommended" in strategy && strategy.recommended && (
                        <span className="text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 font-medium leading-none">
                          recommandé
                        </span>
                      )}
                      {"feasible" in strategy && !strategy.feasible && (
                        <span className="text-[10px] text-muted-foreground">(non faisable)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentStrategyInfo && !currentStrategyInfo.feasible && (
              <p className="text-[11px] text-destructive">
                Strategie non faisable: {currentStrategyInfo.infeasible_reason ?? "condition non satisfaite"}.
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
              <span className="text-xs font-medium">Appliquer l'optimisation du threshold</span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Strategie threshold</label>
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
                    {thresholdStrategyOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Contrainte recall min</label>
                <Input
                  type="number"
                  step={0.01}
                  min={0.01}
                  max={0.99}
                  disabled={balancing.thresholdStrategy !== "min_recall" || config.taskType !== "classification"}
                  value={balancing.minRecallConstraint ?? 0.7}
                  onChange={(e) =>
                    applyBalancing({
                      minRecallConstraint: Math.min(0.99, Math.max(0.01, Number(e.target.value) || 0.7)),
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {config.taskType === "classification" && !!balanceAnalysis && !balanceAnalysis.needs_balancing && balancing.strategy !== "none" && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-[11px] flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span>
                Dataset equilibre — la strategie <strong>{balancing.strategy}</strong> est appliquee sur demande.
              </span>
            </div>
          )}

          {!!( balanceAnalysis?.warnings ?? []).filter((w) => w !== "dataset_is_already_balanced").length && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-[11px]">
              <p className="mb-1 font-medium text-amber-900 dark:text-amber-300">Avertissements</p>
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
        title="Dataset équilibré — stratégie non nécessaire"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingStrategy(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingStrategy) applyBalancing({ strategy: pendingStrategy });
                setPendingStrategy(null);
              }}
            >
              Appliquer quand même
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          {balanceAnalysis?.summary_message && <p>{balanceAnalysis.summary_message}</p>}
          <p>
            La stratégie <strong>{pendingStrategy}</strong> n'est pas nécessaire sur un dataset équilibré et pourrait
            déséquilibrer artificiellement l'entraînement. Voulez-vous quand même l'appliquer ?
          </p>
        </div>
      </Modal>
    </>
  );
}

export default BalancingPanel;
