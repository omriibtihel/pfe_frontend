import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Save, Download, BarChart3, Star } from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { trainingService } from '@/services/trainingService';
import { TrainingSession, ModelResult } from '@/types';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';

const modelColors: Record<string, string> = {
  lightgbm: 'from-blue-500 to-blue-600',
  xgboost: 'from-purple-500 to-purple-600',
  randomforest: 'from-green-500 to-green-600',
  svm: 'from-teal-500 to-teal-600',
  knn: 'from-orange-500 to-orange-600',
  decisiontree: 'from-red-500 to-red-600',
};

export function TrainingResultsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const sessionId = searchParams.get('session') || '1';
      try {
        const data = await trainingService.getSession(sessionId);
        setSession(data);
      } catch (error) {
        // Create mock session for demo
        const mockSession: TrainingSession = {
          id: '1',
          projectId: id!,
          config: { targetColumn: 'target', taskType: 'classification', models: ['randomforest', 'xgboost'], useGridSearch: false, useSmote: false, splitMethod: 'holdout', trainRatio: 70, valRatio: 15, testRatio: 15, metrics: ['accuracy', 'f1'] },
          results: [
            { id: '1', modelType: 'randomforest', status: 'completed', metrics: { accuracy: 0.945, precision: 0.938, recall: 0.952, f1: 0.945, roc_auc: 0.978, mse: 0, rmse: 0, mae: 0, r2: 0 }, trainScore: 0.982, testScore: 0.945, featureImportance: [{ feature: 'age', importance: 0.23 }, { feature: 'thalach', importance: 0.19 }, { feature: 'cp', importance: 0.15 }], confusionMatrix: [[125, 8], [9, 118]], trainingTime: 3.2 },
            { id: '2', modelType: 'xgboost', status: 'completed', metrics: { accuracy: 0.932, precision: 0.925, recall: 0.940, f1: 0.932, roc_auc: 0.968, mse: 0, rmse: 0, mae: 0, r2: 0 }, trainScore: 0.975, testScore: 0.932, featureImportance: [{ feature: 'thalach', importance: 0.25 }, { feature: 'age', importance: 0.18 }, { feature: 'oldpeak', importance: 0.14 }], confusionMatrix: [[122, 11], [7, 120]], trainingTime: 4.1 },
          ],
          createdAt: new Date().toISOString(),
        };
        setSession(mockSession);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [id, searchParams]);

  const handleSaveModel = async (modelId: string) => {
    await trainingService.saveModel(session!.id, modelId);
    toast({ title: 'Modèle enregistré', description: 'Le modèle a été sauvegardé avec succès' });
  };

  const getBestModel = (): ModelResult | null => {
    if (!session) return null;
    return session.results.reduce((best, current) => 
      current.metrics.accuracy > best.metrics.accuracy ? current : best
    );
  };

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
  if (!session) return <AppLayout><div>Aucune session</div></AppLayout>;

  const bestModel = getBestModel();

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
            <h1 className="text-3xl font-bold text-foreground">Résultats d'entraînement</h1>
            <p className="text-muted-foreground mt-1">Analysez les performances de vos modèles</p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Télécharger le rapport
          </Button>
        </motion.div>

        {/* Best Model Highlight */}
        {bestModel && (
          <motion.div variants={staggerItem}>
            <Card className="bg-gradient-to-r from-warning/10 via-warning/5 to-transparent border-warning/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Meilleur modèle: {bestModel.modelType.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">Accuracy: {(bestModel.metrics.accuracy * 100).toFixed(1)}%</p>
                </div>
                <Button onClick={() => handleSaveModel(bestModel.id)} className="bg-warning text-warning-foreground hover:bg-warning/90">
                  <Star className="h-4 w-4 mr-2" />
                  Sélectionner
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Model Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {session.results.map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <Card className="overflow-hidden h-full">
                <div className={`h-2 bg-gradient-to-r ${modelColors[result.modelType]}`} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {result.modelType.toUpperCase()}
                      {result === bestModel && <Badge className="bg-warning text-warning-foreground">Meilleur</Badge>}
                    </CardTitle>
                    <Badge variant="outline">{result.trainingTime.toFixed(1)}s</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    {(['accuracy', 'precision', 'recall'] as const).map((metric) => (
                      <div key={metric} className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold text-primary">{(result.metrics[metric] * 100).toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground capitalize">{metric}</p>
                      </div>
                    ))}
                  </div>

                  {/* Train vs Test */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Train: {(result.trainScore * 100).toFixed(1)}%</span>
                      <span>Test: {(result.testScore * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-primary h-full" style={{ width: `${result.trainScore * 100}%` }} />
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex mt-1">
                      <div className="bg-secondary h-full" style={{ width: `${result.testScore * 100}%` }} />
                    </div>
                  </div>

                  {/* Feature Importance */}
                  <div>
                    <p className="text-sm font-medium mb-2">Importance des features</p>
                    <div className="space-y-2">
                      {result.featureImportance.slice(0, 4).map((fi) => (
                        <div key={fi.feature} className="flex items-center gap-2">
                          <span className="text-xs w-16 truncate">{fi.feature}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${modelColors[result.modelType]}`} style={{ width: `${fi.importance * 100}%` }} />
                          </div>
                          <span className="text-xs w-10 text-right">{(fi.importance * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Confusion Matrix */}
                  {result.confusionMatrix && (
                    <div>
                      <p className="text-sm font-medium mb-2">Matrice de confusion</p>
                      <div className="grid grid-cols-2 gap-1 w-32 mx-auto">
                        {result.confusionMatrix.flat().map((val, i) => (
                          <div key={i} className={`h-12 flex items-center justify-center text-sm font-medium rounded ${i === 0 || i === 3 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                            {val}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button className="w-full" onClick={() => handleSaveModel(result.id)}>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer ce modèle
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Comparison Table */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Comparaison globale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Modèle</th>
                      <th className="px-4 py-3 text-left font-medium">Accuracy</th>
                      <th className="px-4 py-3 text-left font-medium">Precision</th>
                      <th className="px-4 py-3 text-left font-medium">Recall</th>
                      <th className="px-4 py-3 text-left font-medium">F1</th>
                      <th className="px-4 py-3 text-left font-medium">ROC AUC</th>
                      <th className="px-4 py-3 text-left font-medium">Temps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.results.map((result) => (
                      <tr key={result.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{result.modelType.toUpperCase()}</td>
                        <td className="px-4 py-3">{(result.metrics.accuracy * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">{(result.metrics.precision * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">{(result.metrics.recall * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">{(result.metrics.f1 * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">{(result.metrics.roc_auc * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3">{result.trainingTime.toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}

export default TrainingResultsPage;
