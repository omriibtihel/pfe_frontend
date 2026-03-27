import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Layers,
  Percent,
  Scissors,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Target,
  Users,
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
import type { SplitMethod, TrainingConfig } from "@/types";
import { HOLDOUT_PRESETS, type HoldoutPreset } from "@/components/training/constants";

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
  holdout: "Holdout (train / val / test)",
  kfold: "K-Fold",
  stratified_kfold: "K-Fold Stratifié",
  repeated_stratified_kfold: "Repeated Stratified K-Fold",
  group_kfold: "Group K-Fold",
  stratified_group_kfold: "Stratified Group K-Fold",
  loo: "Leave-One-Out (LOO)",
};

const SPLIT_METHOD_DESCRIPTIONS: Record<SplitMethod, string> = {
  holdout: "Division unique en entraînement / validation / test. Rapide et lisible.",
  kfold: "Évaluation sur K partitions pour une estimation plus stable.",
  stratified_kfold: "K-Fold qui préserve les proportions de classes dans chaque fold.",
  repeated_stratified_kfold:
    "Répète le Stratified K-Fold plusieurs fois (seeds différents). Réduit la variance des estimations — recommandé pour les petits datasets médicaux.",
  group_kfold:
    "Garantit qu'un même groupe (ex: patient) ne se retrouve jamais dans train ET validation. Empêche le data leakage au niveau patient.",
  stratified_group_kfold:
    "Comme Group K-Fold, mais préserve aussi les proportions de classes. Optimal pour la classification sur données médicales.",
  loo: "Entraîne sur n-1 échantillons, teste sur 1 — répété n fois. Idéal pour les très petits datasets (n ≤ 500).",
};

// Methods restricted to classification only
const CLASSIFICATION_ONLY: SplitMethod[] = [
  "stratified_kfold",
  "repeated_stratified_kfold",
  "stratified_group_kfold",
];

// Methods requiring groupColumn
const GROUP_METHODS: SplitMethod[] = ["group_kfold", "stratified_group_kfold"];

// Methods that use kFolds
const FOLD_METHODS: SplitMethod[] = [
  "kfold",
  "stratified_kfold",
  "repeated_stratified_kfold",
  "group_kfold",
  "stratified_group_kfold",
];

