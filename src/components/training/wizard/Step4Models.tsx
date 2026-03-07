import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, Brain, CheckCircle2, Grid3X3, MoreHorizontal, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trainingService } from "@/services/trainingService";
import type {
  TrainingBalanceAnalysis,
  TrainingBalancingConfig,
  TrainingBalancingStrategy,
  ModelHyperparamScalar,
  ModelHyperparamValue,
  ModelType,
  TrainingConfig,
  TrainingHyperparamFieldSchema,
  TrainingThresholdStrategy,
  GridScoringOption,
  SearchType,
} from "@/types";
import { DEFAULT_TRAINING_BALANCING } from "@/types";
import { cn } from "@/lib/utils";
import { humanizeWarning } from "@/components/training/results/trainingResultsHelpers";

interface Step4Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

type ModelCardOption = {
  value: ModelType;
  label: string;
  desc: string;
  icon: ReactNode;
  installed: boolean;
};

const modelCatalog: Array<{ value: ModelType; label: string; desc: string; icon: ReactNode }> = [
  { value: "randomforest",     label: "Random Forest",    desc: "Robuste, interpretable",          icon: <Brain className="h-4 w-4" /> },
  { value: "extratrees",       label: "Extra Trees",      desc: "Plus rapide que RF, moins de variance", icon: <Brain className="h-4 w-4" /> },
  { value: "xgboost",          label: "XGBoost",          desc: "Haute performance",               icon: <Sparkles className="h-4 w-4" /> },
  { value: "lightgbm",         label: "LightGBM",         desc: "Rapide, efficace",                icon: <Zap className="h-4 w-4" /> },
  { value: "gradientboosting", label: "Gradient Boosting",desc: "Boosting sklearn natif",          icon: <BarChart3 className="h-4 w-4" /> },
  { value: "svm",              label: "SVM",              desc: "Bon pour petits datasets",        icon: <Brain className="h-4 w-4" /> },
  { value: "knn",              label: "KNN",              desc: "Simple, intuitif",                icon: <Brain className="h-4 w-4" /> },
  { value: "decisiontree",     label: "Decision Tree",    desc: "Tres interpretable",              icon: <Brain className="h-4 w-4" /> },
  { value: "logisticregression", label: "Logistic Reg.", desc: "Classification lineaire",         icon: <BarChart3 className="h-4 w-4" /> },
];

const GRID_SCORING_OPTIONS: Array<{ value: GridScoringOption; label: string; desc: string }> = [
  { value: "auto", label: "Auto", desc: "Choisit automatiquement selon le type de tâche" },
  { value: "roc_auc", label: "ROC AUC", desc: "Classification — aire sous la courbe ROC" },
  { value: "average_precision", label: "Avg Precision", desc: "Classification — PR-AUC, robuste aux déséquilibres" },
  { value: "f1_weighted", label: "F1 Weighted", desc: "Classification multi-classe pondérée" },
  { value: "r2", label: "R² Score", desc: "Régression uniquement" },
];

const fallbackBalancingStrategies: Array<{ id: TrainingBalancingStrategy; label: string }> = [
  { id: "none", label: "Aucun reequilibrage" },
  { id: "class_weight", label: "Class weight" },
  { id: "smote", label: "SMOTE" },
  { id: "smote_tomek", label: "SMOTE + Tomek" },
  { id: "random_undersampling", label: "Random undersampling" },
  { id: "threshold_optimization", label: "Threshold optimization" },
];

const thresholdStrategyOptions: Array<{ id: TrainingThresholdStrategy; label: string }> = [
  { id: "maximize_f1", label: "Maximiser F1" },
  { id: "maximize_f2", label: "Maximiser F2 (rappel)" },
  { id: "min_recall", label: "Contrainte recall min" },
  { id: "precision_recall_balance", label: "Equilibre precision/recall" },
];

