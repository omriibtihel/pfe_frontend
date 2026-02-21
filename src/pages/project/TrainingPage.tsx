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
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trainingService } from "@/services/trainingService";

import type { TrainingConfig } from "@/types";
import { DEFAULT_TRAINING_PREPROCESSING } from "@/types";

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
  { label: "Modèles", icon: <Brain className="h-5 w-5" /> },
  { label: "Métriques", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Lancer", icon: <Rocket className="h-5 w-5" /> },
];

export function TrainingPage() {
  const params = useParams<{ projectId?: string; id?: string; versionId?: string }>();
  // ✅ évite /projects/undefined/...
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
        title: "Entraînement lancé",
        description: `${(config.models || []).length} modèle(s) en cours...`,
      });

      const sessionOut = session as { id?: string | number; session_id?: string | number };
      return String(sessionOut.id ?? sessionOut.session_id ?? "");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Une erreur est survenue lors de l'entrainement.";
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
    navigate(
      `/projects/${projectId}/versions/${versionId}/training/results?session=${encodeURIComponent(sessionId)}`
    );
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
  };

  // Render guard (évite l’appel API avec undefined)
  if (!projectId) {
    return (
      <AppLayout>
        <div className="w-full py-8">
          <div className="rounded-2xl border border-border p-6">
            <h1 className="text-xl font-semibold">Training</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Impossible de récupérer l’ID du projet depuis la route. Vérifie ton router (paramètre
              <code className="mx-1">:id</code> ou <code className="mx-1">:projectId</code>).
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6 lg:space-y-8 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 text-center lg:text-left"
        >
          <h1 className="text-3xl font-bold text-gradient">Studio d'entraînement</h1>
          <p className="text-muted-foreground">Configurez et lancez vos modèles en {steps.length} étapes</p>
        </motion.div>

        {/* Stepper */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="overflow-x-auto pb-2">
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

        {/* Step Content */}
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

        {/* Navigation */}
        {currentStep < steps.length - 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between pt-4 border-t border-border/50"
          >
            <Button variant="ghost" onClick={goPrev} disabled={currentStep === 0} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>

            <span className="text-sm text-muted-foreground">
              Étape {currentStep + 1} / {steps.length}
            </span>

            <Button onClick={goNext} disabled={!canGoNext} className="gap-2 gradient-premium text-primary-foreground">
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
        {currentStep === 2 && step3Validation.hasErrors && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Corrigez les erreurs Step 3 pour continuer ({step3Validation.errorCount} erreur(s)).
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default TrainingPage;

