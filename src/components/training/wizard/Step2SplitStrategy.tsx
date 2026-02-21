import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Scissors, Percent, Layers, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

import type { TrainingConfig } from "@/types";
import { trainingService } from "@/services/trainingService";

type SplitMethod = "holdout" | "kfold";

interface Step2Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

function clampInt(n: any, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function normalizeRatios(train: number, val: number, test: number) {
  // Ensure total=100, keep train as priority, then val, then test
  let t = clampInt(train, 1, 98);
  let v = clampInt(val, 0, 98);
  let te = clampInt(test, 0, 98);

  const sum = t + v + te;
  if (sum === 100) return { train: t, val: v, test: te };

  // If sum != 100, adjust test first, then val
  let diff = 100 - sum;

  te = clampInt(te + diff, 0, 99);
  diff = 100 - (t + v + te);

  v = clampInt(v + diff, 0, 99);
  diff = 100 - (t + v + te);

  t = clampInt(t + diff, 1, 100); // final safeguard
  // If still off due to clamping, force test
  const finalDiff = 100 - (t + v + te);
  te = clampInt(te + finalDiff, 0, 100);

  return { train: t, val: v, test: te };
}

export function Step2SplitStrategy({ projectId, config, onConfigChange }: Step2Props) {
  const [supportedMethods, setSupportedMethods] = useState<SplitMethod[]>(["holdout", "kfold"]);
  const splitMethod = (config.splitMethod as SplitMethod) ?? "holdout";

  const ratios = useMemo(() => {
    const r = normalizeRatios(config.trainRatio ?? 70, config.valRatio ?? 15, config.testRatio ?? 15);
    return r;
  }, [config.trainRatio, config.valRatio, config.testRatio]);

  // Keep config always normalized (prevents weird sums)
  useEffect(() => {
    let mounted = true;
    const loadCapabilities = async () => {
      try {
        const caps = await trainingService.getCapabilities(projectId);
        if (!mounted) return;
        const methods = (caps.supportedSplitMethods ?? [])
          .map((m) => String(m))
          .filter((m): m is SplitMethod => m === "holdout" || m === "kfold");
        setSupportedMethods(methods.length ? methods : ["holdout"]);
      } catch {
        if (!mounted) return;
        setSupportedMethods(["holdout", "kfold"]);
      }
    };
    loadCapabilities();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (supportedMethods.includes(splitMethod)) return;
    onConfigChange({ splitMethod: supportedMethods[0] ?? "holdout" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMethod, supportedMethods.join(",")]);

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
  const showFolds = splitMethod === "kfold" && supportedMethods.includes("kfold");

  const totalOk = ratios.train + ratios.val + ratios.test === 100;

  return (
    <div className="space-y-6">
      {/* Split method */}
      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Scissors className="h-4 w-4 text-primary" />
            </div>
            Stratégie de split
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Select
            value={splitMethod}
            onValueChange={(v) => {
              const next = v as SplitMethod;

              // Small sane defaults when switching
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
                  // ratios still kept but not used by folds; no harm keeping them
                });
              }
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Choisir une méthode" />
            </SelectTrigger>
            <SelectContent>
              {supportedMethods.includes("holdout") && (
                <SelectItem value="holdout">Holdout (train/val/test)</SelectItem>
              )}
              {supportedMethods.includes("kfold") && (
                <SelectItem value="kfold">K-Fold</SelectItem>
              )}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Bon pratique : FIT sur train uniquement
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Holdout ratios */}
      {showHoldout && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-2 rounded-xl bg-secondary/10">
                  <Percent className="h-4 w-4 text-secondary" />
                </div>
                Répartition Holdout
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Slider style */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Ajuste train/val/test (total = 100%)
                  </p>
                  <Badge variant={totalOk ? "secondary" : "destructive"} className="text-xs">
                    {ratios.train + ratios.val + ratios.test}%
                  </Badge>
                </div>

                {/* We use 2 sliders to keep UX simple */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Train</span>
                    <span className="font-medium">{ratios.train}%</span>
                  </div>
                  <Slider
                    value={[ratios.train]}
                    min={50}
                    max={95}
                    step={1}
                    onValueChange={([v]) => {
                      const train = clampInt(v, 50, 95);
                      const remaining = 100 - train;
                      const val = Math.min(ratios.val, remaining);
                      const test = remaining - val;
                      onConfigChange({ trainRatio: train, valRatio: val, testRatio: test });
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Validation</span>
                      <span className="font-medium">{ratios.val}%</span>
                    </div>
                    <Slider
                      value={[ratios.val]}
                      min={0}
                      max={Math.max(0, 100 - ratios.train)}
                      step={1}
                      onValueChange={([v]) => {
                        const remaining = 100 - ratios.train;
                        const val = clampInt(v, 0, remaining);
                        const test = remaining - val;
                        onConfigChange({ valRatio: val, testRatio: test });
                      }}
                    />
                  </div>

                  <div className="rounded-2xl border border-border/50 p-4">
                    <p className="text-xs text-muted-foreground mb-2">Résumé</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Train: {ratios.train}%</Badge>
                      <Badge variant="outline">Val: {ratios.val}%</Badge>
                      <Badge variant="outline">Test: {ratios.test}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Conseil : si tu n’as pas assez de data, mets Val à 0 et utilise K-Fold.
                    </p>
                  </div>
                </div>
              </div>

              {/* Optional manual inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Train (%)</p>
                  <Input
                    value={String(ratios.train)}
                    onChange={(e) => {
                      const n = clampInt(e.target.value, 1, 99);
                      const norm = normalizeRatios(n, ratios.val, ratios.test);
                      onConfigChange({ trainRatio: norm.train, valRatio: norm.val, testRatio: norm.test });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Val (%)</p>
                  <Input
                    value={String(ratios.val)}
                    onChange={(e) => {
                      const n = clampInt(e.target.value, 0, 99);
                      const norm = normalizeRatios(ratios.train, n, ratios.test);
                      onConfigChange({ trainRatio: norm.train, valRatio: norm.val, testRatio: norm.test });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Test (%)</p>
                  <Input
                    value={String(ratios.test)}
                    onChange={(e) => {
                      const n = clampInt(e.target.value, 0, 99);
                      const norm = normalizeRatios(ratios.train, ratios.val, n);
                      onConfigChange({ trainRatio: norm.train, valRatio: norm.val, testRatio: norm.test });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* K-Fold settings */}
      {showFolds && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-2 rounded-xl bg-accent/10">
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                Paramètres K-Fold
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Nombre de folds (k)</p>
                  <Input
                    value={String(config.kFolds ?? 5)}
                    onChange={(e) => onConfigChange({ kFolds: clampInt(e.target.value, 2, 20) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommandation : 5 ou 10.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/50 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Rappel</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Les prétraitements et le modèle doivent être dans un pipeline,
                    pour faire le fit uniquement sur les folds train.
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default Step2SplitStrategy;