function normalizeModelKey(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function isSmoteStrategy(strategy: TrainingBalancingStrategy): boolean {
  return strategy === "smote" || strategy === "smote_tomek";
}

function toDisplayText(value: ModelHyperparamValue | undefined, fallback: ModelHyperparamValue): string {
  const source = value !== undefined ? value : fallback;
  if (Array.isArray(source)) return source.map((x) => String(x)).join(", ");
  if (source === null || source === undefined) return "";
  return String(source);
}

function parseScalarToken(rawToken: string, fieldSchema: TrainingHyperparamFieldSchema): ModelHyperparamScalar {
  const token = String(rawToken ?? "").trim();
  const lowered = token.toLowerCase();
  const fieldType = String(fieldSchema?.type ?? "").toLowerCase();

  if (fieldType === "int_or_none" && (lowered === "none" || lowered === "null")) {
    return null;
  }
  if (fieldType === "int" || fieldType === "int_or_none") {
    const n = Number.parseInt(token, 10);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "float") {
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "float_or_enum") {
    const allowed = (fieldSchema.enum ?? []).map((x) => String(x).toLowerCase());
    if (allowed.includes(lowered)) return lowered;
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "enum") {
    return lowered;
  }
  return token;
}

function parseFieldValue(rawInput: string, fieldSchema: TrainingHyperparamFieldSchema, allowList: boolean): ModelHyperparamValue | undefined {
  const text = String(rawInput ?? "").trim();
  if (!text) return undefined;

  if (allowList && text.includes(",")) {
    const parts = text
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.map((token) => parseScalarToken(token, fieldSchema));
    }
  }
  return parseScalarToken(text, fieldSchema);
}

