import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Columns,
  Lock,
  RefreshCw,
  Save,
  Scissors,
  Sliders,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";

import { dataService, type VersionUI } from "@/services/dataService";
import databaseService from "@/services/databaseService";
import { DEFAULT_TRAINING_PREPROCESSING, DEFAULT_TRAINING_BALANCING } from "@/types";

import { Step2SplitStrategy } from "@/components/preparation/Step2SplitStrategy";
import { Step3ColumnPreprocessing, type Step3ValidationState } from "@/components/preparation/Step3ColumnPreprocessing";
import { BalancingPanel } from "@/components/preparation/BalancingPanel";

import {
  savePrepConfig,
  loadPrepConfig,
  DEFAULT_PREP_CONFIG,
  type PrepConfig,
} from "@/utils/prepConfig";

import type { TrainingConfig, TrainingBalancingConfig } from "@/types";

/** PrepConfig cast as a minimal TrainingConfig subset for child components that expect TrainingConfig */
function toTrainingConfig(prep: PrepConfig): TrainingConfig {
  return {
    datasetVersionId: prep.datasetVersionId,
    targetColumn: prep.targetColumn,
    taskType: prep.taskType,
    splitMethod: prep.splitMethod,
    trainRatio: prep.trainRatio,
    valRatio: prep.valRatio,
    testRatio: prep.testRatio,
    kFolds: prep.kFolds,
    shuffle: prep.shuffle,
    preprocessing: prep.preprocessing,
    balancing: prep.balancing,
    useSmote: prep.useSmote,
    // minimal required fields not used in these steps
    models: [],
    searchType: "none",
    nIterRandomSearch: 40,
    useGridSearch: false,
    gridCvFolds: 3,
    gridScoring: "auto",
    metrics: [],
    trainingDebug: false,
    modelHyperparams: {},
  };
}

