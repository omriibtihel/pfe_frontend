import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Bookmark,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileUp,
  FormInput,
  Layers,
  Loader2,
  Play,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';

import { AppLayout } from '@/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  buildSavedModelVersionGroups,
  getDefaultSelectedModelId,
  getDefaultSelectedVersionId,
} from '@/pages/project/predictionPage.helpers';
import { predictionService } from '@/services/predictionService';
import { trainingService } from '@/services/trainingService';
import type { PredictionResponse, SavedModelSummary } from '@/types';

export function PredictionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [savedModels, setSavedModels] = useState<SavedModelSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [noModelError, setNoModelError] = useState<string | null>(null);

  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [mode, setMode] = useState<'manual' | 'file'>('file');
  const [withShap, setWithShap] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    setLoadingModels(true);
    predictionService
      .getSavedModels(id)
      .then((models) => {
        setSavedModels(models);
        setNoModelError(null);
      })
      .catch((err: Error) => {
        setNoModelError(err.message || 'Impossible de charger les modèles sauvegardés.');
      })
      .finally(() => setLoadingModels(false));
  }, [id]);

  const versionGroups = useMemo(
    () => buildSavedModelVersionGroups(savedModels),
    [savedModels],
  );

  useEffect(() => {
    setSelectedVersionId((current) => getDefaultSelectedVersionId(versionGroups, current));
  }, [versionGroups]);

  const selectedVersion = useMemo(
    () => versionGroups.find((group) => group.id === selectedVersionId) ?? null,
    [selectedVersionId, versionGroups],
  );

  const modelsForSelectedVersion = selectedVersion?.models ?? [];

  useEffect(() => {
    setSelectedModelId((current) => getDefaultSelectedModelId(modelsForSelectedVersion, current));
  }, [modelsForSelectedVersion]);

  useEffect(() => {
    setManualData({});
  }, [selectedModelId]);

  const selectedModel =
    modelsForSelectedVersion.find((model) => model.id === selectedModelId) ??
    savedModels.find((model) => model.id === selectedModelId) ??
    null;

  const updateManualField = (field: string, value: string) => {
    setManualData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeleteModel = async (model: SavedModelSummary) => {
    if (!id || deletingModelId) return;
    setDeletingModelId(model.id);
    try {
      await trainingService.deleteModel(id, model.sessionId, model.id);
      setSavedModels((prev) => prev.filter((m) => m.id !== model.id));
      if (selectedModelId === model.id) setSelectedModelId('');
      toast({ title: 'Modèle supprimé', description: `${model.modelType.toUpperCase()} supprimé définitivement.` });
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Impossible de supprimer le modèle.', variant: 'destructive' });
    } finally {
      setDeletingModelId(null);
    }
  };

  const handlePredict = async () => {
    if (!id || !selectedModel) return;
    setIsPredicting(true);
    try {
      let result: PredictionResponse;
      if (mode === 'file') {
        if (!file) {
          toast({ title: 'Veuillez sélectionner un fichier', variant: 'destructive' });
          return;
        }
        result = await predictionService.predictWithSavedModel(id, selectedModel.id, file);
      } else {
        const rows = [
          Object.fromEntries(
            Object.entries(manualData).map(([key, value]) => [
              key,
              Number.isNaN(Number(value)) ? value : Number(value),
            ]),
          ),
        ];
        result = withShap
          ? await predictionService.predictManualWithSavedModelExplain(id, selectedModel.id, rows)
          : await predictionService.predictManualWithSavedModel(id, selectedModel.id, rows);
      }

      sessionStorage.setItem('lastPrediction', JSON.stringify(result));
      sessionStorage.setItem('lastPredictionFile', file?.name ?? 'manual');
      toast({ title: `Prédiction terminée — ${result.nRows} ligne(s)` });
      navigate(`/projects/${id}/predict/results`);
    } catch (error) {
      toast({
        title: 'Erreur de prédiction',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive',
      });
    } finally {
      setIsPredicting(false);
    }
  };

  const canPredict =
    !isPredicting &&
    selectedModel !== null &&
    (mode === 'file' ? file !== null : Object.keys(manualData).length > 0);

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prédiction</h1>
            <p className="mt-1 text-muted-foreground">
              Utilisez vos modèles entraînés pour faire des prédictions.
            </p>
          </div>
          <Badge variant="secondary" className="self-start">
            <Target className="mr-1 h-3 w-3" /> Inférence
          </Badge>
        </div>

        {loadingModels ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Chargement des modèles sauvegardés…</span>
            </CardContent>
          </Card>
        ) : noModelError || savedModels.length === 0 ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Aucun modèle sauvegardé</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {noModelError ??
                    "Entraînez des modèles puis cliquez sur 'Enregistrer' pour les sauvegarder."}
                </p>
                <Button
                  variant="link"
                  className="mt-1 h-auto p-0 text-sm"
                  onClick={() => navigate(`/projects/${id}/training`)}
                >
                  Aller vers l'entraînement →
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-5 w-5 text-primary" />
                Sélection du modèle
              </CardTitle>
              <CardDescription>
                {savedModels.length} modèle{savedModels.length > 1 ? 's' : ''} sauvegardé
                {savedModels.length > 1 ? 's' : ''} sur {versionGroups.length} version
                {versionGroups.length > 1 ? 's' : ''} de données
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Version selector */}
              <div className="space-y-2">
                <Label htmlFor="prediction-version-select" className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Version de données
                </Label>
                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                  <SelectTrigger id="prediction-version-select" className="w-full">
                    <SelectValue placeholder="Choisir une version de données…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versionGroups.map((group) => (
                      <SelectItem
                        key={group.id}
                        value={group.id}
                        textValue={`${group.label} (${group.models.length} modèle${group.models.length > 1 ? 's' : ''})`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{group.label}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {group.models.length} modèle{group.models.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model selector + delete */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                  Modèle sauvegardé
                </Label>
                {modelsForSelectedVersion.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun modèle pour cette version.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choisir un modèle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelsForSelectedVersion.map((model) => {
                          const scoreLabel =
                            model.testScore != null
                              ? ` — ${(model.testScore * 100).toFixed(1)}%${model.primaryMetric ? ` ${model.primaryMetric}` : ''}`
                              : '';
                          return (
                            <SelectItem key={model.id} value={model.id}>
                              <span className="font-medium uppercase">{model.modelType}</span>
                              {model.isActive && (
                                <span className="ml-1.5 text-xs text-primary font-semibold">(actif)</span>
                              )}
                              {scoreLabel && (
                                <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                                  {scoreLabel}
                                </span>
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedModelId && (
                      <button
                        type="button"
                        aria-label="Supprimer le modèle sélectionné"
                        disabled={!!deletingModelId}
                        onClick={() => {
                          const model = modelsForSelectedVersion.find((m) => m.id === selectedModelId);
                          if (model) void handleDeleteModel(model);
                        }}
                        className="shrink-0 rounded-md border border-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 transition-colors"
                      >
                        {deletingModelId === selectedModelId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Selected model details panel */}
              {selectedModel && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Détails du modèle sélectionné
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <ModelDetailRow
                      icon={<Brain className="h-3 w-3" />}
                      label="Type"
                      value={selectedModel.modelType.toUpperCase()}
                    />
                    <ModelDetailRow
                      icon={<Target className="h-3 w-3" />}
                      label="Tâche"
                      value={selectedModel.taskType === 'classification' ? 'Classification' : 'Régression'}
                    />
                    <ModelDetailRow
                      icon={<CheckCircle2 className="h-3 w-3" />}
                      label="Variables"
                      value={`${selectedModel.featureNames.length} colonne${selectedModel.featureNames.length > 1 ? 's' : ''}`}
                    />
                    {selectedModel.testScore != null && (
                      <ModelDetailRow
                        icon={<Target className="h-3 w-3" />}
                        label={selectedModel.primaryMetric ?? 'Score'}
                        value={`${(selectedModel.testScore * 100).toFixed(1)}%`}
                        highlight
                      />
                    )}
                    {selectedModel.threshold !== 0.5 && (
                      <ModelDetailRow
                        icon={<ChevronRight className="h-3 w-3" />}
                        label="Seuil"
                        value={selectedModel.threshold.toFixed(3)}
                      />
                    )}
                    {selectedModel.trainingTime != null && (
                      <ModelDetailRow
                        icon={<Clock className="h-3 w-3" />}
                        label="Durée"
                        value={`${selectedModel.trainingTime.toFixed(1)}s`}
                      />
                    )}
                    {selectedModel.trainedAt && (
                      <ModelDetailRow
                        icon={<CalendarDays className="h-3 w-3" />}
                        label="Entraîné le"
                        value={new Date(selectedModel.trainedAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      />
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mode selection — two-card grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card
            className={`cursor-pointer transition-all ${
              mode === 'manual' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'
            }`}
            onClick={() => setMode('manual')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FormInput className="h-5 w-5 text-primary" />
                Saisie manuelle
              </CardTitle>
              <CardDescription>Entrez les données d'un patient manuellement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant={mode === 'manual' ? 'default' : 'outline'}
                className="w-full"
                disabled={!selectedModel}
                onClick={(event) => {
                  event.stopPropagation();
                  setMode('manual');
                  setShowManualModal(true);
                }}
              >
                Remplir les champs
              </Button>
              {/* SHAP toggle — only visible in manual mode */}
              {mode === 'manual' && (
                <label
                  className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    role="checkbox"
                    aria-checked={withShap}
                    onClick={() => setWithShap((v) => !v)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${withShap ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${withShap ? 'translate-x-4' : ''}`}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-violet-500" />
                      Expliquer avec SHAP
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Affiche l'impact de chaque variable
                    </p>
                  </div>
                </label>
              )}
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              mode === 'file' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'
            }`}
            onClick={() => setMode('file')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-secondary" />
                Import de fichier
              </CardTitle>
              <CardDescription>Chargez un fichier CSV / JSON / Parquet</CardDescription>
            </CardHeader>
            <CardContent>
              {mode === 'file' ? (
                <FileUpload onUpload={(uploadedFile) => setFile(uploadedFile)} />
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground">
                  Sélectionnez ce mode
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Button
          size="lg"
          className="h-14 w-full bg-gradient-to-r from-primary to-secondary text-lg shadow-glow"
          onClick={handlePredict}
          disabled={!canPredict}
        >
          {isPredicting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Prédiction en cours…
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Prédire le diagnostic
              {withShap && mode === 'manual' && (
                <span className="ml-2 text-sm opacity-70">+ SHAP</span>
              )}
            </>
          )}
        </Button>
      </div>

      <Modal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Saisie des données patient"
        size="lg"
      >
        {selectedModel && (selectedModel.featureNames ?? []).length > 0 ? (
          <>
            <div className="grid max-h-96 grid-cols-2 gap-4 overflow-y-auto">
              {(selectedModel.featureNames ?? []).map((column) => (
                <div key={column} className="space-y-1">
                  <Label htmlFor={column} className="capitalize">
                    {column}
                  </Label>
                  <Input
                    id={column}
                    value={manualData[column] ?? ''}
                    onChange={(event) => updateManualField(column, event.target.value)}
                    placeholder={`Entrez ${column}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowManualModal(false)}>
                Annuler
              </Button>
              <Button onClick={() => setShowManualModal(false)}>Valider</Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            Impossible de charger les colonnes du modèle sélectionné.
          </p>
        )}
      </Modal>
    </AppLayout>
  );
}

function ModelDetailRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="text-muted-foreground">{label} :</span>
      <span className={`font-medium ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

export default PredictionPage;