export function Step2SplitStrategy({ projectId, config, onConfigChange }: Step2Props) {
  const [supportedMethods, setSupportedMethods] = useState<SplitMethod[]>([
    "holdout",
    "kfold",
    "stratified_kfold",
    "repeated_stratified_kfold",
    "group_kfold",
    "stratified_group_kfold",
    "loo",
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
        const allValid: SplitMethod[] = [
          "holdout", "kfold", "stratified_kfold",
          "repeated_stratified_kfold", "group_kfold", "stratified_group_kfold", "loo",
        ];
        const methods = (caps.supportedSplitMethods ?? [])
          .map((m: string) => String(m))
          .filter((m: string): m is SplitMethod => allValid.includes(m as SplitMethod));
        setSupportedMethods(methods.length ? methods : allValid);
      } catch {
        if (!mounted) return;
      }
    };
    loadCapabilities();
    return () => { mounted = false; };
  }, [projectId]);

  // Auto-fix: classification-only methods switched back on regression
  useEffect(() => {
    const isClassOnly = CLASSIFICATION_ONLY.includes(splitMethod);
    if (isClassOnly && taskType === "regression") {
      // Downgrade to the non-stratified equivalent or holdout
      if (splitMethod === "stratified_group_kfold") {
        onConfigChange({ splitMethod: "group_kfold" });
      } else {
        onConfigChange({ splitMethod: "holdout" });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMethod, taskType]);

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

  // Derived display flags
  const showHoldout = splitMethod === "holdout";
  const showFolds = FOLD_METHODS.includes(splitMethod);
  const showRepeats = splitMethod === "repeated_stratified_kfold";
  const showGroup = GROUP_METHODS.includes(splitMethod);
  const showLoo = splitMethod === "loo";
  const totalOk = ratios.train + ratios.val + ratios.test === 100;

  const availableMethods = supportedMethods.filter(
    (m) => !CLASSIFICATION_ONLY.includes(m) || taskType === "classification"
  );
  const selectableMethods = availableMethods.length ? availableMethods : (["holdout"] as SplitMethod[]);

  const shuffle = config.shuffle ?? true;
  const cvTestRatio = showFolds ? clampInt(config.testRatio ?? 0, 0, 40) : 0;
  const nRepeats = clampInt(config.nRepeats ?? 3, 1, 20);
  const groupColumn = config.groupColumn ?? "";

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
    if (field === "train") { handleTrainChange(rawValue); return; }
    const remaining = 100 - ratios.train;
    if (field === "val") {
      const val = clampInt(rawValue, 0, remaining);
      onConfigChange({ valRatio: val, testRatio: remaining - val });
      return;
    }
    const test = clampInt(rawValue, 0, remaining);
    onConfigChange({ valRatio: remaining - test, testRatio: test });
  }, [handleTrainChange, onConfigChange, ratios.train]);

  const handleMethodChange = useCallback((v: string) => {
    const next = v as SplitMethod;
    if (next === "holdout") {
      onConfigChange({
        splitMethod: "holdout",
        trainRatio: ratios.train || 70,
        valRatio: ratios.val ?? 15,
        testRatio: ratios.test ?? 15,
      });
    } else if (next === "loo") {
      onConfigChange({ splitMethod: "loo", testRatio: 0 });
    } else {
      onConfigChange({
        splitMethod: next,
        kFolds: config.kFolds ?? 5,
        shuffle: config.shuffle ?? true,
        testRatio: 0,
        nRepeats: config.nRepeats ?? 3,
        groupColumn: config.groupColumn ?? "",
      });
    }
  }, [onConfigChange, ratios, config.kFolds, config.shuffle, config.nRepeats, config.groupColumn]);

  return (
    <div className="space-y-6">
      {/* ── Method selector ── */}
      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-xl bg-primary/10 p-2">
              <Scissors className="h-4 w-4 text-primary" />
            </div>
            Stratégie de split
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Select value={splitMethod} onValueChange={handleMethodChange}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Choisir une méthode" />
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

          {/* Classification-only badges */}
          {(splitMethod === "stratified_kfold" || splitMethod === "repeated_stratified_kfold" || splitMethod === "stratified_group_kfold") && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Les proportions de classes sont préservées dans chaque fold.</span>
            </div>
          )}

          {/* Group methods info */}
          {showGroup && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                Tous les enregistrements d'un même groupe (ex: patient) restent dans le même fold.
                Élimine le <strong>data leakage au niveau patient</strong>.
              </span>
            </div>
          )}

          {/* LOO warning */}
          {showLoo && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                LOO est limité à <strong>500 échantillons</strong>. Le temps d'entraînement est
                proportionnel à n.
              </span>
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

      {/* ── Holdout ratios ── */}
      {showHoldout && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-xl bg-secondary/10 p-2">
                  <Percent className="h-4 w-4 text-secondary" />
                </div>
                Répartition Holdout
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {activePreset ? `Preset ${activePreset.label}` : "Personnalisé"}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Aperçu de la répartition</p>
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
                  Train et validation servent à l'entraînement/ajustement. Le test reste réservé à
                  l'évaluation finale.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Préréglages rapides
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
                      Ce curseur ajuste Validation. Test est calculé automatiquement.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(["train", "val", "test"] as const).map((field) => (
                      <div key={field} className="space-y-1.5">
                        <Label htmlFor={`holdout-${field}-input`} className="text-xs text-muted-foreground capitalize">
                          {field} (%)
                        </Label>
                        <Input
                          id={`holdout-${field}-input`}
                          type="number"
                          min={field === "train" ? 50 : 0}
                          max={field === "train" ? 95 : Math.max(0, 100 - ratios.train)}
                          value={String(ratios[field])}
                          onChange={(e) => handleRatioInput(field, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                  <p className="text-sm font-medium">Conseils rapides</p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    <li>70/15/15 est un bon point de départ.</li>
                    <li>Si peu de données, mettez Validation à 0 et utilisez K-Fold.</li>
                    <li>Gardez idéalement 10% à 20% pour le test final.</li>
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

      {/* ── CV parameters (kfold + all variants) ── */}
      {showFolds && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-xl bg-accent/10 p-2">
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                Paramètres Cross-Validation
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                {/* kFolds */}
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

                {/* Shuffle — disabled for group methods (not applicable) */}
                {!showGroup && (
                  <div className="space-y-4 rounded-2xl border border-border/60 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="shuffle-toggle" className="cursor-pointer text-sm">
                          Mélanger (shuffle)
                        </Label>
                      </div>
                      <Switch
                        id="shuffle-toggle"
                        checked={shuffle}
                        onCheckedChange={(checked) => onConfigChange({ shuffle: checked })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommandé sauf si les données sont ordonnées temporellement.
                    </p>
                  </div>
                )}
              </div>

              {/* nRepeats — repeated_stratified_kfold only */}
              {showRepeats && (
                <div className="space-y-2 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <Label htmlFor="nrepeats-input">Nombre de répétitions</Label>
                    <span className="font-semibold tabular-nums">
                      {nRepeats} × {config.kFolds ?? 5} = {nRepeats * (config.kFolds ?? 5)} folds
                    </span>
                  </div>
                  <Slider
                    value={[nRepeats]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={([value]) => onConfigChange({ nRepeats: value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Plus de répétitions = estimations plus stables, mais entraînement plus long.
                    Recommandation: 3 à 5.
                  </p>
                </div>
              )}

              {/* groupColumn — group_kfold / stratified_group_kfold */}
              {showGroup && (
                <div className="space-y-2 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="group-col-input" className="text-sm">
                      Colonne de groupe <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  <Input
                    id="group-col-input"
                    placeholder="ex: patient_id"
                    value={groupColumn}
                    onChange={(e) => onConfigChange({ groupColumn: e.target.value.trim() })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nom de la colonne identifiant le groupe (ex: patient_id, subject_id). Cette
                    colonne est exclue des features automatiquement.
                  </p>
                  {!groupColumn && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>La colonne de groupe est obligatoire pour cette méthode.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Holdout test set (CV mode) */}
              <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm">Test set holdout (optionnel)</Label>
                  </div>
                  <Badge variant={cvTestRatio > 0 ? "default" : "outline"} className="text-xs">
                    {cvTestRatio > 0 ? `${cvTestRatio}%` : "Désactivé"}
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
                    ? `${cvTestRatio}% est réservé comme test final. La CV s'exécute sur ${100 - cvTestRatio}% du dataset.`
                    : "CV sur 100% des données (mode standard)."}
                </p>
                {showGroup && cvTestRatio > 0 && (
                  <p className="text-xs text-blue-500">
                    GroupShuffleSplit utilisé : aucun patient ne se retrouvera dans CV et test simultanément.
                  </p>
                )}
                {cvTestRatio > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">CV: {100 - cvTestRatio}%</Badge>
                    <Badge variant="outline">Test final: {cvTestRatio}%</Badge>
                  </div>
                )}
              </div>

              {/* Anti-leakage guarantees */}
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Garanties anti-leakage</p>
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {cvTestRatio > 0 && (
                    <li>Le holdout test est séparé avant toute CV et n'est jamais vu au training.</li>
                  )}
                  <li>Preprocessing fit uniquement sur train_fold.</li>
                  <li>Resampling appliqué uniquement sur train_fold.</li>
                  <li>Métriques CV calculées sur val_fold non contaminé.</li>
                  {showGroup && (
                    <li>Groupes garantis intacts : aucun patient ne se retrouve dans train ET val.</li>
                  )}
                  <li>
                    Modèle final refit sur{" "}
                    {cvTestRatio > 0 ? (
                      <strong>les {100 - cvTestRatio}% non-test</strong>
                    ) : (
                      <strong>toutes les données</strong>
                    )}{" "}
                    après validation.
                  </li>
                </ul>
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{config.kFolds ?? 5} folds</Badge>
                {showRepeats && (
                  <Badge variant="default">{nRepeats} répétitions</Badge>
                )}
                {showGroup && groupColumn && (
                  <Badge variant="default">Groupe: {groupColumn}</Badge>
                )}
                {!showGroup && (
                  <Badge variant={shuffle ? "secondary" : "outline"}>
                    {shuffle ? "Shuffle actif" : "No shuffle"}
                  </Badge>
                )}
                <Badge variant={CLASSIFICATION_ONLY.includes(splitMethod) ? "default" : "secondary"}>
                  {CLASSIFICATION_ONLY.includes(splitMethod) ? "Stratifié" : "Non stratifié"}
                </Badge>
                {cvTestRatio > 0 && <Badge variant="default">Test holdout {cvTestRatio}%</Badge>}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── LOO info panel ── */}
      {showLoo && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-xl bg-amber-500/10 p-2">
                  <Layers className="h-4 w-4 text-amber-500" />
                </div>
                Leave-One-Out — Paramètres
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                  Comportement LOO
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs text-amber-600 dark:text-amber-400">
                  <li>
                    <strong>n entraînements</strong> (un par échantillon). Limite : n ≤ 500.
                  </li>
                  <li>
                    Preprocessing fit sur les <strong>n-1 échantillons</strong> de chaque fold.
                  </li>
                  <li>
                    Les métriques sont calculées <strong>globalement</strong> sur l'ensemble des
                    prédictions collectées (pas une moyenne par fold).
                  </li>
                  <li>
                    Modèle final refit sur <strong>toutes les données</strong> après évaluation.
                  </li>
                  <li>
                    GridSearch activé uniquement lors du refit final (jamais par fold).
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Garanties anti-leakage</p>
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  <li>Preprocessing fit sur les n-1 samples du fold uniquement.</li>
                  <li>SMOTE désactivé automatiquement si classe minoritaire trop petite.</li>
                  <li>Aucun data leakage entre folds — chaque fold est indépendant.</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">n folds (= n échantillons)</Badge>
                <Badge variant="secondary">Agrégation globale</Badge>
                <Badge variant="outline">n ≤ 500</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default Step2SplitStrategy;
