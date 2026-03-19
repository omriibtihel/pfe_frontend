import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Percent,
  Scissors,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { trainingService } from "@/services/trainingService";
import type { TrainingConfig } from "@/types";
import { HOLDOUT_PRESETS, type HoldoutPreset } from "@/components/training/constants";

type SplitMethod = "holdout" | "kfold" | "stratified_kfold";

interface Step2Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

function clampInt(n: unknown, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function normalizeRatios(train: number, val: number, test: number) {
  let t = clampInt(train, 1, 98);
  let v = clampInt(val, 0, 98);
  let te = clampInt(test, 0, 98);

  const sum = t + v + te;
  if (sum === 100) return { train: t, val: v, test: te };

  let diff = 100 - sum;
  te = clampInt(te + diff, 0, 99);
  diff = 100 - (t + v + te);
  v = clampInt(v + diff, 0, 99);
  diff = 100 - (t + v + te);
  t = clampInt(t + diff, 1, 100);
  const finalDiff = 100 - (t + v + te);
  te = clampInt(te + finalDiff, 0, 100);

  return { train: t, val: v, test: te };
}

const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  holdout: "Holdout (train/val/test)",
  kfold: "K-Fold",
  stratified_kfold: "Stratified K-Fold",
};

const SPLIT_METHOD_DESCRIPTIONS: Record<SplitMethod, string> = {
  holdout: "Division unique en train/validation/test. Rapide et lisible.",
  kfold: "Evaluation sur K partitions pour une estimation plus stable.",
  stratified_kfold: "Version K-Fold qui preserve les proportions de classes.",
};