export function PreparationPage() {
  const { id } = useParams();
  const projectId = id!;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<VersionUI[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [savedVersionId, setSavedVersionId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("split");

  const [prepConfig, setPrepConfig] = useState<PrepConfig>({ ...DEFAULT_PREP_CONFIG });
  const [step3Validation, setStep3Validation] = useState<Step3ValidationState>({
    hasErrors: false,
    errorCount: 0,
    warningCount: 0,
    isValidating: false,
  });

  // Load versions list
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const vers = await dataService.getVersions(projectId);
        setVersions(vers);

        // auto-select first version
        if (vers.length > 0) {
          const firstId = String(vers[0].id);
          setSelectedVersionId(firstId);
        }
      } catch (e) {
        toast({
          title: "Erreur",
          description: (e as Error).message || "Impossible de charger les versions",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // When version changes, load saved prep config from localStorage
  useEffect(() => {
    if (!selectedVersionId) return;

    const saved = loadPrepConfig(projectId, selectedVersionId);
    if (saved) {
      setPrepConfig(saved);
      setSavedVersionId(selectedVersionId);
      setIsSaved(true);
      setActiveTab("split");
    } else {
      setActiveTab("split");
      // Load the saved target column from backend as default
      const loadTarget = async () => {
        try {
          // Find dataset id from active dataset
          const active = await databaseService.getActiveDataset(projectId);
          if (active.active_dataset_id) {
            const targetData = await databaseService.getDatasetTarget(
              projectId,
              active.active_dataset_id
            );
            setPrepConfig({
              ...DEFAULT_PREP_CONFIG,
              datasetVersionId: selectedVersionId,
              targetColumn: targetData.target_column ?? "",
              preprocessing: { ...DEFAULT_TRAINING_PREPROCESSING },
              balancing: { ...DEFAULT_TRAINING_BALANCING },
            });
          } else {
            setPrepConfig({
              ...DEFAULT_PREP_CONFIG,
              datasetVersionId: selectedVersionId,
            });
          }
        } catch {
          setPrepConfig({
            ...DEFAULT_PREP_CONFIG,
            datasetVersionId: selectedVersionId,
          });
        }
      };

      // Try to get target from the version metadata
      const version = versions.find((v) => String(v.id) === selectedVersionId);
      if (version?.targetColumn) {
        setPrepConfig({
          ...DEFAULT_PREP_CONFIG,
          datasetVersionId: selectedVersionId,
          targetColumn: version.targetColumn,
        });
      } else {
        loadTarget();
      }

      setIsSaved(false);
      setSavedVersionId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId]);

  const updateConfig = useCallback((updates: Partial<TrainingConfig>) => {
    setPrepConfig((prev) => {
      const next = { ...prev };
      if (updates.splitMethod !== undefined) next.splitMethod = updates.splitMethod;
      if (updates.trainRatio !== undefined) next.trainRatio = updates.trainRatio;
      if (updates.valRatio !== undefined) next.valRatio = updates.valRatio;
      if (updates.testRatio !== undefined) next.testRatio = updates.testRatio;
      if (updates.kFolds !== undefined) next.kFolds = updates.kFolds;
      if (updates.shuffle !== undefined) next.shuffle = updates.shuffle;
      if (updates.preprocessing !== undefined) next.preprocessing = updates.preprocessing;
      if (updates.targetColumn !== undefined) next.targetColumn = updates.targetColumn;
      if (updates.taskType !== undefined) next.taskType = updates.taskType;
      return next;
    });
    setIsSaved(false);
  }, []);

  const updateBalancing = useCallback(
    (updates: { balancing?: TrainingBalancingConfig; useSmote?: boolean }) => {
      setPrepConfig((prev) => ({
        ...prev,
        ...(updates.balancing !== undefined ? { balancing: updates.balancing } : {}),
        ...(updates.useSmote !== undefined ? { useSmote: updates.useSmote } : {}),
      }));
      setIsSaved(false);
    },
    []
  );

  const handleSave = () => {
    if (!selectedVersionId) return;
    const toSave: PrepConfig = {
      ...prepConfig,
      datasetVersionId: selectedVersionId,
    };
    savePrepConfig(projectId, selectedVersionId, toSave);
    setSavedVersionId(selectedVersionId);
    setIsSaved(true);
    toast({ title: "Configuration enregistrée", description: "La configuration de préparation ML a été sauvegardée." });
  };

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;

  const splitDone = !!prepConfig.splitMethod;
  const trainingConfig = toTrainingConfig({ ...prepConfig, datasetVersionId: selectedVersionId });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/projects/${projectId}/versions`} className="hover:text-foreground transition-colors">
            Versions
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Préparation ML</span>
        </div>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div className="absolute inset-0 pointer-events-none opacity-50 [background:radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.15),transparent_40%),radial-gradient(circle_at_90%_30%,rgba(99,102,241,0.12),transparent_45%)]" />
          <div className="relative p-6 md:p-10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-violet-500/10">
                <Sliders className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Préparation ML
                </h1>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Configurez le prétraitement, le split et le rééquilibrage avant l'entraînement.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {/* Version selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Version :</span>
                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                  <SelectTrigger className="h-8 w-48 rounded-xl text-xs">
                    <SelectValue placeholder="Choisir une version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name ?? `Version #${v.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSaved && savedVersionId === selectedVersionId && (
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-xs">
                  Config enregistrée
                </Badge>
              )}
              {!isSaved && (
                <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                  Modifications non sauvegardées
                </Badge>
              )}
            </div>
          </div>
        </div>

        {!selectedVersionId ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucune version disponible. Créez d'abord une version via{" "}
              <Link to={`/projects/${projectId}/nettoyage`} className="underline">
                Pretraitement
              </Link>.
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="split" className="gap-2">
                  <Scissors className="h-4 w-4" />
                  1. Split
                </TabsTrigger>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <TabsTrigger value="columns" className="gap-2" disabled={!splitDone}>
                        {!splitDone && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Columns className="h-4 w-4" />
                        2. Colonnes
                        {step3Validation.errorCount > 0 && (
                          <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                            {step3Validation.errorCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  {!splitDone && (
                    <TooltipContent>Validez d'abord le split</TooltipContent>
                  )}
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <TabsTrigger value="balancing" className="gap-2" disabled={!splitDone}>
                        {!splitDone && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <RefreshCw className="h-4 w-4" />
                        3. Rééquilibrage
                      </TabsTrigger>
                    </span>
                  </TooltipTrigger>
                  {!splitDone && (
                    <TooltipContent>Validez d'abord le split</TooltipContent>
                  )}
                </Tooltip>
              </TabsList>

              <Button
                onClick={handleSave}
                disabled={step3Validation.hasErrors || !splitDone}
                className="gap-2"
                size="sm"
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </div>

            <TabsContent value="split">
              <Step2SplitStrategy
                projectId={projectId}
                config={trainingConfig}
                onConfigChange={updateConfig}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("columns")}
                  className="gap-2"
                >
                  Suivant : Colonnes
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="columns">
              <Step3ColumnPreprocessing
                projectId={projectId}
                config={trainingConfig}
                onConfigChange={updateConfig}
                onValidationStateChange={setStep3Validation}
                serverValidationEnabled={false}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("balancing")}
                  className="gap-2"
                  disabled={step3Validation.hasErrors}
                >
                  Suivant : Rééquilibrage
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="balancing">
              <BalancingPanel
                projectId={projectId}
                config={{
                  datasetVersionId: selectedVersionId,
                  targetColumn: prepConfig.targetColumn,
                  taskType: prepConfig.taskType,
                  balancing: prepConfig.balancing,
                  useSmote: prepConfig.useSmote,
                }}
                onConfigChange={updateBalancing}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

export default PreparationPage;
