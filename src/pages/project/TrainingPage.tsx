import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Loader2, Rocket, ChevronRight, AlertCircle } from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

import trainingService from "@/services/trainingService";
import apiClient from "@/services/apiClient";

import type { ModelType, MetricType, TrainingConfig } from "@/types";
import { staggerContainer, staggerItem } from "@/components/ui/page-transition";
import { ModelSelector } from "@/components/training/ModelSelector";
import { TrainingParameters } from "@/components/training/TrainingParameters";
import { ConfigurationPanel } from "@/components/training/ConfigurationPanel";
import { MetricsSelector } from "@/components/training/MetricsSelector";
import { TrainingProgress } from "@/components/training/TrainingProgress";

export function TrainingPage() {
  const { projectId, versionId } = useParams<{ projectId: string; versionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isTraining, setIsTraining] = useState(false);

  // ✅ colonnes de la version
  const [columns, setColumns] = useState<string[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);

  const [config, setConfig] = useState<TrainingConfig>({
    targetColumn: "",
    taskType: "classification",
    models: ["randomforest"],
    useGridSearch: false,
    useSmote: false,
    splitMethod: "holdout",
    trainRatio: 70,
    valRatio: 15,
    testRatio: 15,
    kFolds: 5,
    metrics: ["accuracy", "f1"],
    customCode: "",
  });

  const updateConfig = (updates: Partial<TrainingConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const toggleModel = (model: ModelType) => {
    setConfig((prev) => ({
      ...prev,
      models: prev.models.includes(model)
        ? prev.models.filter((m) => m !== model)
        : [...prev.models, model],
    }));
  };

  const toggleMetric = (metric: MetricType) => {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter((m) => m !== metric)
        : [...prev.metrics, metric],
    }));
  };

  // ✅ validations
  const ratiosSum = useMemo(
    () => Number(config.trainRatio) + Number(config.valRatio) + Number(config.testRatio),
    [config.trainRatio, config.valRatio, config.testRatio]
  );

  const isHoldoutOk = config.splitMethod !== "holdout" || ratiosSum === 100;
  const isKFoldOk = config.splitMethod !== "kfold" || Number(config.kFolds) >= 2;

  const isConfigValid =
    Boolean(projectId) &&
    Boolean(versionId) &&
    Boolean(config.targetColumn) &&
    config.models.length > 0 &&
    config.metrics.length > 0 &&
    isHoldoutOk &&
    isKFoldOk;

  // ✅ load columns depuis /versions/{versionId}/columns
  useEffect(() => {
    const loadColumns = async () => {
      if (!projectId || !versionId) return;
      setColumnsLoading(true);
      try {
        const res = await apiClient.get<{ columns: string[] }>(
          `/projects/${projectId}/versions/${versionId}/columns`
        );
        const cols = (res?.columns ?? []).map((c) => String(c).trim()).filter(Boolean);
        setColumns(cols);

        // ✅ auto-select targetColumn si vide ou invalide
        setConfig((prev) => {
          if (prev.targetColumn && cols.includes(prev.targetColumn)) return prev;
          return { ...prev, targetColumn: cols[cols.length - 1] ?? "" };
        });
      } catch (e: any) {
        setColumns([]);
        toast({
          title: "Erreur",
          description: e?.message || "Impossible de charger les colonnes",
          variant: "destructive",
        });
      } finally {
        setColumnsLoading(false);
      }
    };

    loadColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, versionId]);

  // ✅ polling session
  const pollSessionUntilReady = async (sessionId: string, timeoutMs = 120_000) => {
    if (!projectId) return null;

    const startedAt = Date.now();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    while (Date.now() - startedAt < timeoutMs) {
      const s = await trainingService.getSession(projectId, sessionId);
      const results = (s as any).results as any[] | undefined;
      const completedAt = (s as any).completedAt as string | undefined;
      const status = (s as any).status as string | undefined;

      if ((results && results.length > 0) || completedAt || status === "failed" || status === "succeeded") {
        return s;
      }
      await sleep(1500);
    }

    return await trainingService.getSession(projectId, sessionId);
  };

  const handleTrain = async () => {
    if (!projectId || !versionId) {
      toast({
        title: "Contexte introuvable",
        description: "ID projet/version manquant dans l'URL.",
        variant: "destructive",
      });
      return;
    }

    if (!config.targetColumn) {
      toast({
        title: "Colonne cible manquante",
        description: "Sélectionne une colonne cible.",
        variant: "destructive",
      });
      return;
    }

    if (config.splitMethod === "holdout" && ratiosSum !== 100) {
      toast({
        title: "Ratios invalides",
        description: "Pour Holdout, train + val + test doit être = 100.",
        variant: "destructive",
      });
      return;
    }

    if (config.splitMethod === "kfold" && Number(config.kFolds) < 2) {
      toast({
        title: "K-Folds invalide",
        description: "Le nombre de folds doit être ≥ 2.",
        variant: "destructive",
      });
      return;
    }

    setIsTraining(true);
    try {
      // ✅ startTraining est maintenant typé => session.id OK
      const session = await trainingService.startTraining(projectId, versionId, config);

      const finalSession = await pollSessionUntilReady(String(session.id));
      const status = (finalSession as any)?.status as string | undefined;
      const errorMessage = (finalSession as any)?.errorMessage as string | undefined;

      if (status === "failed") {
        toast({
          title: "Erreur lors de l'entraînement",
          description: errorMessage || "Le backend a échoué.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Entraînement lancé",
        description: "Session créée. Redirection vers les résultats…",
      });

      navigate(`/projects/${projectId}/versions/${versionId}/training/results?session=${session.id}`);
    } catch (error: any) {
      toast({
        title: "Erreur lors de l'entraînement",
        description: error?.message || "Not Found",
        variant: "destructive",
      });
    } finally {
      setIsTraining(false);
    }
  };

  // auto-correction kfold
  useEffect(() => {
    if (config.splitMethod === "kfold" && Number(config.kFolds) < 2) {
      setConfig((prev) => ({ ...prev, kFolds: 5 }));
    }
  }, [config.splitMethod]);

  return (
    <AppLayout>
      <TrainingProgress isTraining={isTraining} selectedModels={config.models} />

      <motion.div className="space-y-8 pb-8" initial="initial" animate="animate" variants={staggerContainer}>
        {/* Header */}
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Studio d'entraînement</h1>
            </div>
            <p className="text-muted-foreground">
              Configurez et lancez vos modèles d'intelligence artificielle pour analyser vos données.
            </p>
          </div>
        </motion.div>

        {/* Summary */}
        <motion.div variants={staggerItem}>
          <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Modèles:</span>
                  <span className="font-bold text-primary">{config.models.length}</span>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Métriques:</span>
                  <span className="font-bold text-secondary">{config.metrics.length}</span>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Validation:</span>
                  <span className="font-bold text-accent">
                    {config.splitMethod === "kfold"
                      ? `${config.kFolds}-Fold CV`
                      : `${config.trainRatio}/${config.valRatio}/${config.testRatio}`}
                  </span>
                </div>

                {config.splitMethod === "holdout" && (
                  <>
                    <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        ratiosSum === 100 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                      }`}
                      title="train + val + test"
                    >
                      Total: {ratiosSum}%
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Config grid */}
        <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConfigurationPanel
            config={config}
            onConfigChange={updateConfig}
            columns={columns}
            columnsLoading={columnsLoading}
          />
          <TrainingParameters config={config} onConfigChange={updateConfig} />
        </motion.div>

        <motion.div variants={staggerItem}>
          <ModelSelector
            selectedModels={config.models}
            onToggleModel={toggleModel}
            useGridSearch={config.useGridSearch}
            onGridSearchChange={(v) => updateConfig({ useGridSearch: v })}
            useSmote={config.useSmote}
            onSmoteChange={(v) => updateConfig({ useSmote: v })}
          />
        </motion.div>

        <motion.div variants={staggerItem}>
          <MetricsSelector selectedMetrics={config.metrics} onToggleMetric={toggleMetric} />
        </motion.div>

        {!isConfigValid && (
          <motion.div variants={staggerItem} className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              {!projectId && "Projet introuvable. "}
              {!versionId && "Version introuvable. "}
              {!config.targetColumn && "Sélectionne une colonne cible. "}
              {config.models.length === 0 && "Sélectionne au moins un modèle. "}
              {config.metrics.length === 0 && "Sélectionne au moins une métrique. "}
              {config.splitMethod === "holdout" && ratiosSum !== 100 && "Ratios Holdout: total doit être 100. "}
              {config.splitMethod === "kfold" && Number(config.kFolds) < 2 && "K-Folds doit être ≥ 2. "}
            </p>
          </motion.div>
        )}

        <motion.div variants={staggerItem}>
          <Button
            size="lg"
            className="w-full h-16 text-lg bg-gradient-to-r from-primary via-secondary to-accent shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
            onClick={handleTrain}
            disabled={isTraining || !isConfigValid}
          >
            {isTraining ? (
              <>
                <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                Entraînement en cours...
              </>
            ) : (
              <>
                <Play className="h-6 w-6 mr-3" />
                Lancer l'entraînement
              </>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}

export default TrainingPage;
