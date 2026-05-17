import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileJson,
  Rocket,
  AlertTriangle,
  ShieldAlert,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TrainingConfig } from "@/types";
import { trainingService, type TrainingValidationResponse } from "@/services/trainingService";
import { loadPrepConfig } from "@/utils/prepConfig";

interface Step6Props {
  projectId: string;
  config: TrainingConfig;
  onStartTraining: () => Promise<string | null>;
  onGoToResults: (sessionId: string) => void;
}

type TrainStatus = "idle" | "queued" | "running" | "succeeded" | "failed";

const EMPTY_VALIDATION: TrainingValidationResponse = {
  normalized_config: {},
  effective_preprocessing_by_column: {},
  warnings: [],
  errors: [],
};

export function Step6Summary({ projectId, config, onStartTraining, onGoToResults }: Step6Props) {
  const { t } = useTranslation();
  const versionId = String(config.datasetVersionId ?? "").trim();
  const prepConfig = versionId ? loadPrepConfig(projectId, versionId) : null;

  const [status, setStatus] = useState<TrainStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [validation, setValidation] = useState<TrainingValidationResponse>(EMPTY_VALIDATION);
  const [validating, setValidating] = useState(false);

  const pollingRef = useRef<number | null>(null);
  const validationSeqRef = useRef(0);

  const stopPolling = () => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const refresh = async (sid: string) => {
    const s = await trainingService.getSession(projectId, sid);
    const st = (s.status || "queued") as TrainStatus;
    setStatus(st);

    const session = s as { progress?: number; errorMessage?: string; error_message?: string };
    const p = typeof session.progress === "number" ? session.progress : 0;
    setProgress(Math.max(0, Math.min(100, p)));

    const err = session.errorMessage || session.error_message;
    if (err) setError(String(err));

    if (st === "succeeded" || st === "failed") stopPolling();
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const runValidation = async (showNetworkErrorInList: boolean): Promise<TrainingValidationResponse> => {
    validationSeqRef.current += 1;
    const seq = validationSeqRef.current;
    setValidating(true);

    try {
      const configToValidate: TrainingConfig = prepConfig
        ? {
            ...config,
            splitMethod: prepConfig.splitMethod,
            trainRatio: prepConfig.trainRatio,
            valRatio: prepConfig.valRatio,
            testRatio: prepConfig.testRatio,
            kFolds: prepConfig.kFolds,
            shuffle: prepConfig.shuffle,
            preprocessing: prepConfig.preprocessing,
            balancing: prepConfig.balancing,
            useSmote: prepConfig.useSmote,
          }
        : config;
      const out = await trainingService.validateTraining(projectId, configToValidate);
      if (seq !== validationSeqRef.current) return out;
      setValidation(out);
      return out;
    } catch (e: unknown) {
      const fallback: TrainingValidationResponse = {
        normalized_config: {},
        effective_preprocessing_by_column: {},
        warnings: [],
        errors: showNetworkErrorInList
          ? [e instanceof Error ? e.message : t("training.step6.errValidationUnavailable")]
          : [],
      };
      if (seq === validationSeqRef.current) {
        setValidation(fallback);
      }
      return fallback;
    } finally {
      if (seq === validationSeqRef.current) {
        setValidating(false);
      }
    }
  };

  useEffect(() => {
    runValidation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, JSON.stringify(config)]);

  const handleStart = async () => {
    setStatus("queued");
    setError(null);
    setProgress(3);

    const validationOut = await runValidation(true);
    if (validationOut.errors.length > 0) {
      setStatus("idle");
      setProgress(0);
      setError(t("training.step6.errBlocking"));
      return;
    }
    const missingPositiveLabelWarning = (validationOut.warnings ?? []).some((msg) =>
      /positivelabel absent|positive_label is missing/i.test(String(msg))
    );
    const hasPositiveLabel = Boolean(String(config.positiveLabel ?? "").trim());
    if (missingPositiveLabelWarning && !hasPositiveLabel) {
      setStatus("idle");
      setProgress(0);
      setError(t("training.step6.errPositiveLabel"));
      return;
    }

    if (config.taskType === "classification") {
      const versionId = String(config.datasetVersionId ?? "").trim();
      const targetColumn = String(config.targetColumn ?? "").trim();
      if (versionId && targetColumn) {
        try {
          const analysis = await trainingService.analyzeBalance(projectId, versionId, targetColumn);
          const selectedStrategy =
            config.balancing?.strategy ?? (config.useSmote ? "smote" : "none");
          const selected = analysis.available_strategies.find((item) => item.id === selectedStrategy);

          if (selected && !selected.feasible) {
            setStatus("idle");
            setProgress(0);
            setError(
              t("training.step6.errStrategy", { strategy: selectedStrategy, suggestion: analysis.default_recommendation })
            );
            return;
          }
        } catch {
          // If diagnostic endpoint is unavailable, backend validation remains source of truth.
        }
      }
    }

    const sid = await onStartTraining();
    if (!sid) {
      setStatus("failed");
      setError(t("training.step6.errStart"));
      return;
    }

    setSessionId(sid);

    try {
      await refresh(sid);
    } catch (e: unknown) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : t("training.step6.errSession"));
      return;
    }

    stopPolling();
    pollingRef.current = window.setInterval(() => {
      refresh(sid).catch((e: unknown) => {
        setStatus("failed");
        setError(e instanceof Error ? e.message : t("training.step6.errSession"));
        stopPolling();
      });
    }, 1200);
  };

  const displayConfig = useMemo(() => {
    const normalized = validation.normalized_config;
    const base =
      normalized && Object.keys(normalized).length > 0 ? normalized : config;
    const sm = (base as { splitMethod?: string }).splitMethod;
    if (sm && sm !== "holdout") {
      const { trainRatio: _t, valRatio: _v, ...rest } =
        base as Record<string, unknown>;
      return rest;
    }
    return base;
  }, [config, validation.normalized_config]);

  const detailErrors = useMemo(
    () =>
      (validation.error_details ?? []).filter(
        (item) => String(item?.severity ?? "").toLowerCase() === "error"
      ),
    [validation.error_details]
  );

  const detailWarnings = useMemo(
    () =>
      (validation.error_details ?? []).filter(
        (item) => String(item?.severity ?? "").toLowerCase() === "warning"
      ),
    [validation.error_details]
  );

  const splitMethod = prepConfig?.splitMethod ?? config.splitMethod;
  const trainRatio = prepConfig?.trainRatio ?? config.trainRatio;
  const valRatio = prepConfig?.valRatio ?? config.valRatio;
  const testRatio = prepConfig?.testRatio ?? config.testRatio;
  const kFolds = prepConfig?.kFolds ?? config.kFolds;
  const balancingStrategy = prepConfig?.balancing?.strategy ?? config.balancing?.strategy ?? (config.useSmote ? "smote" : "none");
  const applyThreshold = prepConfig?.balancing?.applyThreshold ?? config.balancing?.applyThreshold ?? false;

  const summaryItems = [
    { label: t("training.step6.summary.datasetVersion"), value: config.datasetVersionId || "-" },
    { label: t("training.step6.summary.target"), value: config.targetColumn },
    { label: t("training.step6.summary.task"), value: config.taskType },
    {
      label: t("training.step6.summary.split"),
      value:
        splitMethod === "holdout"
          ? t("training.step6.summary.holdoutDisplay", { train: trainRatio, val: valRatio, test: testRatio })
          : t("training.step6.summary.cvDisplay", { method: splitMethod, k: kFolds }),
    },
    { label: t("training.step6.summary.models"), value: t("training.step6.summary.modelsCount", { n: config.models.length }) },
    { label: t("training.step6.summary.metrics"), value: t("training.step6.summary.metricsCount", { n: config.metrics.length }) },
    { label: t("training.step6.summary.balancing"), value: balancingStrategy },
    { label: t("training.step6.summary.threshold"), value: applyThreshold ? t("training.step6.summary.thresholdYes") : t("training.step6.summary.thresholdNo") },
    { label: t("training.step6.summary.positive"), value: config.positiveLabel == null || String(config.positiveLabel).trim() === "" ? "-" : String(config.positiveLabel) },
    {
      label: t("training.step6.summary.hpo"),
      value:
        config.searchType === "grid"
          ? t("training.step6.summary.grid", { k: config.gridCvFolds })
          : config.searchType === "random"
          ? t("training.step6.summary.random", { iters: config.nIterRandomSearch ?? 40, k: config.gridCvFolds })
          : config.searchType === "halving_random"
          ? t("training.step6.summary.halving", { iters: config.nIterRandomSearch ?? 60, k: config.gridCvFolds })
          : t("training.step6.summary.disabled"),
    },
  ];

  return (
    <div className="space-y-6">
      {!prepConfig && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-amber-800 dark:text-amber-300">
            {t("training.step6.noPrepWarning")}{" "}
            <Link
              to={`/projects/${projectId}/preparation`}
              className="underline font-medium inline-flex items-center gap-1"
            >
              <Sliders className="h-3.5 w-3.5" />
              {t("training.step6.configureNow")}
            </Link>
            {t("training.step6.noPrepSuffix")}
          </span>
        </div>
      )}

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            {t("training.step6.cardTitle")}
            <button
              onClick={() => setShowJson(!showJson)}
              className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <FileJson className="h-3.5 w-3.5" />
              {showJson ? t("training.step6.hideJson") : t("training.step6.showJson")}
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showJson ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summaryItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="p-4 rounded-xl bg-muted/50 text-xs overflow-auto max-h-64 font-mono">
              {JSON.stringify(displayConfig, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {!validating && !!validation.errors.length && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              {t("training.step6.validationTitle")}
              <Badge variant="destructive" className="ml-auto text-xs">
                {t("training.step6.validationErrors", { n: validation.errors.length })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!!validation.errors.length && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive mb-2">{t("training.step6.blockingErrors")}</p>
                <div className="space-y-1">
                  {validation.errors.map((msg, i) => (
                    <p key={`${i}-${msg}`} className="text-xs text-destructive">
                      - {msg}
                    </p>
                  ))}
                </div>
                {!!detailErrors.length && (
                  <div className="mt-2 space-y-1 border-t border-destructive/20 pt-2">
                    {detailErrors.map((d, i) => (
                      <p key={`derr-${i}-${d.code ?? ""}-${d.message ?? ""}`} className="text-xs text-destructive">
                        - [{d.code ?? "ERR"}]
                        {d.model ? ` model=${d.model}` : ""}
                        {d.column ? ` column=${d.column}` : ""}: {d.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!!validation.warnings.length && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs font-semibold mb-2">{t("training.step6.warnings")}</p>
                <div className="space-y-1">
                  {validation.warnings.map((msg, i) => (
                    <p key={`${i}-${msg}`} className="text-xs">
                      - {msg}
                    </p>
                  ))}
                </div>
                {!!detailWarnings.length && (
                  <div className="mt-2 space-y-1 border-t border-warning/20 pt-2">
                    {detailWarnings.map((d, i) => (
                      <p key={`dwarn-${i}-${d.code ?? ""}-${d.message ?? ""}`} className="text-xs">
                        - [{d.code ?? "WARN"}]
                        {d.model ? ` model=${d.model}` : ""}
                        {d.column ? ` column=${d.column}` : ""}: {d.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!!Object.keys(validation.effective_preprocessing_by_column ?? {}).length && (
              <details className="rounded-lg border border-border/60 bg-muted/30 p-3 group">
                <summary className="text-xs font-semibold cursor-pointer select-none list-none flex items-center justify-between">
                  <span>{t("training.step6.effectivePrep")}</span>
                  <span className="text-muted-foreground text-[10px] group-open:hidden">{t("training.step6.show")}</span>
                  <span className="text-muted-foreground text-[10px] hidden group-open:inline">{t("training.step6.hide")}</span>
                </summary>
                <pre className="mt-2 text-[11px] overflow-auto max-h-56 font-mono">
                  {JSON.stringify(validation.effective_preprocessing_by_column, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {status === "idle" && (
        <Button
          data-tour="train-launch-btn"
          size="lg"
          className="w-full h-14 text-lg gradient-premium text-primary-foreground shadow-glow hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5"
          onClick={handleStart}
          disabled={config.models.length === 0 || config.metrics.length === 0 || validating}
        >
          <Play className="h-5 w-5 mr-3" />
          {t("training.step6.btnLaunch")}
          <span className="ml-2 text-sm opacity-80">
            {t(
              config.models.length > 1 ? "training.step6.btnLaunchSuffixOther" : "training.step6.btnLaunchSuffixOne",
              { n: config.models.length }
            )}
          </span>
        </Button>
      )}

      {(status === "queued" || status === "running") && (
        <Card className="gradient-subtle border-primary/20">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <div>
                <p className="font-semibold text-sm">
                  {status === "queued" ? t("training.step6.stateQueued") : t("training.step6.stateRunning")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("training.step6.runningPatienceNote")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("training.step6.sessionInfo", {
                    sid: sessionId ? `#${sessionId}` : "",
                    n: config.models.length,
                    plural: config.models.length > 1 ? "s" : "",
                  })}
                </p>
              </div>
              <Badge className="ml-auto" variant="secondary">
                {status}
              </Badge>
            </div>
            <Progress value={Math.min(progress, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{Math.round(Math.min(progress, 100))}%</p>
          </CardContent>
        </Card>
      )}

      {status === "succeeded" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-2 border-success/30 bg-success/5">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <div>
                  <p className="font-semibold">{t("training.step6.success")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      config.models.length > 1 ? "training.step6.successDescOther" : "training.step6.successDescOne",
                      { n: config.models.length }
                    )}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full gradient-premium text-primary-foreground"
                onClick={() => sessionId && onGoToResults(sessionId)}
              >
                {t("training.step6.viewResults")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {status === "failed" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-2 border-destructive/30 bg-destructive/5">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">{t("training.step6.failed")}</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setStatus("idle");
                  setSessionId(null);
                  setProgress(0);
                  setError(null);
                }}
              >
                {t("training.step6.retry")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!!error && status !== "failed" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