export function Step2SplitStrategy({ projectId, config, onConfigChange }: Step2Props) {
  const [supportedMethods, setSupportedMethods] = useState<SplitMethod[]>([
    "holdout",
    "kfold",
    "stratified_kfold",
  ]);

  const splitMethod = (config.splitMethod as SplitMethod) ?? "holdout";
  const taskType = config.taskType ?? "classification";

  const ratios = useMemo(() => {
    return normalizeRatios(config.trainRatio ?? 70, config.valRatio ?? 15, config.testRatio ?? 15);
  }, [config.trainRatio, config.valRatio, config.testRatio]);

  useEffect(() => {
    let mounted = true;
    const loadCapabilities = async () => {
      try {
        const caps = await trainingService.getCapabilities(projectId);
        if (!mounted) return;
        const methods = (caps.supportedSplitMethods ?? [])
          .map((m: string) => String(m))
          .filter(
            (m: string): m is SplitMethod =>
              m === "holdout" || m === "kfold" || m === "stratified_kfold"
          );
        setSupportedMethods(methods.length ? methods : ["holdout", "kfold", "stratified_kfold"]);
      } catch {
        if (!mounted) return;
        setSupportedMethods(["holdout", "kfold", "stratified_kfold"]);
      }
    };
    loadCapabilities();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Auto-fix: stratified_kfold is only valid for classification.
  useEffect(() => {
    const methodAvailable = supportedMethods.includes(splitMethod);
    const stratifiedOnRegression = splitMethod === "stratified_kfold" && taskType === "regression";
    if (!methodAvailable || stratifiedOnRegression) {
      onConfigChange({ splitMethod: "holdout" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMethod, taskType, supportedMethods.join(",")]);

  useEffect(() => {
    const same =
      ratios.train === (config.trainRatio ?? 70) &&
      ratios.val === (config.valRatio ?? 15) &&
      ratios.test === (config.testRatio ?? 15);
    if (!same) {
      onConfigChange({ trainRatio: ratios.train, valRatio: ratios.val, testRatio: ratios.test });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratios.train, ratios.val, ratios.test]);

  const showHoldout = splitMethod === "holdout";
  const showFolds =
    (splitMethod === "kfold" || splitMethod === "stratified_kfold") &&
    (supportedMethods.includes("kfold") || supportedMethods.includes("stratified_kfold"));
  const totalOk = ratios.train + ratios.val + ratios.test === 100;

  const availableMethods = supportedMethods.filter(
    (m) => m !== "stratified_kfold" || taskType === "classification"
  );
  const selectableMethods = availableMethods.length ? availableMethods : ["holdout"];

  const shuffle = config.shuffle ?? true;
  const cvTestRatio = showFolds ? clampInt(config.testRatio ?? 0, 0, 40) : 0;

  const activePreset = HOLDOUT_PRESETS.find(
    (preset) =>
      preset.train === ratios.train && preset.val === ratios.val && preset.test === ratios.test
  );

  const applyHoldoutPreset = useCallback((preset: HoldoutPreset) => {
    onConfigChange({ trainRatio: preset.train, valRatio: preset.val, testRatio: preset.test });
  }, [onConfigChange]);

  const handleTrainChange = useCallback((rawValue: unknown) => {
    const train = clampInt(rawValue, 50, 95);
    const remaining = 100 - train;
    const currentOther = ratios.val + ratios.test;

    if (currentOther <= 0) {
      onConfigChange({ trainRatio: train, valRatio: 0, testRatio: remaining });
      return;
    }

    const val = clampInt(Math.round((ratios.val / currentOther) * remaining), 0, remaining);
    const test = remaining - val;
    onConfigChange({ trainRatio: train, valRatio: val, testRatio: test });
  }, [onConfigChange, ratios.val, ratios.test]);

  const handleValidationChange = useCallback((rawValue: unknown) => {
    const remaining = 100 - ratios.train;
    const val = clampInt(rawValue, 0, remaining);
    onConfigChange({ valRatio: val, testRatio: remaining - val });
  }, [onConfigChange, ratios.train]);

  const handleRatioInput = useCallback((field: "train" | "val" | "test", rawValue: string) => {
    if (field === "train") {
      handleTrainChange(rawValue);
      return;
    }

    const remaining = 100 - ratios.train;
    if (field === "val") {
      const val = clampInt(rawValue, 0, remaining);
      onConfigChange({ valRatio: val, testRatio: remaining - val });
      return;
    }

    const test = clampInt(rawValue, 0, remaining);
    onConfigChange({ valRatio: remaining - test, testRatio: test });
  }, [handleTrainChange, onConfigChange, ratios.train]);

  return (
    <div className="space-y-6">
      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-xl bg-primary/10 p-2">
              <Scissors className="h-4 w-4 text-primary" />
            </div>
            Strategie de split
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Select
            value={splitMethod}
            onValueChange={(v) => {
              const next = v as SplitMethod;
              if (next === "holdout") {
                onConfigChange({
                  splitMethod: "holdout",
                  trainRatio: ratios.train || 70,
                  valRatio: ratios.val ?? 15,
                  testRatio: ratios.test ?? 15,
                });
              } else {
                onConfigChange({
                  splitMethod: next,
                  kFolds: config.kFolds ?? 5,
                  shuffle: config.shuffle ?? true,
                  testRatio: 0,
                });
              }
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Choisir une methode" />
            </SelectTrigger>
            <SelectContent>
              {selectableMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {SPLIT_METHOD_LABELS[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">{SPLIT_METHOD_DESCRIPTIONS[splitMethod]}</p>

          {splitMethod === "stratified_kfold" && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Les proportions de classes sont preservees dans chaque fold.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              FIT = train fold uniquement
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Resampling = train fold uniquement
            </Badge>
          </div>
        </CardContent>
      </Card>

      {showHoldout && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-xl bg-secondary/10 p-2">
                  <Percent className="h-4 w-4 text-secondary" />
                </div>
                Repartition Holdout
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {activePreset ? `Preset ${activePreset.label}` : "Personnalise"}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Apercu de la repartition</p>
                  <Badge variant={totalOk ? "secondary" : "destructive"} className="tabular-nums">
                    {ratios.train + ratios.val + ratios.test}%
                  </Badge>
                </div>

                <div className="flex h-9 overflow-hidden rounded-xl border border-border/60 bg-background">
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 32 }}
                    className="flex items-center justify-center bg-primary text-primary-foreground"
                    style={{ width: `${ratios.train}%` }}
                  >
                    {ratios.train >= 20 && (
                      <span className="text-[11px] font-semibold tabular-nums">Train {ratios.train}%</span>
                    )}
                  </motion.div>
                  {ratios.val > 0 && (
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 300, damping: 32 }}
                      className="flex items-center justify-center bg-secondary text-secondary-foreground"
                      style={{ width: `${ratios.val}%` }}
                    >
                      {ratios.val >= 10 && (
                        <span className="text-[11px] font-semibold tabular-nums">Val {ratios.val}%</span>
                      )}
                    </motion.div>
                  )}
                  {ratios.test > 0 && (
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 300, damping: 32 }}
                      className="flex items-center justify-center bg-accent text-accent-foreground"
                      style={{ width: `${ratios.test}%` }}
                    >
                      {ratios.test >= 10 && (
                        <span className="text-[11px] font-semibold tabular-nums">Test {ratios.test}%</span>
                      )}
                    </motion.div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Train et validation servent a l'entrainement/ajustement. Le test reste reserve a
                  l'evaluation finale.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Prereglages rapides
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {HOLDOUT_PRESETS.map((preset) => {
                    const isActive =
                      ratios.train === preset.train &&
                      ratios.val === preset.val &&
                      ratios.test === preset.test;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyHoldoutPreset(preset)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/60 bg-background hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold tabular-nums">{preset.label}</span>
                          {preset.recommended && (
                            <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                              Reco
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-5 rounded-2xl border border-border/60 p-4 lg:col-span-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <Label>Train (%)</Label>
                      <span className="font-semibold tabular-nums">{ratios.train}%</span>
                    </div>
                    <Slider
                      value={[ratios.train]}
                      min={50}
                      max={95}
                      step={1}
                      onValueChange={([value]) => handleTrainChange(value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <Label>Validation / Test (%)</Label>
                      <span className="font-semibold tabular-nums">
                        Val {ratios.val}% | Test {ratios.test}%
                      </span>
                    </div>
                    <Slider
                      value={[ratios.val]}
                      min={0}
                      max={Math.max(0, 100 - ratios.train)}
                      step={1}
                      onValueChange={([value]) => handleValidationChange(value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ce curseur ajuste Validation. Test est calcule automatiquement.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="holdout-train-input" className="text-xs text-muted-foreground">
                        Train (%)
                      </Label>
                      <Input
                        id="holdout-train-input"
                        type="number"
                        min={50}
                        max={95}
                        value={String(ratios.train)}
                        onChange={(e) => handleRatioInput("train", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="holdout-val-input" className="text-xs text-muted-foreground">
                        Validation (%)
                      </Label>
                      <Input
                        id="holdout-val-input"
                        type="number"
                        min={0}
                        max={Math.max(0, 100 - ratios.train)}
                        value={String(ratios.val)}
                        onChange={(e) => handleRatioInput("val", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="holdout-test-input" className="text-xs text-muted-foreground">
                        Test (%)
                      </Label>
                      <Input
                        id="holdout-test-input"
                        type="number"
                        min={0}
                        max={Math.max(0, 100 - ratios.train)}
                        value={String(ratios.test)}
                        onChange={(e) => handleRatioInput("test", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                  <p className="text-sm font-medium">Conseils rapides</p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    <li>70/15/15 est un bon point de depart.</li>
                    <li>Si peu de donnees, mettez Validation a 0 et utilisez K-Fold.</li>
                    <li>Gardez idealement 10% a 20% pour le test final.</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline">Train: {ratios.train}%</Badge>
                    <Badge variant="outline">Val: {ratios.val}%</Badge>
                    <Badge variant="outline">Test: {ratios.test}%</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {showFolds && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-xl bg-accent/10 p-2">
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                Parametres Cross-Validation
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kfold-input" className="text-xs text-muted-foreground">
                    Nombre de folds (k)
                  </Label>
                  <Input
                    id="kfold-input"
                    type="number"
                    value={String(config.kFolds ?? 5)}
                    onChange={(e) => onConfigChange({ kFolds: clampInt(e.target.value, 2, 20) })}
                  />
                  <p className="text-xs text-muted-foreground">Recommandation: 5 ou 10 (max: 20).</p>
                </div>

                <div className="space-y-4 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label htmlFor="shuffle-toggle" className="cursor-pointer text-sm">
                        Melanger (shuffle)
                      </Label>
                    </div>
                    <Switch
                      id="shuffle-toggle"
                      checked={shuffle}
                      onCheckedChange={(checked) => onConfigChange({ shuffle: checked })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommande sauf si les donnees sont ordonnees temporellement.
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm">Test set holdout (optionnel)</Label>
                  </div>
                  <Badge variant={cvTestRatio > 0 ? "default" : "outline"} className="text-xs">
                    {cvTestRatio > 0 ? `${cvTestRatio}%` : "Desactive"}
                  </Badge>
                </div>
                <Slider
                  value={[cvTestRatio]}
                  min={0}
                  max={40}
                  step={5}
                  onValueChange={([value]) => onConfigChange({ testRatio: value })}
                />
                <p className="text-xs text-muted-foreground">
                  {cvTestRatio > 0
                    ? `${cvTestRatio}% est reserve comme test final. La CV s'execute sur ${100 - cvTestRatio}% du dataset.`
                    : "CV sur 100% des donnees (mode standard)."}
                </p>
                {cvTestRatio > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">CV: {100 - cvTestRatio}%</Badge>
                    <Badge variant="outline">Test final: {cvTestRatio}%</Badge>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Garanties anti-leakage</p>
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {cvTestRatio > 0 && (
                    <li>Le holdout test est separe avant toute CV et n'est jamais vu au training.</li>
                  )}
                  <li>Preprocessing fit uniquement sur train_fold.</li>
                  <li>Resampling applique uniquement sur train_fold.</li>
                  <li>Metriques CV calculees sur val_fold non contamine.</li>
                  <li>
                    Modele final refit sur{" "}
                    {cvTestRatio > 0 ? (
                      <strong>les {100 - cvTestRatio}% non-test</strong>
                    ) : (
                      <strong>toutes les donnees</strong>
                    )}{" "}
                    apres validation.
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{config.kFolds ?? 5} folds</Badge>
                <Badge variant={splitMethod === "stratified_kfold" ? "default" : "secondary"}>
                  {splitMethod === "stratified_kfold" ? "Stratifie" : "Non stratifie"}
                </Badge>
                <Badge variant={shuffle ? "secondary" : "outline"}>
                  {shuffle ? "Shuffle actif" : "No shuffle"}
                </Badge>
                {cvTestRatio > 0 && <Badge variant="default">Test holdout {cvTestRatio}%</Badge>}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default Step2SplitStrategy;
