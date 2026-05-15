import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
            {t("preparation.split.cardTitle")}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Select value={splitMethod} onValueChange={handleMethodChange}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder={t("preparation.split.methodPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {selectableMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {t(`preparation.split.methodLabels.${method}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">{t(`preparation.split.methodDescriptions.${splitMethod}`)}</p>

          {/* Classification-only badges */}
          {(splitMethod === "stratified_kfold" || splitMethod === "repeated_stratified_kfold" || splitMethod === "stratified_group_kfold") && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{t("preparation.split.stratifiedBadge")}</span>
            </div>
          )}

          {/* Group methods info */}
          {showGroup && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("preparation.split.groupBadgePrefix")}{" "}
                <strong>{t("preparation.split.groupBadgeBold")}</strong>.
              </span>
            </div>
          )}

          {/* LOO warning */}
          {showLoo && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("preparation.split.looWarningPrefix")} <strong>{t("preparation.split.looWarningBold")}</strong>{t("preparation.split.looWarningSuffix")}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {t("preparation.split.fitBadge")}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {t("preparation.split.resamplingBadge")}
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
                {t("preparation.split.holdoutTitle")}
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {activePreset ? t("preparation.split.presetBadge", { label: activePreset.label }) : t("preparation.split.customBadge")}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t("preparation.split.overview")}</p>
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
                      <span className="text-[11px] font-semibold tabular-nums">{t("preparation.split.train")} {ratios.train}%</span>
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
                        <span className="text-[11px] font-semibold tabular-nums">{t("preparation.split.val")} {ratios.val}%</span>
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
                        <span className="text-[11px] font-semibold tabular-nums">{t("preparation.split.test")} {ratios.test}%</span>
                      )}
                    </motion.div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {t("preparation.split.overviewHint")}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t("preparation.split.presetsTitle")}
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
                              {t("preparation.split.presetReco")}
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
                      <Label>{t("preparation.split.labelTrain")}</Label>
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
                      <Label>{t("preparation.split.labelValTest")}</Label>
                      <span className="font-semibold tabular-nums">
                        {t("preparation.split.val")} {ratios.val}% | {t("preparation.split.test")} {ratios.test}%
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
                      {t("preparation.split.valTestHint")}
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
                  <p className="text-sm font-medium">{t("preparation.split.tipsTitle")}</p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                    <li>{t("preparation.split.tip1")}</li>
                    <li>{t("preparation.split.tip2")}</li>
                    <li>{t("preparation.split.tip3")}</li>
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline">{t("preparation.split.train")}: {ratios.train}%</Badge>
                    <Badge variant="outline">{t("preparation.split.val")}: {ratios.val}%</Badge>
                    <Badge variant="outline">{t("preparation.split.test")}: {ratios.test}%</Badge>
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
                {t("preparation.split.cvTitle")}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                {/* kFolds */}
                <div className="space-y-2">
                  <Label htmlFor="kfold-input" className="text-xs text-muted-foreground">
                    {t("preparation.split.foldsLabel")}
                  </Label>
                  <Input
                    id="kfold-input"
                    type="number"
                    value={String(config.kFolds ?? 5)}
                    onChange={(e) => onConfigChange({ kFolds: clampInt(e.target.value, 2, 20) })}
                  />
                  <p className="text-xs text-muted-foreground">{t("preparation.split.foldsHint")}</p>
                </div>

                {/* Shuffle — disabled for group methods (not applicable) */}
                {!showGroup && (
                  <div className="space-y-4 rounded-2xl border border-border/60 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="shuffle-toggle" className="cursor-pointer text-sm">
                          {t("preparation.split.shuffleLabel")}
                        </Label>
                      </div>
                      <Switch
                        id="shuffle-toggle"
                        checked={shuffle}
                        onCheckedChange={(checked) => onConfigChange({ shuffle: checked })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("preparation.split.shuffleHint")}
                    </p>
                  </div>
                )}
              </div>

              {/* nRepeats — repeated_stratified_kfold only */}
              {showRepeats && (
                <div className="space-y-2 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <Label htmlFor="nrepeats-input">{t("preparation.split.repeatsLabel")}</Label>
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
                    {t("preparation.split.repeatsHint")}
                  </p>
                </div>
              )}

              {/* groupColumn — group_kfold / stratified_group_kfold */}
              {showGroup && (
                <div className="space-y-2 rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="group-col-input" className="text-sm">
                      {t("preparation.split.groupColumnLabel")} <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  <Input
                    id="group-col-input"
                    placeholder={t("preparation.split.groupColumnPlaceholder")}
                    value={groupColumn}
                    onChange={(e) => onConfigChange({ groupColumn: e.target.value.trim() })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("preparation.split.groupColumnHint")}
                  </p>
                  {!groupColumn && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{t("preparation.split.groupColumnRequired")}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Holdout test set (CV mode) */}
              <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm">{t("preparation.split.holdoutTestLabel")}</Label>
                  </div>
                  <Badge variant={cvTestRatio > 0 ? "default" : "outline"} className="text-xs">
                    {cvTestRatio > 0 ? `${cvTestRatio}%` : t("preparation.split.disabled")}
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
                    ? t("preparation.split.holdoutTestActive", { ratio: cvTestRatio, cv: 100 - cvTestRatio })
                    : t("preparation.split.holdoutTestInactive")}
                </p>
                {showGroup && cvTestRatio > 0 && (
                  <p className="text-xs text-blue-500">
                    {t("preparation.split.groupHoldoutNote")}
                  </p>
                )}
                {cvTestRatio > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{t("preparation.split.cvSubset", { ratio: 100 - cvTestRatio })}</Badge>
                    <Badge variant="outline">{t("preparation.split.testFinal", { ratio: cvTestRatio })}</Badge>
                  </div>
                )}
              </div>

              {/* Anti-leakage guarantees */}
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("preparation.split.antiLeakageTitle")}</p>
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {cvTestRatio > 0 && (
                    <li>{t("preparation.split.antiLeakageHoldout")}</li>
                  )}
                  <li>{t("preparation.split.antiLeakagePrep")}</li>
                  <li>{t("preparation.split.antiLeakageResampling")}</li>
                  <li>{t("preparation.split.antiLeakageMetrics")}</li>
                  {showGroup && (
                    <li>{t("preparation.split.antiLeakageGroups")}</li>
                  )}
                  <li>
                    {t("preparation.split.antiLeakageRefit")}{" "}
                    {cvTestRatio > 0 ? (
                      <strong>{t("preparation.split.antiLeakageRefitTest", { ratio: 100 - cvTestRatio })}</strong>
                    ) : (
                      <strong>{t("preparation.split.antiLeakageRefitFull")}</strong>
                    )}{" "}
                    {t("preparation.split.antiLeakageRefitAfter")}
                  </li>
                </ul>
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{t("preparation.split.foldsCount", { n: config.kFolds ?? 5 })}</Badge>
                {showRepeats && (
                  <Badge variant="default">{t("preparation.split.repeatsCount", { n: nRepeats })}</Badge>
                )}
                {showGroup && groupColumn && (
                  <Badge variant="default">{t("preparation.split.groupBadgeLabel", { name: groupColumn })}</Badge>
                )}
                {!showGroup && (
                  <Badge variant={shuffle ? "secondary" : "outline"}>
                    {shuffle ? t("preparation.split.shuffleOn") : t("preparation.split.shuffleOff")}
                  </Badge>
                )}
                <Badge variant={CLASSIFICATION_ONLY.includes(splitMethod) ? "default" : "secondary"}>
                  {CLASSIFICATION_ONLY.includes(splitMethod) ? t("preparation.split.stratified") : t("preparation.split.notStratified")}
                </Badge>
                {cvTestRatio > 0 && <Badge variant="default">{t("preparation.split.testHoldout", { ratio: cvTestRatio })}</Badge>}
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
                {t("preparation.split.looTitle")}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                  {t("preparation.split.looBehavior")}
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs text-amber-600 dark:text-amber-400">
                  <li>
                    <strong>{t("preparation.split.looPoint1Bold")}</strong> {t("preparation.split.looPoint1")}
                  </li>
                  <li>
                    {t("preparation.split.looPoint2Pre")} <strong>{t("preparation.split.looPoint2Bold")}</strong> {t("preparation.split.looPoint2Suf")}
                  </li>
                  <li>
                    {t("preparation.split.looPoint3Pre")} <strong>{t("preparation.split.looPoint3Bold")}</strong> {t("preparation.split.looPoint3Suf")}
                  </li>
                  <li>
                    {t("preparation.split.looPoint4Pre")} <strong>{t("preparation.split.looPoint4Bold")}</strong> {t("preparation.split.looPoint4Suf")}
                  </li>
                  <li>
                    {t("preparation.split.looPoint5")}
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("preparation.split.antiLeakageTitle")}</p>
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  <li>{t("preparation.split.looAntiLeak1")}</li>
                  <li>{t("preparation.split.looAntiLeak2")}</li>
                  <li>{t("preparation.split.looAntiLeak3")}</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{t("preparation.split.looFolds")}</Badge>
                <Badge variant="secondary">{t("preparation.split.looAgg")}</Badge>
                <Badge variant="outline">{t("preparation.split.looLimit")}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default Step2SplitStrategy;
