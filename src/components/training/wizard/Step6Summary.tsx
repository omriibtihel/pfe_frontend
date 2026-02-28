import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TrainingConfig } from "@/types";
import { trainingService, type TrainingValidationResponse } from "@/services/trainingService";

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

    const p = typeof (s as any).progress === "number" ? (s as any).progress : 0;
    setProgress(Math.max(0, Math.min(100, p)));

    const err = (s as any).errorMessage || (s as any).error_message;
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
      const out = await trainingService.validateTraining(projectId, config);
      if (seq !== validationSeqRef.current) return out;
      setValidation(out);
      return out;
    } catch (e: any) {
      const fallback: TrainingValidationResponse = {
        normalized_config: {},
        effective_preprocessing_by_column: {},
        warnings: [],
        errors: showNetworkErrorInList
          ? [String(e?.message || "Validation indisponible.")]
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
      setError("Validation bloquante: corrige les erreurs avant de lancer.");
      return;
    }
    const missingPositiveLabelWarning = (validationOut.warnings ?? []).some((msg) =>
      /positivelabel absent|positive_label is missing/i.test(String(msg))
    );
    const hasPositiveLabel = Boolean(String(config.positiveLabel ?? "").trim());
    if (missingPositiveLabelWarning && !hasPositiveLabel) {
      setStatus("idle");
      setProgress(0);
      setError("La classe positive est requise dans ce cas. Renseigne 'positiveLabel' à l'étape Métriques.");
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
              `Stratégie non faisable (${selectedStrategy}). Suggestion: ${analysis.default_recommendation}.`
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
      setError("Impossible de demarrer l'entrainement.");
      return;
    }

    setSessionId(sid);

    try {
      await refresh(sid);
    } catch (e: any) {
      setStatus("failed");
      setError(e?.message || "Erreur de suivi session.");
      return;
    }

    stopPolling();
    pollingRef.current = window.setInterval(() => {
      refresh(sid).catch((e: any) => {
        setStatus("failed");
        setError(e?.message || "Erreur de suivi session.");
        stopPolling();
      });
    }, 1200);
  };

  const displayConfig = useMemo(() => {
    const normalized = validation.normalized_config;
    if (normalized && Object.keys(normalized).length > 0) return normalized;
    return config;
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

  const summaryItems = [
    { label: "Dataset Version", value: config.datasetVersionId || "-" },
    { label: "Variable cible", value: config.targetColumn },
    { label: "Type de tache", value: config.taskType },
    {
      label: "Split",
      value:
        config.splitMethod === "holdout"
          ? `Holdout ${config.trainRatio}/${config.valRatio}/${config.testRatio}`
          : `${config.splitMethod} (${config.kFolds} folds)`,
    },
    { label: "Modeles", value: `${config.models.length} selectionne(s)` },
    { label: "Metriques", value: `${config.metrics.length} selectionnee(s)` },
    {
      label: "Balancing",
      value: config.balancing?.strategy ?? (config.useSmote ? "smote" : "none"),
    },
    {
      label: "Seuil optimise",
      value: config.balancing?.applyThreshold ? "Oui" : "Non",
    },
    { label: "Classe positive", value: config.positiveLabel == null || String(config.positiveLabel).trim() === "" ? "-" : String(config.positiveLabel) },
    { label: "Debug training", value: config.trainingDebug ? "Active" : "Desactive" },
    { label: "GridSearch", value: config.useGridSearch ? `Active (${config.gridCvFolds} folds)` : "Desactive" },
  ];

  return (
    <div className="space-y-6">
      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            Recapitulatif
            <button
              onClick={() => setShowJson(!showJson)}
              className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <FileJson className="h-3.5 w-3.5" />
              {showJson ? "Masquer JSON" : "Voir JSON"}
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

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Validation pre-lancement
            {validating ? (
              <Badge variant="outline" className="ml-auto text-xs">
                Verification...
              </Badge>
            ) : (
              <Badge variant={validation.errors.length ? "destructive" : "secondary"} className="ml-auto text-xs">
                {validation.errors.length ? `${validation.errors.length} erreur(s)` : "OK"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!!validation.errors.length && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive mb-2">Erreurs bloquantes</p>
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
              <p className="text-xs font-semibold mb-2">Warnings</p>
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
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold mb-2">Effective preprocessing by column</p>
              <pre className="text-[11px] overflow-auto max-h-56 font-mono">
                {JSON.stringify(validation.effective_preprocessing_by_column, null, 2)}
              </pre>
            </div>
          )}

          {!validation.errors.length && !validation.warnings.length && !validating && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs">
              Aucune erreur ni warning detecte.
            </div>
          )}
        </CardContent>
      </Card>

      {status === "idle" && (
        <Button
          size="lg"
          className="w-full h-14 text-lg gradient-premium text-primary-foreground shadow-glow hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5"
          onClick={handleStart}
          disabled={config.models.length === 0 || config.metrics.length === 0 || validating}
        >
          <Play className="h-5 w-5 mr-3" />
          Lancer l'entrainement
          <span className="ml-2 text-sm opacity-80">
            ({config.models.length} modele{config.models.length > 1 ? "s" : ""})
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
                  {status === "queued" ? "En file d'attente..." : "Entrainement en cours..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Session {sessionId ? `#${sessionId}` : ""} | {config.models.length} modele
                  {config.models.length > 1 ? "s" : ""}
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
                  <p className="font-semibold">Entrainement termine avec succes.</p>
                  <p className="text-xs text-muted-foreground">{config.models.length} modele(s) entraine(s)</p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full gradient-premium text-primary-foreground"
                onClick={() => sessionId && onGoToResults(sessionId)}
              >
                Voir les resultats
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
                  <p className="font-semibold text-destructive">Echec de l'entrainement</p>
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
                Reessayer
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
