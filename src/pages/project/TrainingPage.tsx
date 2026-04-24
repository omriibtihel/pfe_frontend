import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Database,
  Brain,
  BarChart3,
  Rocket,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  AlertTriangle,
  History,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { trainingService } from "@/services/trainingService";

import type {
  TrainingConfig,
  TrainingMode,
} from "@/types";
import { AutoMLConfigPanel } from "@/components/training/wizard/AutoMLConfigPanel";
import type { TrainingSession } from "@/services/trainingService";
import { DEFAULT_TRAINING_BALANCING, DEFAULT_TRAINING_PREPROCESSING } from "@/types";

import { WizardStepper } from "@/components/training/wizard/WizardStepper";
import { Step1DatasetTarget } from "@/components/training/wizard/Step1DatasetTarget";
import { Step4Models } from "@/components/training/wizard/Step4Models";
import { Step5Metrics } from "@/components/training/wizard/Step5Metrics";
import { Step6Summary } from "@/components/training/wizard/Step6Summary";
import { loadPrepConfig, savePrepConfig } from "@/utils/prepConfig";
import dataService from "@/services/dataService";

const steps = [
  { label: "Dataset & Cible",  icon: <Database       className="h-5 w-5" /> },
  { label: "Modeles",          icon: <Brain           className="h-5 w-5" /> },
  { label: "Metriques",        icon: <BarChart3       className="h-5 w-5" /> },
  { label: "Lancer",           icon: <Rocket          className="h-5 w-5" /> },
];

// ── Mode dialog (shown after step 1 is complete) ─────────────────────────────

interface ModeDialogProps {
  open: boolean;
  projectId: string;
  config: TrainingConfig;
  onManual: () => void;
  onClose: () => void;
  onAutoMLSessionStarted: (session: TrainingSession) => void;
}

