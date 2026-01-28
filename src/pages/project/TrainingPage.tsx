import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Target, Settings, Sliders, BarChart3, Code, Play, Loader2 } from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { trainingService } from '@/services/trainingService';
import { ModelType, MetricType, TrainingConfig } from '@/types';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';

const models: { value: ModelType; label: string; color: string }[] = [
  { value: 'lightgbm', label: 'LightGBM', color: 'bg-primary' },
  { value: 'xgboost', label: 'XGBoost', color: 'bg-secondary' },
  { value: 'randomforest', label: 'Random Forest', color: 'bg-success' },
  { value: 'svm', label: 'SVM', color: 'bg-accent' },
  { value: 'knn', label: 'KNN', color: 'bg-warning' },
  { value: 'decisiontree', label: 'Decision Tree', color: 'bg-destructive' },
];

const metrics: { value: MetricType; label: string }[] = [
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'precision', label: 'Precision' },
  { value: 'recall', label: 'Recall' },
  { value: 'f1', label: 'F1-Score' },
  { value: 'roc_auc', label: 'ROC AUC' },
];

export function TrainingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isTraining, setIsTraining] = useState(false);
  
  const [config, setConfig] = useState<TrainingConfig>({
    targetColumn: 'target',
    taskType: 'classification',
    models: ['randomforest'],
    useGridSearch: false,
    useSmote: false,
    splitMethod: 'holdout',
    trainRatio: 70,
    valRatio: 15,
    testRatio: 15,
    kFolds: 5,
    metrics: ['accuracy', 'f1'],
    customCode: '',
  });

  const toggleModel = (model: ModelType) => {
    setConfig(prev => ({
      ...prev,
      models: prev.models.includes(model)
        ? prev.models.filter(m => m !== model)
        : [...prev.models, model]
    }));
  };

  const toggleMetric = (metric: MetricType) => {
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric]
    }));
  };

  const handleTrain = async () => {
    if (config.models.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins un modèle', variant: 'destructive' });
      return;
    }
    setIsTraining(true);
    try {
      const session = await trainingService.startTraining(id!, config);
      toast({ title: 'Entraînement terminé' });
      navigate(`/projects/${id}/training/results?session=${session.id}`);
    } catch (error) {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <AppLayout>
      <motion.div 
        className="space-y-6"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Studio d'entraînement</h1>
            <p className="text-muted-foreground mt-1">Configurez et lancez vos modèles d'IA</p>
          </div>
          <Badge variant="secondary" className="self-start">
            <Target className="h-3 w-3 mr-1" /> target
          </Badge>
        </motion.div>

        <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Variable cible</label>
                <Select value={config.targetColumn} onValueChange={(v) => setConfig({ ...config, targetColumn: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="target">target</SelectItem>
                    <SelectItem value="diagnosis">diagnosis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Type de tâche</label>
                <Select value={config.taskType} onValueChange={(v: any) => setConfig({ ...config, taskType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">Classification</SelectItem>
                    <SelectItem value="regression">Régression</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-secondary" />
                Sélection des modèles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {models.map((model) => (
                  <label
                    key={model.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      config.models.includes(model.value) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox checked={config.models.includes(model.value)} onCheckedChange={() => toggleModel(model.value)} />
                    <div className={`w-3 h-3 rounded-full ${model.color}`} />
                    <span className="font-medium text-sm">{model.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2">
                  <Checkbox checked={config.useGridSearch} onCheckedChange={(c) => setConfig({ ...config, useGridSearch: !!c })} />
                  <span className="text-sm">GridSearch</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={config.useSmote} onCheckedChange={(c) => setConfig({ ...config, useSmote: !!c })} />
                  <span className="text-sm">SMOTE</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Training Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-accent" />
                Paramètres d'entraînement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={config.splitMethod} onValueChange={(v: any) => setConfig({ ...config, splitMethod: v })}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="holdout">Train/Val/Test</TabsTrigger>
                  <TabsTrigger value="kfold">K-Fold</TabsTrigger>
                </TabsList>
                <TabsContent value="holdout" className="space-y-4 mt-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Train: {config.trainRatio}%</span>
                      <span>Val: {config.valRatio}%</span>
                      <span>Test: {config.testRatio}%</span>
                    </div>
                    <div className="h-4 rounded-full overflow-hidden flex">
                      <div className="bg-primary" style={{ width: `${config.trainRatio}%` }} />
                      <div className="bg-secondary" style={{ width: `${config.valRatio}%` }} />
                      <div className="bg-accent" style={{ width: `${config.testRatio}%` }} />
                    </div>
                  </div>
                  <Slider value={[config.trainRatio]} onValueChange={([v]) => setConfig({ ...config, trainRatio: v, valRatio: Math.floor((100 - v) / 2), testRatio: 100 - v - Math.floor((100 - v) / 2) })} max={90} min={50} step={5} />
                </TabsContent>
                <TabsContent value="kfold" className="mt-4">
                  <div>
                    <label className="text-sm font-medium">Nombre de folds: {config.kFolds}</label>
                    <Slider value={[config.kFolds || 5]} onValueChange={([v]) => setConfig({ ...config, kFolds: v })} max={10} min={2} step={1} className="mt-2" />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-success" />
                Métriques d'évaluation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {metrics.map((metric) => (
                  <Badge
                    key={metric.value}
                    variant={config.metrics.includes(metric.value) ? 'default' : 'outline'}
                    className="cursor-pointer px-4 py-2"
                    onClick={() => toggleMetric(metric.value)}
                  >
                    {metric.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Custom Code */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-warning" />
                Code personnalisé (optionnel)
              </CardTitle>
              <CardDescription>Ajoutez du code Python pour des transformations personnalisées</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="# Votre code Python ici..."
                value={config.customCode}
                onChange={(e) => setConfig({ ...config, customCode: e.target.value })}
                className="font-mono min-h-32"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Train Button */}
        <motion.div variants={staggerItem}>
          <Button size="lg" className="w-full h-14 text-lg bg-gradient-to-r from-primary via-secondary to-accent shadow-glow" onClick={handleTrain} disabled={isTraining}>
            {isTraining ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Entraînement en cours...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
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
