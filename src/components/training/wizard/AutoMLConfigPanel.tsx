/**
 * AutoMLConfigPanel — shown when the user selects "AutoML" mode.
 * Collects the minimal config needed to launch a FLAML AutoML session:
 *   - Time budget (slider)
 *   - Metric to optimise (optional, auto-selects if empty)
 *   - Test set ratio (slider)
 */
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Loader2, Rocket, Info, Construction } from "lucide-react";

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
import { loadPrepConfig } from "@/utils/prepConfig";

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
  const { t } = useTranslation();
  // Load prepConfig to pre-fill testRatio and detect potential confusion
  const prepConfig = datasetVersionId
    ? loadPrepConfig(projectId, String(datasetVersionId))
    : null;

  const prepHasCustomSettings = prepConfig != null && (
    prepConfig.balancing?.strategy !== "none" ||
    prepConfig.useSmote ||
    Object.keys(prepConfig.preprocessing?.columns ?? {}).length > 0
  );

  // Pre-fill testRatio from prepConfig if available (expressed in percent)
  const defaultTestRatio = prepConfig
    ? Math.round(prepConfig.testRatio ?? 20)
    : 20;

  const [timeBudget, setTimeBudget] = useState(60);
  const [metric, setMetric] = useState<MetricType | "auto">("auto");
  const [testRatio, setTestRatio] = useState(defaultTestRatio);
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
      setError(err instanceof Error ? err.message : t("training.automl.errLaunch"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{t("training.automl.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("training.automl.subtitle")}
        </p>
      </div>

      <Alert variant="default" className="border-red-500 bg-red-100 dark:bg-red-950/40">
        <Construction className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-700 dark:text-red-300 text-sm font-medium">
          {t("training.automl.wipNotice")}
        </AlertDescription>
      </Alert>

      <Alert
        variant="default"
        className={
          prepHasCustomSettings
            ? "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20"
            : undefined
        }
      >
        <Info
          className={`h-4 w-4 ${prepHasCustomSettings ? "text-amber-600" : ""}`}
        />
        <AlertDescription
          className={
            prepHasCustomSettings
              ? "text-amber-800 dark:text-amber-300 text-xs"
              : undefined
          }
        >
          {t("training.automl.alertInfo")}
          {prepHasCustomSettings && (
            <>
              {" "}
              <Trans i18nKey="training.automl.warnPrep" components={{ strong: <strong /> }} />
              {prepConfig && (
                <span>{t("training.automl.warnTestPrefilled", { ratio: Math.round(prepConfig.testRatio ?? 20) })}</span>
              )}
            </>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="space-y-6 pt-5">
          {/* Time budget */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("training.automl.timeBudget")}</Label>
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
            <Label>{t("training.automl.metric")}</Label>
            <Select
              value={metric}
              onValueChange={(v) => setMetric(v as MetricType | "auto")}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("training.automl.metricAutoPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {t("training.automl.metricAutoOption", { label: taskType === "regression" ? "RMSE" : "ROC AUC" })}
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
              <Label>{t("training.automl.testRatio")}</Label>
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
                ? t("training.automl.testRatioHint0")
                : t("training.automl.testRatioHint", { ratio: testRatio })}
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
            {t("training.automl.launching")}
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-4 w-4" />
            {t("training.automl.launchBtn", { time: formatSeconds(timeBudget) })}
          </>
        )}
      </Button>
    </div>
  );
}