function ModeDialog({
  open,
  projectId,
  config,
  onManual,
  onClose,
  onAutoMLSessionStarted,
}: ModeDialogProps) {
  const [showAutoML, setShowAutoML] = useState(false);

  useEffect(() => {
    if (open) setShowAutoML(false);
  }, [open]);

  // X / ESC : si AutoML est affiché, revenir à la sélection ; sinon fermer
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (showAutoML) setShowAutoML(false);
      else onClose();
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      onOpenChange={handleOpenChange}
      preventCloseOnOutside
      size="2xl"
      icon={<Sparkles className="h-4 w-4" />}
      title="Configuration de l'entraînement"
      description={
        showAutoML
          ? "Paramétrez le budget temps puis lancez AutoML."
          : "Choisissez votre mode d'entraînement."
      }
    >
      {!showAutoML && (
        <div className="grid grid-cols-2 gap-3">
          {/* AutoML card */}
          <Card
            className="cursor-pointer border-2 transition-colors hover:border-primary/60 hover:bg-primary/5"
            onClick={() => setShowAutoML(true)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bot className="h-4 w-4 text-primary" />
                AutoML
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  Recommandé
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>
                FLAML explore automatiquement les modèles, le preprocessing et les
                hyperparamètres dans le budget temps que vous définissez.
              </p>
              <ul className="mt-2 space-y-1">
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Pipeline complet automatique
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Un seul paramètre : le budget temps
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Manual card */}
          <Card
            className="cursor-pointer border-2 transition-colors hover:border-primary/60 hover:bg-primary/5"
            onClick={onManual}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Mode manuel
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>
                Contrôle total : choisissez chaque modèle, métrique, étape de preprocessing et
                stratégie HPO vous-même.
              </p>
              <ul className="mt-2 space-y-1">
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Vos choix, vos règles
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Wizard en 4 étapes
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {showAutoML && (
        <AutoMLConfigPanel
          projectId={projectId}
          datasetVersionId={config.datasetVersionId}
          targetColumn={config.targetColumn}
          taskType={config.taskType}
          positiveLabel={config.positiveLabel}
          onSessionStarted={onAutoMLSessionStarted}
        />
      )}
    </Modal>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export function TrainingPage() {
  const params = useParams<{ projectId?: string; id?: string; versionId?: string }>();
  const projectId = params.projectId ?? params.id;
  const routeVersionId = params.versionId;

  const navigate = useNavigate();
  const { toast } = useToast();

  // ── Hooks du wizard tabulaire ──────────────────────────────────────────────
  const [trainingMode, setTrainingMode] = useState<TrainingMode | null>(null);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [pastSessions, setPastSessions] = useState<TrainingSession[]>([]);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const [config, setConfig] = useState<TrainingConfig>({
    datasetVersionId: routeVersionId ? String(routeVersionId) : "",
    targetColumn: "",
    taskType: "classification",
    models: [],
    searchType: "none",
    nIterRandomSearch: 40,
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
      return { ...prev, datasetVersionId: nextVersionId, targetColumn: "" };
    });
  }, [routeVersionId]);

  // Load session history
  useEffect(() => {
    if (!projectId) return;
    trainingService.getSessions(String(projectId))
      .then((sessions) => { setPastSessions(sessions.slice().reverse()); setHistoryLoadFailed(false); })
      .catch((e) => { console.warn('[TrainingPage] History load failed — non-critical:', e); setHistoryLoadFailed(true); });
  }, [projectId]);

  const updateConfig = useCallback((updates: Partial<TrainingConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Mode dialog callbacks ──────────────────────────────────────────────────

  /** User chose manual mode: close dialog, go to step 1 */
  const handleManual = useCallback(() => {
    setTrainingMode("manual");
    setShowModeDialog(false);
    setCompletedSteps((prev) => new Set(prev).add(0));
    setCurrentStep(1);
  }, []);

  /** AutoML session started: navigate directly to results */
  const handleAutoMLSessionStarted = useCallback(
    (session: TrainingSession) => {
      setTrainingMode("automl");
      setShowModeDialog(false);
      const sessionId = String(session.id ?? (session as { session_id?: string | number }).session_id ?? "");
      if (!sessionId || !projectId) return;
      const versionId = String(config.datasetVersionId || routeVersionId || "").trim();
      if (!versionId) return;
      navigate(
        `/projects/${projectId}/versions/${versionId}/training/results?session=${encodeURIComponent(sessionId)}`
      );
    },
    [config.datasetVersionId, projectId, routeVersionId, navigate]
  );

  // ── Navigation ─────────────────────────────────────────────────────────────

  const canGoNext = useMemo((): boolean => {
    switch (currentStep) {
      case 0: return !!config.datasetVersionId && !!config.targetColumn;
      case 1: return (config.models || []).length > 0;
      case 2: return (config.metrics || []).length > 0;
      default: return false;
    }
  }, [currentStep, config]);

  /** Clicking "Suivant" on step 0 opens the mode dialog instead of going directly to step 1 */
  const handleNext = useCallback(() => {
    if (currentStep === 0) {
      setShowModeDialog(true);
      return;
    }
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [currentStep]);

  const goPrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const progressValue = useMemo(() => {
    if (trainingMode === null) return Math.round((1 / steps.length) * 100);
    return Math.round(((currentStep + 1) / steps.length) * 100);
  }, [trainingMode, currentStep]);

  const filteredSessions = useMemo(() => {
    const selectedVersionId = String(config.datasetVersionId || routeVersionId || "").trim();
    if (!selectedVersionId) return pastSessions;
    return pastSessions.filter(
      (s) => String(s.datasetVersionId || "").trim() === selectedVersionId,
    );
  }, [pastSessions, config.datasetVersionId, routeVersionId]);

  // ── Training ───────────────────────────────────────────────────────────────

  const handleStartTraining = async (): Promise<string | null> => {
    if (!projectId) {
      toast({ title: "Erreur", description: "Project ID introuvable.", variant: "destructive" });
      return null;
    }
    try {
      // Merge PrepConfig (split/preprocessing/balancing) from PreparationPage if available
      // Priorité : localStorage (cache) → backend (source de vérité si cache vide)
      const versionId = String(config.datasetVersionId || routeVersionId || "").trim();
      let prepConfig = versionId ? loadPrepConfig(String(projectId), versionId) : null;
      if (!prepConfig && versionId) {
        const remote = await dataService.getPrepConfig(projectId, versionId);
        if (remote) {
          prepConfig = remote as unknown as import("@/utils/prepConfig").PrepConfig;
          savePrepConfig(String(projectId), versionId, prepConfig); // mise en cache locale
        }
      }
      const mergedConfig: TrainingConfig = prepConfig
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
            ...(prepConfig.featureEngineering ? { featureEngineering: prepConfig.featureEngineering } : {}),
          }
        : config;
      const session = await trainingService.startTraining(projectId, mergedConfig);
      toast({
        title: "Entraînement lancé",
        description: `${(config.models || []).length} modèle(s) en cours…`,
      });
      const sessionOut = session as { id?: string | number; session_id?: string | number };
      return String(sessionOut.id ?? sessionOut.session_id ?? "");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue lors de l'entrainement.";
      toast({ title: "Erreur", description: message, variant: "destructive" });
      return null;
    }
  };

  const handleGoToResults = (sessionId: string) => {
    if (!projectId) return;
    const versionId = String(config.datasetVersionId || routeVersionId || "").trim();
    if (!versionId) {
      toast({
        title: "Erreur",
        description: "Version du dataset introuvable.",
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

  if (!projectId) {
    return (
      <AppLayout>
        <div className="w-full py-8">
          <div className="ai-surface rounded-2xl p-6">
            <h1 className="text-xl font-semibold">Entraînement</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Impossible de récupérer l'ID du projet depuis la route.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 pb-8 sm:space-y-6 lg:space-y-7">
        {/* Header */}
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
              Studio IA
            </span>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Studio d'entraînement
                  {trainingMode && (
                    <Badge
                      variant={trainingMode === "automl" ? "default" : "secondary"}
                      className="ml-3 align-middle text-xs"
                    >
                      {trainingMode === "automl" ? "AutoML" : "Mode manuel"}
                    </Badge>
                  )}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                  {trainingMode === null
                    ? "Sélectionnez un dataset et une cible, puis choisissez votre mode."
                    : trainingMode === "automl"
                    ? "FLAML explore automatiquement les modèles et hyperparamètres."
                    : `Configurez vos modèles en ${steps.length} étapes.`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center">
                  <p className="font-semibold text-foreground">
                    {config.datasetVersionId ? "OK" : "N/A"}
                  </p>
                  <p className="text-muted-foreground">Dataset</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center">
                  <p className="font-semibold text-foreground">{config.models.length}</p>
                  <p className="text-muted-foreground">Modèles</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-center">
                  <p className="font-semibold text-foreground">{config.metrics.length}</p>
                  <p className="text-muted-foreground">Métriques</p>
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

        {/* Stepper */}
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

        {/* Step content */}
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
              <Step1DatasetTarget
                projectId={String(projectId)}
                config={config}
                onConfigChange={updateConfig}
              />
            )}
            {currentStep === 1 && (
              <Step4Models
                projectId={String(projectId)}
                config={config}
                onConfigChange={updateConfig}
              />
            )}
            {currentStep === 2 && <Step5Metrics config={config} onConfigChange={updateConfig} />}
            {currentStep === 3 && (
              <Step6Summary
                projectId={String(projectId)}
                config={config}
                onStartTraining={handleStartTraining}
                onGoToResults={handleGoToResults}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation bar */}
        {currentStep < steps.length - 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ai-surface flex items-center justify-between border-border/60 px-4 py-3"
          >
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>

            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {currentStep === 0 && trainingMode === null
                ? "Choisissez votre mode après avoir sélectionné la cible"
                : `Étape ${currentStep + 1} / ${steps.length}`}
            </div>

            <Button
              onClick={handleNext}
              disabled={!canGoNext}
              className="gap-2 gradient-premium text-primary-foreground"
            >
              {currentStep === 0 && trainingMode === null ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Choisir le mode
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Session history — soft failure indicator */}
        {historyLoadFailed && (
          <div
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            data-testid="history-load-failed"
          >
            <History className="h-3.5 w-3.5 shrink-0" />
            <span>Historique indisponible</span>
            <button
              type="button"
              className="ml-auto flex items-center gap-1 rounded px-2 py-1 hover:bg-muted transition-colors"
              onClick={() => {
                setHistoryLoadFailed(false);
                trainingService.getSessions(String(projectId))
                  .then((sessions) => setPastSessions(sessions.slice().reverse()))
                  .catch((e) => { console.warn('[TrainingPage] History retry failed:', e); setHistoryLoadFailed(true); });
              }}
              data-testid="history-retry-btn"
            >
              <RefreshCw className="h-3 w-3" />
              Réessayer
            </button>
          </div>
        )}

        {/* Session history */}
        {filteredSessions.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="ai-surface p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Sessions précédentes</h2>
                <span className="ml-auto text-xs text-muted-foreground">{filteredSessions.length} session{filteredSessions.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {filteredSessions.slice(0, 8).map((s) => {
                  const sid = String(s.id);
                  const vId = String(s.datasetVersionId || config.datasetVersionId || routeVersionId || "");
                  const href = vId
                    ? `/projects/${projectId}/versions/${vId}/training/results?session=${encodeURIComponent(sid)}`
                    : null;
                  const nModels = s.results?.length ?? 0;
                  const statusColor =
                    s.status === "succeeded" ? "text-green-600 dark:text-green-400"
                    : s.status === "failed" ? "text-destructive"
                    : s.status === "running" ? "text-primary"
                    : "text-muted-foreground";
                  const date = s.createdAt ? new Date(s.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
                  const displayName = (s.config as Record<string, unknown> | undefined)?.name as string | undefined;
                  const isRenaming = renamingSessionId === sid;
                  return (
                    <div
                      key={sid}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isRenaming ? (
                            <input
                              autoFocus
                              className="rounded border border-border bg-background px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const trimmed = renameValue.trim();
                                  if (!trimmed) return;
                                  trainingService.renameSession(String(projectId), sid, trimmed)
                                    .then(() => {
                                      setPastSessions((prev) =>
                                        prev.map((ps) =>
                                          String(ps.id) === sid
                                            ? { ...ps, config: { ...(ps.config as Record<string, unknown>), name: trimmed } }
                                            : ps
                                        )
                                      );
                                    })
                                    .catch(() => toast({ title: "Erreur", description: "Impossible de renommer la session", variant: "destructive" }));
                                  setRenamingSessionId(null);
                                } else if (e.key === "Escape") {
                                  setRenamingSessionId(null);
                                }
                              }}
                              onBlur={() => setRenamingSessionId(null)}
                            />
                          ) : (
                            <span className="font-medium truncate">
                              {displayName ?? `Session #${sid}`}
                            </span>
                          )}
                          <span className={`text-xs font-medium ${statusColor}`}>{s.status}</span>
                          {s.config?.taskType && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{s.config.taskType}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {date} · {nModels} modèle{nModels !== 1 ? "s" : ""}
                          {s.config?.datasetVersionId ? ` · v${s.config.datasetVersionId}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {href && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => navigate(href)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Voir
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameValue(displayName ?? `Session #${sid}`);
                                setRenamingSessionId(sid);
                              }}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Renommer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingSessionId(sid)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

      </div>

      {/* Delete session confirmation */}
      <Modal
        isOpen={deletingSessionId !== null}
        onClose={() => setDeletingSessionId(null)}
        title="Supprimer la session"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Cette action supprimera définitivement la session et tous ses modèles entraînés. Elle est irréversible.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDeletingSessionId(null)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (!deletingSessionId) return;
              const sid = deletingSessionId;
              setDeletingSessionId(null);
              trainingService.deleteSession(String(projectId), sid)
                .then(() => setPastSessions((prev) => prev.filter((ps) => String(ps.id) !== sid)))
                .catch(() => toast({ title: "Erreur", description: "Impossible de supprimer la session", variant: "destructive" }));
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Supprimer
          </Button>
        </div>
      </Modal>

      {/* Mode dialog — opens after step 1 is complete */}
      <ModeDialog
        open={showModeDialog}
        projectId={String(projectId)}
        config={config}
        onManual={handleManual}
        onClose={() => setShowModeDialog(false)}
        onAutoMLSessionStarted={handleAutoMLSessionStarted}
      />
    </AppLayout>
  );
}

export default TrainingPage;
