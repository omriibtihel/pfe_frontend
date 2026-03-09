/**
 * AutoMLConfigPanel — shown when the user selects "AutoML" mode.
 * Collects the minimal config needed to launch a FLAML AutoML session:
 *   - Time budget (slider)
 *   - Metric to optimise (optional, auto-selects if empty)
 *   - Test set ratio (slider)
 */
import { useState } from "react";
import { Loader2, Rocket, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

import type { AutoMLConfig, MetricType, TaskType } from "@/types";
import { trainingService } from "@/services/trainingService";
import type { TrainingSession } from "@/services/trainingService";

const CLASSIFICATION_METRICS: { value: MetricType; label: string }[] = [
  { value: "roc_auc", label: "ROC AUC" },
  { value: "pr_auc", label: "PR AUC (avg precision)" },
  { value: "f1", label: "F1" },
  { value: "accuracy", label: "Accuracy" },
];

const REGRESSION_METRICS: { value: MetricType; label: string }[] = [
  { value: "rmse", label: "RMSE" },
  { value: "r2", label: "R²" },
  { value: "mae", label: "MAE" },
];

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}min` : `${m}min ${rem}s`;
}

interface AutoMLConfigPanelProps {
  projectId: string;
  datasetVersionId: string;
  targetColumn: string;
  taskType: TaskType;
  positiveLabel?: string | number | null;
  onSessionStarted: (session: TrainingSession) => void;
}

export function AutoMLConfigPanel({
  projectId,
  datasetVersionId,
  targetColumn,
  taskType,
  positiveLabel,
  onSessionStarted,
}: AutoMLConfigPanelProps) {
  const [timeBudget, setTimeBudget] = useState(60);
  const [metric, setMetric] = useState<MetricType | "auto">("auto");
  const [testRatio, setTestRatio] = useState(20); // percent
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metricOptions =
    taskType === "regression" ? REGRESSION_METRICS : CLASSIFICATION_METRICS;

  async function handleLaunch() {
    setLoading(true);
    setError(null);
    try {
      const cfg: AutoMLConfig = {
        datasetVersionId,
        targetColumn,
        taskType,
        timeBudget,
        metric: metric === "auto" ? undefined : metric,
        testRatio: testRatio / 100,
        positiveLabel: positiveLabel ?? null,
      };
      const session = await trainingService.startAutoMLTraining(projectId, cfg);
      onSessionStarted(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors du lancement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Mode AutoML</h2>
        <p className="text-muted-foreground text-sm">
          FLAML explore automatiquement les modèles, le preprocessing et les hyperparamètres
          dans le budget temps imparti.
        </p>
      </div>

      <Alert variant="default">
        <Info className="h-4 w-4" />
        <AlertDescription>
          AutoML gère le pipeline complet (imputation, encodage, sélection de modèle, HPO).
          Aucune configuration manuelle requise.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="space-y-6 pt-5">
          {/* Time budget */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Budget temps</Label>
              <span className="text-sm font-semibold text-primary">
                {formatSeconds(timeBudget)}
              </span>
            </div>
            <Slider
              min={10}
              max={600}
              step={10}
              value={[timeBudget]}
              onValueChange={([v]) => setTimeBudget(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10s</span>
              <span>5min</span>
              <span>10min</span>
            </div>
          </div>

          {/* Metric */}
          <div className="space-y-2">
            <Label>Métrique à optimiser</Label>
            <Select
              value={metric}
              onValueChange={(v) => setMetric(v as MetricType | "auto")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto (recommandé)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto — {taskType === "regression" ? "RMSE" : "ROC AUC"}
                </SelectItem>
                {metricOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Test ratio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Ratio du test set final</Label>
              <span className="text-sm font-semibold text-primary">{testRatio}%</span>
            </div>
            <Slider
              min={0}
              max={40}
              step={5}
              value={[testRatio]}
              onValueChange={([v]) => setTestRatio(v)}
            />
            <p className="text-xs text-muted-foreground">
              {testRatio === 0
                ? "Pas de test set — AutoML utilise 100% des données."
                : `${testRatio}% des données réservées pour l'évaluation finale (non vues pendant la recherche).`}
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handleLaunch}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Lancement…
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-4 w-4" />
            Lancer AutoML ({formatSeconds(timeBudget)})
          </>
        )}
      </Button>
    </div>
  );
}
