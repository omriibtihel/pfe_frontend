import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Target, Download, BarChart3, Activity, CheckCircle, XCircle } from 'lucide-react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';
import { PredictionSession } from '@/types';

export function PredictionResultsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [session, setSession] = useState<PredictionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionId = searchParams.get('session') || '1';
        const data = await predictionService.getSession(sessionId);
        setSession(data);
      } catch (error) {
        // Mock data
        setSession({
          id: '1',
          projectId: id!,
          modelId: '1',
          results: [
            { id: '1', sessionId: '1', prediction: 'Positif', confidence: 0.92, inputData: { age: 55, sex: 'M', cp: 'typical' } },
            { id: '2', sessionId: '1', prediction: 'Négatif', confidence: 0.87, inputData: { age: 42, sex: 'F', cp: 'atypical' } },
            { id: '3', sessionId: '1', prediction: 'Positif', confidence: 0.78, inputData: { age: 68, sex: 'M', cp: 'asymptomatic' } },
            { id: '4', sessionId: '1', prediction: 'Négatif', confidence: 0.95, inputData: { age: 35, sex: 'F', cp: 'non-anginal' } },
            { id: '5', sessionId: '1', prediction: 'Positif', confidence: 0.84, inputData: { age: 61, sex: 'M', cp: 'typical' } },
          ],
          accuracy: 0.91,
          createdAt: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [id, searchParams]);

  const handleExport = async () => {
    if (!session) return;
    const blob = await predictionService.exportResults(session.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prediction_results.json';
    a.click();
    toast({ title: 'Export réussi' });
  };

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
  if (!session) return <AppLayout><div>Aucune session</div></AppLayout>;

  const positiveCount = session.results.filter(r => r.prediction === 'Positif').length;
  const negativeCount = session.results.filter(r => r.prediction === 'Négatif').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Résultats de prédiction</h1>
            <p className="text-muted-foreground mt-1">Analyse des diagnostics prédits</p>
          </div>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter les résultats
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-3xl font-bold text-primary">{(session.accuracy! * 100).toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total prédictions</p>
              <p className="text-3xl font-bold">{session.results.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Positifs</p>
              <p className="text-3xl font-bold text-success">{positiveCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Négatifs</p>
              <p className="text-3xl font-bold text-secondary">{negativeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Distribution des prédictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end justify-center gap-12">
                <div className="flex flex-col items-center">
                  <div 
                    className="w-20 bg-gradient-to-t from-success to-success/60 rounded-t-lg transition-all"
                    style={{ height: `${(positiveCount / session.results.length) * 150}px` }}
                  />
                  <p className="mt-2 font-medium">Positif</p>
                  <p className="text-sm text-muted-foreground">{positiveCount}</p>
                </div>
                <div className="flex flex-col items-center">
                  <div 
                    className="w-20 bg-gradient-to-t from-secondary to-secondary/60 rounded-t-lg transition-all"
                    style={{ height: `${(negativeCount / session.results.length) * 150}px` }}
                  />
                  <p className="mt-2 font-medium">Négatif</p>
                  <p className="text-sm text-muted-foreground">{negativeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-secondary" />
                Confiance moyenne
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="80" cy="80" r="70" className="fill-none stroke-muted stroke-[12]" />
                    <circle 
                      cx="80" cy="80" r="70" 
                      className="fill-none stroke-primary stroke-[12]"
                      strokeDasharray={`${(session.results.reduce((sum, r) => sum + (r.confidence || 0), 0) / session.results.length) * 440} 440`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold">
                        {((session.results.reduce((sum, r) => sum + (r.confidence || 0), 0) / session.results.length) * 100).toFixed(0)}%
                      </p>
                      <p className="text-sm text-muted-foreground">Confiance</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des prédictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">Prédiction</th>
                    <th className="px-4 py-3 text-left font-medium">Confiance</th>
                    <th className="px-4 py-3 text-left font-medium">Age</th>
                    <th className="px-4 py-3 text-left font-medium">Sexe</th>
                    <th className="px-4 py-3 text-left font-medium">Type douleur</th>
                  </tr>
                </thead>
                <tbody>
                  {session.results.map((result, i) => (
                    <tr key={result.id} className="border-t border-border">
                      <td className="px-4 py-3">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Badge className={result.prediction === 'Positif' ? 'bg-success text-success-foreground' : 'bg-secondary text-secondary-foreground'}>
                          {result.prediction === 'Positif' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {result.prediction}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(result.confidence || 0) * 100}%` }} />
                          </div>
                          <span>{((result.confidence || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{result.inputData.age as number}</td>
                      <td className="px-4 py-3">{result.inputData.sex as string}</td>
                      <td className="px-4 py-3">{result.inputData.cp as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default PredictionResultsPage;