export function Step4Models({ projectId, config, onConfigChange }: Step4Props) {
  const [availableModels, setAvailableModels] = useState<ModelCardOption[]>(
    modelCatalog.map((m) => ({ ...m, installed: true }))
  );
  const [modelHpSchema, setModelHpSchema] = useState<Record<string, Record<string, TrainingHyperparamFieldSchema>>>({});
  const [hpModalModel, setHpModalModel] = useState<string | null>(null);
  const [balanceAnalysis, setBalanceAnalysis] = useState<TrainingBalanceAnalysis | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [pendingStrategy, setPendingStrategy] = useState<TrainingBalancingStrategy | null>(null);
  const [cvFoldsError, setCvFoldsError] = useState<string | null>(null);

  const scoringOptions = useMemo(
    () =>
      GRID_SCORING_OPTIONS.filter((o) => {
        if (config.taskType === "regression") return o.value === "auto" || o.value === "r2";
        return o.value !== "r2";
      }),
    [config.taskType]
  );

  const handleCvFoldsChange = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) { setCvFoldsError("Valeur invalide"); return; }
    if (n < 2) { setCvFoldsError("Minimum 2 folds"); onConfigChange({ gridCvFolds: 2 }); return; }
    if (n > 10) { setCvFoldsError("Maximum 10 folds"); onConfigChange({ gridCvFolds: 10 }); return; }
    setCvFoldsError(null);
    onConfigChange({ gridCvFolds: n });
  };

  useEffect(() => {
    let mounted = true;
    const loadCapabilities = async () => {
      try {
        const caps = await trainingService.getCapabilities(projectId);
        if (!mounted) return;

        const schemaRaw = caps.modelHyperparamsSchema ?? {};
        setModelHpSchema(schemaRaw);

        const installedByModel = new Map<string, boolean>();
        for (const item of caps.availableModels ?? []) {
          const key = normalizeModelKey(item.key ?? item.name);
          if (!key) continue;
          installedByModel.set(key, Boolean(item.installed));
        }

        setAvailableModels(
          modelCatalog.map((m) => ({
            ...m,
            installed: installedByModel.has(m.value) ? Boolean(installedByModel.get(m.value)) : true,
          }))
        );
      } catch {
        if (!mounted) return;
        setAvailableModels(modelCatalog.map((m) => ({ ...m, installed: true })));
        setModelHpSchema({});
      }
    };
    if (String(projectId ?? "").trim()) {
      loadCapabilities();
    }
    return () => {
      mounted = false;
    };
  }, [projectId]);

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
    const next: TrainingBalancingConfig = {
      ...balancing,
      ...updates,
    };
    if (next.strategy === "threshold_optimization") {
      next.applyThreshold = true;
    }
    const shouldUseSmote = isSmoteStrategy(next.strategy);
    onConfigChange({
      balancing: next,
      useSmote: shouldUseSmote,
    });
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
      return () => {
        mounted = false;
      };
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
        setBalanceError(String(e?.message || "Analyse du desequilibre indisponible."));
      } finally {
        if (mounted) setBalanceLoading(false);
      }
    };
    fetchAnalysis();

    return () => {
      mounted = false;
    };
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
      onConfigChange({
        balancing: next,
        useSmote: isSmoteStrategy(next.strategy),
      });
    }
  }, [balanceAnalysis, balancing, onConfigChange]);

  const currentStrategyInfo = useMemo(() => {
    if (!balanceAnalysis) return null;
    return balanceAnalysis.available_strategies.find((item) => item.id === balancing.strategy) ?? null;
  }, [balanceAnalysis, balancing.strategy]);

  const modelHyperparams = config.modelHyperparams ?? {};
  const activeModelKey = hpModalModel ? normalizeModelKey(hpModalModel) : "";
  const activeModel = useMemo(
    () => availableModels.find((m) => normalizeModelKey(m.value) === activeModelKey) ?? null,
    [activeModelKey, availableModels]
  );
  const activeModelSchema = modelHpSchema[activeModelKey] ?? {};
  // Filter out fields that don't apply to the current task type (e.g. class_weight in regression).
  const activeModelFields = useMemo(
    () =>
      Object.entries(activeModelSchema).filter(([, fieldSchema]) => {
        const supportedIn = fieldSchema.supported_in;
        if (!supportedIn || supportedIn.length === 0) return true;
        return supportedIn.includes(config.taskType);
      }),
    [activeModelSchema, config.taskType]
  );
  const activeModelSelected = useMemo(
    () => (config.models ?? []).some((m) => normalizeModelKey(m) === activeModelKey),
    [activeModelKey, config.models]
  );

  const setModelField = (modelKey: string, fieldName: string, value: ModelHyperparamValue | undefined) => {
    const nextHyperparams: Record<string, Record<string, ModelHyperparamValue>> = {
      ...(modelHyperparams ?? {}),
    };
    const currentModelFields: Record<string, ModelHyperparamValue> = {
      ...(nextHyperparams[modelKey] ?? {}),
    };

    if (value === undefined || value === "") {
      delete currentModelFields[fieldName];
    } else {
      currentModelFields[fieldName] = value;
    }

    if (Object.keys(currentModelFields).length === 0) {
      delete nextHyperparams[modelKey];
    } else {
      nextHyperparams[modelKey] = currentModelFields;
    }

    onConfigChange({ modelHyperparams: nextHyperparams });
  };

  const toggleModel = (rawModel: ModelType, installed: boolean) => {
    if (!installed) return;
    const selected = config.models.includes(rawModel);
    const nextModels = selected ? config.models.filter((x) => x !== rawModel) : [...config.models, rawModel];
    // Keep per-model hyperparams untouched when toggling model selection.
    // This preserves user edits while selecting additional models.
    onConfigChange({ models: nextModels });
  };

  return (
    <div className="space-y-6">
      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            Algorithmes
            <Badge variant="secondary" className="ml-auto text-xs">
              {config.models.length} selectionne{config.models.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {availableModels.map((m, i) => {
              const selected = config.models.includes(m.value);
              const modelKey = normalizeModelKey(m.value);
              const hasHpSchema = Object.keys(modelHpSchema[modelKey] ?? {}).length > 0;
              return (
                <motion.label
                  key={m.value}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                    m.installed ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    selected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  {hasHpSchema && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      disabled={!m.installed}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHpModalModel(modelKey);
                      }}
                      aria-label={`Configurer hyperparametres ${m.label}`}
                      title="Hyperparametres"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                  <Checkbox
                    checked={selected}
                    disabled={!m.installed}
                    onCheckedChange={() => toggleModel(m.value, m.installed)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{m.icon}</span>
                      <span className="font-semibold text-sm">{m.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                    {!m.installed && <p className="text-[11px] text-destructive mt-1">Non installe sur le backend</p>}
                  </div>
                </motion.label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(hpModalModel)}
        onOpenChange={(open) => {
          if (!open) setHpModalModel(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Hyperparametres
              <Badge variant="outline" className="uppercase">
                {activeModel?.label ?? activeModelKey}
              </Badge>
              {(config.searchType ?? "none") !== "none" && (
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  Listes: separees par virgules
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeModelSelected
                ? "Modifiez les hyperparametres du modele selectionne."
                : "Modele non selectionne: les valeurs seront conservees mais ignorees tant que le modele n'est pas coche."}
            </DialogDescription>
          </DialogHeader>

          {!activeModelFields.length ? (
            <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
              Aucun hyperparametre configurable pour ce modele.
            </div>
          ) : (
            <div className="space-y-3">
              {activeModelFields.map(([fieldName, fieldSchema]) => {
                const rawModelValue = modelHyperparams[activeModelKey]?.[fieldName];
                const displayValue = toDisplayText(rawModelValue, fieldSchema.default);
                const fieldType = String(fieldSchema.type ?? "").toLowerCase();
                const enumOptions = Array.isArray(fieldSchema.enum) ? fieldSchema.enum : [];
                const isSearchActive = (config.searchType ?? "none") !== "none";
                const isEnumSelect = !isSearchActive && fieldType === "enum";
                const isEnumOrNullSelect = !isSearchActive && fieldType === "enum_or_null";

                // For enum_or_null: sentinel string "null" maps to null value; actual null → "null" sentinel.
                const enumOrNullValue =
                  rawModelValue === null || rawModelValue === undefined
                    ? String(fieldSchema.default ?? "null")
                    : String(rawModelValue);

                const handleEnumOrNull = (next: string) => {
                  setModelField(activeModelKey, fieldName, next === "null" ? null : next);
                };

                return (
                  <div key={`${activeModelKey}-${fieldName}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs font-medium">{fieldName}</Label>
                      <span className="text-[11px] text-muted-foreground">
                        Default: {String(fieldSchema.default ?? "null")}
                      </span>
                    </div>

                    {isEnumSelect ? (
                      <Select
                        value={String((rawModelValue as ModelHyperparamScalar) ?? fieldSchema.default ?? "")}
                        onValueChange={(next) => setModelField(activeModelKey, fieldName, next)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                          {enumOptions.map((opt) => (
                            <SelectItem key={`${activeModelKey}-${fieldName}-${opt}`} value={String(opt)}>
                              {String(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : isEnumOrNullSelect ? (
                      <Select value={enumOrNullValue} onValueChange={handleEnumOrNull}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">
                            <span className="text-muted-foreground italic">null — désactivé</span>
                          </SelectItem>
                          {enumOptions.map((opt) => (
                            <SelectItem key={`${activeModelKey}-${fieldName}-${opt}`} value={String(opt)}>
                              {String(opt)}
                              {String(opt) === String(fieldSchema.default) && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground">(défaut)</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={fieldType === "int" || fieldType === "float" ? "number" : "text"}
                        value={displayValue}
                        onChange={(e) =>
                          setModelField(
                            activeModelKey,
                            fieldName,
                            parseFieldValue(e.target.value, fieldSchema, isSearchActive)
                          )
                        }
                        className="h-8 text-xs"
                        placeholder={isSearchActive ? "ex: 100,200" : `ex: ${String(fieldSchema.default ?? "")}`}
                      />
                    )}

                    {!!fieldSchema.help && <p className="text-[11px] text-muted-foreground">{fieldSchema.help}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-xs text-muted-foreground mt-1">Analyse du desequilibre en cours...</p>
              )}
              {config.taskType === "classification" && !balanceLoading && !!balanceError && (
                <p className="text-xs text-warning mt-1">{balanceError}</p>
              )}
              {config.taskType === "classification" && !balanceLoading && !!balanceAnalysis && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{balanceAnalysis.summary_message}</p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <Badge
                      variant={balanceAnalysis.needs_balancing ? "destructive" : "outline"}
                      className={cn(
                        !balanceAnalysis.needs_balancing && "border-emerald-500 text-emerald-600 gap-1"
                      )}
                    >
                      {!balanceAnalysis.needs_balancing && <CheckCircle2 className="h-3 w-3" />}
                      {balanceAnalysis.imbalance_level}
                    </Badge>
                    <span className="text-muted-foreground">
                      IR={Number(balanceAnalysis.imbalance_ratio).toFixed(2)} | minority=
                      {(Number(balanceAnalysis.minority_ratio) * 100).toFixed(1)}%
                    </span>
                  </div>
                  {!balanceAnalysis.needs_balancing && balancing.strategy === "none" && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 text-[11px] flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Dataset déjà équilibré — aucun rééchantillonnage nécessaire.</span>
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
                      {strategy.label}
                      {"recommended" in strategy && strategy.recommended ? " (recommande)" : ""}
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

        <Card className="glass-premium shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-primary/10">
                <Grid3X3 className="h-4 w-4 text-primary" />
              </div>
              Optimisation des hyperparametres
              {(config.searchType ?? "none") !== "none" && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {config.gridCvFolds} folds
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="search-type" className="text-xs text-muted-foreground">Methode de recherche</Label>
              <Select
                value={config.searchType ?? "none"}
                onValueChange={(v) => onConfigChange({
                  searchType: v as SearchType,
                  useGridSearch: v !== "none",
                })}
              >
                <SelectTrigger id="search-type" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span>Aucune</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Parametres fixes uniquement</span>
                  </SelectItem>
                  <SelectItem value="grid">
                    <span>GridSearch</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Grille fixe, exhaustif</span>
                  </SelectItem>
                  <SelectItem value="random">
                    <span>RandomizedSearch</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Espace continu, plus efficace</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <AnimatePresence initial={false}>
              {(config.searchType ?? "none") !== "none" && (
                <motion.div
                  key="search-config"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-2 border-t border-border/40">
                    {config.searchType === "random" && (
                      <div className="space-y-1">
                        <Label htmlFor="n-iter" className="text-xs text-muted-foreground">Nombre d'iterations</Label>
                        <Input
                          id="n-iter"
                          type="number"
                          min={5}
                          max={300}
                          value={config.nIterRandomSearch ?? 40}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 5 && v <= 300) {
                              onConfigChange({ nIterRandomSearch: v });
                            }
                          }}
                          className="w-24 h-8 text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">Entre 5 et 300 (defaut: 40)</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="cv-folds" className="text-xs text-muted-foreground">CV Folds</Label>
                      <Input
                        id="cv-folds"
                        type="number"
                        min={2}
                        max={10}
                        value={config.gridCvFolds}
                        onChange={(e) => handleCvFoldsChange(e.target.value)}
                        className={cn("w-24 h-8 text-xs", cvFoldsError && "border-destructive")}
                      />
                      {cvFoldsError ? (
                        <p className="text-[11px] text-destructive">{cvFoldsError}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Entre 2 et 10 (defaut: 3)</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="gs-scoring" className="text-xs text-muted-foreground">Scoring</Label>
                      <Select
                        value={config.gridScoring}
                        onValueChange={(v) => onConfigChange({ gridScoring: v as GridScoringOption })}
                      >
                        <SelectTrigger id="gs-scoring" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scoringOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <span>{o.label}</span>
                              <span className="ml-2 text-[10px] text-muted-foreground">{o.desc}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {config.models.length >= 3 && (
                      <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 text-[11px] flex items-start gap-2 text-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {config.searchType === "random"
                            ? `RandomizedSearch avec ${config.models.length} modeles × ${config.nIterRandomSearch ?? 40} iterations`
                            : `GridSearch avec ${config.models.length} modeles × ${config.gridCvFolds} folds`}{" "}
                          peut significativement allonger le temps d'entrainement.
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      <Dialog open={pendingStrategy !== null} onOpenChange={(open) => { if (!open) setPendingStrategy(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Dataset equilibre — strategie non necessaire
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">{balanceAnalysis?.summary_message}</span>
              <span className="block">
                La strategie <strong>{pendingStrategy}</strong> n'est pas necessaire sur un dataset equilibre et pourrait
                desequilibrer artificiellement l'entrainement. Voulez-vous quand meme l'appliquer?
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingStrategy(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingStrategy) applyBalancing({ strategy: pendingStrategy });
                setPendingStrategy(null);
              }}
            >
              Appliquer quand meme
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Step4Models;
