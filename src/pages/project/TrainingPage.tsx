import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Scissors,
  Columns,
  Brain,
  BarChart3,
  Rocket,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trainingService } from "@/services/trainingService";

import type { TrainingConfig } from "@/types";
import { DEFAULT_TRAINING_BALANCING, DEFAULT_TRAINING_PREPROCESSING } from "@/types";

import { WizardStepper } from "@/components/training/wizard/WizardStepper";
import { Step1DatasetTarget } from "@/components/training/wizard/Step1DatasetTarget";
import { Step2SplitStrategy } from "@/components/training/wizard/Step2SplitStrategy";
import {
  Step3ColumnPreprocessing,
  type Step3ValidationState,
} from "@/components/training/wizard/Step3ColumnPreprocessing";
import { Step4Models } from "@/components/training/wizard/Step4Models";
import { Step5Metrics } from "@/components/training/wizard/Step5Metrics";
import { Step6Summary } from "@/components/training/wizard/Step6Summary";

const steps = [
  { label: "Dataset & Cible", icon: <Database className="h-5 w-5" /> },
  { label: "Split", icon: <Scissors className="h-5 w-5" /> },
  { label: "Colonnes", icon: <Columns className="h-5 w-5" /> },
  { label: "Modeles", icon: <Brain className="h-5 w-5" /> },
  { label: "Metriques", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Lancer", icon: <Rocket className="h-5 w-5" /> },
];

export function TrainingPage() {
  const params = useParams<{ projectId?: string; id?: string; versionId?: string }>();
  const projectId = params.projectId ?? params.id;
  const routeVersionId = params.versionId;

  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [step3Validation, setStep3Validation] = useState<Step3ValidationState>({
    hasErrors: false,
    errorCount: 0,
    warningCount: 0,
    isValidating: false,
  });

  const [config, setConfig] = useState<TrainingConfig>({
    datasetVersionId: routeVersionId ? String(routeVersionId) : "",
    targetColumn: "",
    taskType: "classification",
    models: [],
    useGridSearch: false,
    gridCvFolds: 3,
    gridScoring: "auto",
    useSmote: false,
    balancing: { ...DEFAULT_TRAINING_BALANCING },
    splitMethod: "holdout",
    trainRatio: 70,
    valRatio: 15,
    testRatio: 15,
    kFolds: 5,
    metrics: ["accuracy", "f1"],
    positiveLabel: null,
    trainingDebug: false,
    preprocessing: { ...DEFAULT_TRAINING_PREPROCESSING },
    modelHyperparams: {},
  });

  useEffect(() => {
    if (!routeVersionId) return;
    setConfig((prev) => {
      const nextVersionId = String(routeVersionId);
      if (String(prev.datasetVersionId) === nextVersionId) return prev;
      return {
        ...prev,
        datasetVersionId: nextVersionId,
        targetColumn: "",
      };
    });
  }, [routeVersionId]);

  const updateConfig = useCallback((updates: Partial<TrainingConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const goNext = () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goPrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const canGoNext = useMemo((): boolean => {
    switch (currentStep) {
      case 0:
        return !!config.datasetVersionId && !!config.targetColumn;
      case 1:
        return true;
      case 2:
        return !step3Validation.hasErrors;
      case 3:
        return (config.models || []).length > 0;
      case 4:
        return (config.metrics || []).length > 0;
      default:
        return false;
    }
  }, [currentStep, config, step3Validation.hasErrors]);

  const progressValue = Math.round(((currentStep + 1) / steps.length) * 100);

  const handleStartTraining = async (): Promise<string | null> => {
    if (!projectId) {
      toast({
        title: "Erreur",
        description: "Project ID introuvable (route).",
        variant: "destructive",
      });
      return null;
    }

    try {
      const session = await trainingService.startTraining(projectId, config);

      toast({
        title: "Entrainement lance",
        description: `${(config.models || []).length} modele(s) en cours...`,
      });

      const sessionOut = session as { id?: string | number; session_id?: string | number };
      return String(sessionOut.id ?? sessionOut.session_id ?? "");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue lors de l'entrainement.";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleGoToResults = (sessionId: string) => {
    if (!projectId) return;
    const versionId = String(config.datasetVersionId || routeVersionId || "").trim();
    if (!versionId) {
      toast({
        title: "Erreur",
        description: "Version du dataset introuvable pour ouvrir les resultats.",
        variant: "destructive",
      });
      return;
    }

    navigate(`/projects/${projectId}/versions/${versionId}/training/results?session=${encodeURIComponent(sessionId)}`);
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
  };

  if (!projectId) {
    return (
      <AppLayout>
        <div className="w-full py-8">
          <div className="ai-surface rounded-2xl p-6">
            <h1 className="text-xl font-semibold">Training</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Impossible de recuperer l'ID du projet depuis la route. Verifiez le parametre{" "}
              <code className="mx-1">:id</code> ou <code className="mx-1">:projectId</code>.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 pb-8 sm:space-y-6 lg:space-y-7">
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="ai-surface-strong relative overflow-hidden p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute -left-16 top-8 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-secondary/12 blur-3xl" />

          <div className="relative space-y-4">
            <span className="ai-chip">
              <Sparkles className="h-3.5 w-3.5" />
              AI Training Studio
            </span>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Studio d'entrainement</h1>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                  Configurez, comparez et lancez vos modeles en {steps.length} etapes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center">
                  <p className="font-semibold text-foreground">{config.datasetVersionId ? "OK" : "N/A"}</p>
                  <p className="text-muted-foreground">Dataset</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center">
                  <p className="font-semibold text-foreground">{config.models.length}</p>
                  <p className="text-muted-foreground">Modeles</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center">
                  <p className="font-semibold text-foreground">{config.metrics.length}</p>
                  <p className="text-muted-foreground">Metriques</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progression</span>
                <span>{progressValue}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="ai-surface overflow-x-auto p-3 sm:p-4">
            <div className="min-w-[680px] md:min-w-0">
              <WizardStepper
                steps={steps}
                currentStep={currentStep}
                onStepClick={setCurrentStep}
                completedSteps={completedSteps}
              />
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait" custom={1}>
          <motion.div
            key={currentStep}
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="w-full min-w-0"
          >
            {currentStep === 0 && (
              <Step1DatasetTarget projectId={String(projectId)} config={config} onConfigChange={updateConfig} />
            )}
            {currentStep === 1 && (
              <Step2SplitStrategy projectId={String(projectId)} config={config} onConfigChange={updateConfig} />
            )}
            {currentStep === 2 && (
              <Step3ColumnPreprocessing
                projectId={String(projectId)}
                config={config}
                onConfigChange={updateConfig}
                onValidationStateChange={setStep3Validation}
              />
            )}
            {currentStep === 3 && (
              <Step4Models projectId={String(projectId)} config={config} onConfigChange={updateConfig} />
            )}
            {currentStep === 4 && <Step5Metrics config={config} onConfigChange={updateConfig} />}
            {currentStep === 5 && (
              <Step6Summary
                projectId={String(projectId)}
                config={config}
                onStartTraining={handleStartTraining}
                onGoToResults={handleGoToResults}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {currentStep < steps.length - 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ai-surface flex items-center justify-between border-border/60 px-4 py-3"
          >
            <Button variant="ghost" onClick={goPrev} disabled={currentStep === 0} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Precedent
            </Button>

            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Etape {currentStep + 1} / {steps.length}
            </div>

            <Button onClick={goNext} disabled={!canGoNext} className="gap-2 gradient-premium text-primary-foreground">
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {currentStep === 2 && step3Validation.hasErrors && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            Corrigez les erreurs de l'etape 3 pour continuer ({step3Validation.errorCount} erreur(s)).
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default TrainingPage;
