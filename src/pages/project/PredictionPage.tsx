import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Target, FileUp, FormInput, Play, Settings2, Loader2, Database } from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FileUpload } from '@/components/ui/file-upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';

const mockColumns = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal'];

export function PredictionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'manual' | 'file'>('manual');
  const [showManualModal, setShowManualModal] = useState(false);
  const [applyPreprocessing, setApplyPreprocessing] = useState(true);
  const [isPredicting, setIsPredicting] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState<Record<string, string>>({});

  const handlePredict = async () => {
    setIsPredicting(true);
    try {
      const input = {
        mode,
        data: mode === 'manual' ? [manualData] : file!,
        applyPreprocessing,
        versionId: selectedVersion,
      };
      const session = await predictionService.predict(id!, '1', input);
      toast({ title: 'Prédiction terminée' });
      navigate(`/projects/${id}/predict/results?session=${session.id}`);
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setIsPredicting(false);
    }
  };

  const updateManualField = (field: string, value: string) => {
    setManualData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prédiction</h1>
            <p className="text-muted-foreground mt-1">Utilisez votre modèle pour faire des prédictions</p>
          </div>
          <Badge variant="secondary" className="self-start">
            <Target className="h-3 w-3 mr-1" /> Diagnostic
          </Badge>
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className={`cursor-pointer transition-all ${mode === 'manual' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'}`}
            onClick={() => setMode('manual')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FormInput className="h-5 w-5 text-primary" />
                Saisie manuelle
              </CardTitle>
              <CardDescription>Entrez les données patient une par une</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant={mode === 'manual' ? 'default' : 'outline'} 
                className="w-full"
                onClick={(e) => { e.stopPropagation(); setShowManualModal(true); }}
              >
                Cliquez pour remplir
              </Button>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${mode === 'file' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'}`}
            onClick={() => setMode('file')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-secondary" />
                Import de fichier
              </CardTitle>
              <CardDescription>Chargez un fichier avec plusieurs patients</CardDescription>
            </CardHeader>
            <CardContent>
              {mode === 'file' && (
                <FileUpload onUpload={(f) => setFile(f)} />
              )}
              {mode !== 'file' && (
                <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                  Sélectionnez ce mode
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Version Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-accent" />
              Version des données
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une version enregistrée" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">Normalized v1 - 15/01/2024</SelectItem>
                <SelectItem value="v2">Cleaned v1 - 12/01/2024</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Preprocessing Toggle */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Appliquer le prétraitement</p>
                <p className="text-sm text-muted-foreground">Utiliser le même pipeline de nettoyage</p>
              </div>
            </div>
            <Switch checked={applyPreprocessing} onCheckedChange={setApplyPreprocessing} />
          </CardContent>
        </Card>

        {/* Predict Button */}
        <Button 
          size="lg" 
          className="w-full h-14 text-lg bg-gradient-to-r from-primary to-secondary shadow-glow" 
          onClick={handlePredict}
          disabled={isPredicting || (mode === 'manual' && Object.keys(manualData).length === 0) || (mode === 'file' && !file)}
        >
          {isPredicting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Prédiction en cours...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Prédire le diagnostic
            </>
          )}
        </Button>
      </div>

      {/* Manual Input Modal */}
      <Modal 
        isOpen={showManualModal} 
        onClose={() => setShowManualModal(false)} 
        title="Saisie des données patient"
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {mockColumns.map((col) => (
            <div key={col} className="space-y-1">
              <Label htmlFor={col} className="capitalize">{col}</Label>
              <Input 
                id={col} 
                value={manualData[col] || ''} 
                onChange={(e) => updateManualField(col, e.target.value)}
                placeholder={`Entrez ${col}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setShowManualModal(false)}>Annuler</Button>
          <Button onClick={() => setShowManualModal(false)}>Valider</Button>
        </div>
      </Modal>
    </AppLayout>
  );
}

export default PredictionPage;
