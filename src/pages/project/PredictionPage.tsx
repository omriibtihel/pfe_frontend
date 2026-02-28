import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Target,
  FileUp,
  FormInput,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Brain,
} from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/ui/file-upload';
import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';
import type { ActiveModelInfo, PredictionResponse } from '@/types';

export function PredictionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeModel, setActiveModel] = useState<ActiveModelInfo | null>(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [noModelError, setNoModelError] = useState<string | null>(null);

  const [mode, setMode] = useState<'manual' | 'file'>('file');
  const [showManualModal, setShowManualModal] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState<Record<string, string>>({});

  // Load the project's active model on mount
  useEffect(() => {
    if (!id) return;
    setLoadingModel(true);
    predictionService
      .getActiveModel(id)
      .then((info) => {
        setActiveModel(info);
        setNoModelError(null);
      })
      .catch((err: Error) => {
        const msg: string = err.message || '';
        if (msg.includes('NO_ACTIVE_MODEL') || msg.includes('Aucun modèle actif')) {
          setNoModelError(
            'Aucun modèle actif pour ce projet. Entraînez un modèle puis cliquez sur « Sauvegarder » pour l\'activer.',
          );
        } else {
          setNoModelError(msg || 'Impossible de charger le modèle actif.');
        }
      })
      .finally(() => setLoadingModel(false));
  }, [id]);

  const updateManualField = (field: string, value: string) => {
    setManualData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePredict = async () => {
    if (!id || !activeModel) return;
    setIsPredicting(true);
    try {
      let result: PredictionResponse;
      if (mode === 'file') {
        if (!file) {
          toast({ title: 'Veuillez sélectionner un fichier', variant: 'destructive' });
          return;
        }
        result = await predictionService.predictWithFile(id, file);
      } else {
        const rows = [
          Object.fromEntries(
            Object.entries(manualData).map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)]),
          ),
        ];
        result = await predictionService.predictManual(id, rows);
      }
      // Store result in sessionStorage for the results page
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
    activeModel !== null &&
    (mode === 'file' ? file !== null : Object.keys(manualData).length > 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prédiction</h1>
            <p className="text-muted-foreground mt-1">
              Utilisez votre modèle entraîné pour faire des prédictions
            </p>
          </div>
          <Badge variant="secondary" className="self-start">
            <Target className="h-3 w-3 mr-1" /> Inférence
          </Badge>
        </div>

        {/* Active model banner */}
        {loadingModel ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Chargement du modèle actif…</span>
            </CardContent>
          </Card>
        ) : noModelError ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Aucun modèle actif</p>
                <p className="text-sm text-muted-foreground mt-1">{noModelError}</p>
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm mt-1"
                  onClick={() => navigate(`/projects/${id}/training`)}
                >
                  Aller vers l'entraînement →
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : activeModel ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold capitalize">{activeModel.modelType}</p>
                  <Badge variant="default" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Modèle actif
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {activeModel.taskType}
                  </Badge>
                  {activeModel.threshold !== 0.5 && (
                    <Badge variant="secondary" className="text-xs">
                      seuil {activeModel.threshold.toFixed(2)}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {activeModel.featureNames.length} feature(s) attendues ·{' '}
                  entraîné le {new Date(activeModel.trainedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className={`cursor-pointer transition-all ${
              mode === 'manual' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
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
            <CardContent>
              <Button
                variant={mode === 'manual' ? 'default' : 'outline'}
                className="w-full"
                disabled={!activeModel}
                onClick={(e) => {
                  e.stopPropagation();
                  setMode('manual');
                  setShowManualModal(true);
                }}
              >
                Remplir les champs
              </Button>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              mode === 'file' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
            }`}
            onClick={() => setMode('file')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-secondary" />
                Import de fichier
              </CardTitle>
              <CardDescription>Chargez un fichier CSV/JSON/Parquet</CardDescription>
            </CardHeader>
            <CardContent>
              {mode === 'file' ? (
                <FileUpload onUpload={(f) => setFile(f)} />
              ) : (
                <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                  Sélectionnez ce mode
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Predict Button */}
        <Button
          size="lg"
          className="w-full h-14 text-lg bg-gradient-to-r from-primary to-secondary shadow-glow"
          onClick={handlePredict}
          disabled={!canPredict}
        >
          {isPredicting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Prédiction en cours…
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Prédire le diagnostic
            </>
          )}
        </Button>
      </div>

      {/* Manual Input Modal — columns driven by the active model's feature_names */}
      <Modal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        title="Saisie des données patient"
        size="lg"
      >
        {activeModel && activeModel.featureNames.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {activeModel.featureNames.map((col) => (
                <div key={col} className="space-y-1">
                  <Label htmlFor={col} className="capitalize">
                    {col}
                  </Label>
                  <Input
                    id={col}
                    value={manualData[col] ?? ''}
                    onChange={(e) => updateManualField(col, e.target.value)}
                    placeholder={`Entrez ${col}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowManualModal(false)}>
                Annuler
              </Button>
              <Button onClick={() => setShowManualModal(false)}>Valider</Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            Impossible de charger les colonnes du modèle actif.
          </p>
        )}
      </Modal>
    </AppLayout>
  );
}

export default PredictionPage;
