// src/components/training/TrainingParameters.tsx
import { Sliders, Layers, GitFork, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { TrainingConfig } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface TrainingParametersProps {
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

const presets = [
  { label: "70/15/15", train: 70, val: 15, test: 15, description: "Standard" },
  { label: "80/10/10", train: 80, val: 10, test: 10, description: "Plus de données" },
  { label: "80/0/20", train: 80, val: 0, test: 20, description: "Sans validation" },
  { label: "90/0/10", train: 90, val: 0, test: 10, description: "Maximum train" },
];

export function TrainingParameters({ config, onConfigChange }: TrainingParametersProps) {
  const isPresetActive = (preset: (typeof presets)[0]) =>
    config.trainRatio === preset.train && config.valRatio === preset.val && config.testRatio === preset.test;

  const totalRatio = config.trainRatio + config.valRatio + config.testRatio;
  const isValidTotal = totalRatio === 100;

  return (
    <Card className="h-full overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/20 shadow-xl">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
            <Sliders className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Paramètres d'entraînement
            </span>
            <p className="text-xs font-normal text-muted-foreground mt-0.5">Stratégie de validation</p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-5">
        <Tabs
          value={config.splitMethod}
          onValueChange={(v) => onConfigChange({ splitMethod: v as "holdout" | "kfold" })}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6 p-1.5 bg-muted/50 backdrop-blur-sm rounded-xl h-auto">
            <TabsTrigger
              value="holdout"
              className="flex items-center gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-300"
            >
              <Layers className="h-4 w-4" />
              <span className="font-medium">Train/Val/Test</span>
            </TabsTrigger>
            <TabsTrigger
              value="kfold"
              className="flex items-center gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-300"
            >
              <GitFork className="h-4 w-4" />
              <span className="font-medium">K-Fold CV</span>
            </TabsTrigger>
          </TabsList>

          {/* ✅ FIX: AnimatePresence ne rend qu’UN enfant à la fois, avec une key stable */}
          <AnimatePresence mode="wait">
            {config.splitMethod === "holdout" ? (
              <motion.div
                key="holdout"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Visual Distribution Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">Répartition des données</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isValidTotal ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {totalRatio}%
                    </span>
                  </div>

                  <div className="relative h-8 rounded-xl overflow-hidden flex bg-muted/30 shadow-inner border border-border/50">
                    <motion.div
                      className="bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center relative overflow-hidden"
                      style={{ width: `${config.trainRatio}%` }}
                      layout
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10" />
                      {config.trainRatio >= 25 && (
                        <span className="text-[11px] font-bold text-primary-foreground z-10 drop-shadow-sm">
                          Train {config.trainRatio}%
                        </span>
                      )}
                    </motion.div>

                    {config.valRatio > 0 && (
                      <motion.div
                        className="bg-gradient-to-r from-secondary to-secondary/80 flex items-center justify-center relative overflow-hidden"
                        style={{ width: `${config.valRatio}%` }}
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10" />
                        {config.valRatio >= 10 && (
                          <span className="text-[11px] font-bold text-secondary-foreground z-10 drop-shadow-sm">
                            Val {config.valRatio}%
                          </span>
                        )}
                      </motion.div>
                    )}

                    <motion.div
                      className="bg-gradient-to-r from-accent to-accent/80 flex items-center justify-center relative overflow-hidden"
                      style={{ width: `${config.testRatio}%` }}
                      layout
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10" />
                      {config.testRatio >= 10 && (
                        <span className="text-[11px] font-bold text-accent-foreground z-10 drop-shadow-sm">
                          Test {config.testRatio}%
                        </span>
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Individual Sliders */}
                <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                  {/* Train */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-primary to-primary/70 shadow-sm" />
                        Entraînement
                      </label>
                      <span className="text-sm font-bold text-primary tabular-nums">{config.trainRatio}%</span>
                    </div>
                    <Slider
                      value={[config.trainRatio]}
                      onValueChange={([v]) => {
                        const remaining = 100 - v;
                        const currentOther = config.valRatio + config.testRatio;
                        if (currentOther === 0) {
                          onConfigChange({ trainRatio: v, testRatio: remaining });
                        } else {
                          const valRatio = Math.round((config.valRatio / currentOther) * remaining);
                          const testRatio = remaining - valRatio;
                          onConfigChange({ trainRatio: v, valRatio, testRatio });
                        }
                      }}
                      max={95}
                      min={50}
                      step={5}
                      className="py-1"
                    />
                  </div>

                  {/* Val */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-secondary to-secondary/70 shadow-sm" />
                        Validation
                        {config.valRatio === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-normal">
                            Désactivé
                          </span>
                        )}
                      </label>
                      <span className="text-sm font-bold text-secondary tabular-nums">{config.valRatio}%</span>
                    </div>
                    <Slider
                      value={[config.valRatio]}
                      onValueChange={([v]) => {
                        const maxVal = 100 - config.trainRatio - 5;
                        const newVal = Math.min(v, maxVal);
                        onConfigChange({ valRatio: newVal, testRatio: 100 - config.trainRatio - newVal });
                      }}
                      max={30}
                      min={0}
                      step={5}
                      className="py-1"
                    />
                  </div>

                  {/* Test */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-accent to-accent/70 shadow-sm" />
                        Test
                      </label>
                      <span className="text-sm font-bold text-accent tabular-nums">{config.testRatio}%</span>
                    </div>
                    <Slider
                      value={[config.testRatio]}
                      onValueChange={([v]) => {
                        const maxTest = 100 - config.trainRatio;
                        const newTest = Math.min(v, maxTest);
                        onConfigChange({ testRatio: newTest, valRatio: 100 - config.trainRatio - newTest });
                      }}
                      max={40}
                      min={5}
                      step={5}
                      className="py-1"
                    />
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Préréglages rapides
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <motion.button
                        key={preset.label}
                        type="button"
                        onClick={() => onConfigChange({ trainRatio: preset.train, valRatio: preset.val, testRatio: preset.test })}
                        className={`relative p-3 rounded-xl border-2 transition-all duration-300 text-left group ${
                          isPresetActive(preset) ? "border-primary bg-primary/5 shadow-md" : "border-border/50 bg-background hover:border-primary/30 hover:bg-muted/30"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold tabular-nums ${isPresetActive(preset) ? "text-primary" : "text-foreground"}`}>
                            {preset.label}
                          </span>
                          {isPresetActive(preset) && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="kfold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="relative p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 border border-border/50">
                  <div className="relative text-center">
                    <div className="text-6xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-2">
                      {config.kFolds}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Nombre de folds</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">Ajuster le nombre de folds</label>
                  <Slider
                    value={[config.kFolds || 5]}
                    onValueChange={([v]) => onConfigChange({ kFolds: v })}
                    max={10}
                    min={2}
                    step={1}
                    className="py-2"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>
      </CardContent>
    </Card>
  );
}
