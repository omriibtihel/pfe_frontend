
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Download, BarChart3, Star, Loader2, AlertTriangle } from 'lucide-react';

import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { trainingService } from '@/services/trainingService';
import type { ModelResult, TrainingSession } from '@/types';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';
import { ModelResultCard } from '@/components/training/results/ModelResultCard';
import {
  buildClassificationView,
  toPercent,
  toNumber,
  toSeconds,
} from '@/components/training/results/trainingResultsHelpers';

export function TrainingResultsPage() {
  const params = useParams();
  const projectId = params.projectId ?? params.id;
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const sessionId = useMemo(() => String(searchParams.get('session') || '').trim(), [searchParams]);

  const loadSession = useCallback(async (silent = false) => {
    if (!projectId || !sessionId) {
      setSession(null);
      setError('Parametres invalides: projectId/session manquant.');
      setIsLoading(false);
      return;
    }

    try {
      if (!silent) setIsLoading(true);
      const data = await trainingService.getSession(String(projectId), sessionId);
      setSession(data);
      setError(null);
    } catch (e: any) {
      const msg = String(e?.message || "Impossible de charger les resultats d'entrainement.");
      setError(msg);
      if (!silent) {
        toast({ title: 'Erreur', description: msg, variant: 'destructive' });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [projectId, sessionId, toast]);

  useEffect(() => {
    loadSession(false);
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    if (session.status !== 'queued' && session.status !== 'running') return;

    const timer = window.setInterval(() => { loadSession(true); }, 1500);
    return () => window.clearInterval(timer);
  }, [session, loadSession]);

  const handleSaveModel = async (modelId: string) => {
    if (!session || !projectId) return;
    try {
      await trainingService.saveModel(String(projectId), session.id, modelId);
      setActiveModelId(modelId);
      toast({ title: 'Modèle activé', description: 'Ce modèle est maintenant le modèle actif du projet.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: String(e?.message || "Echec de l'enregistrement du modele"),
        variant: 'destructive',
      });
    }
  };

  const handleDownloadReport = async () => {
    if (!session || !projectId) return;
    try {
      await trainingService.downloadResultsAndSaveToDisk(String(projectId), session.id);
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: String(e?.message || 'Impossible de telecharger le rapport'),
        variant: 'destructive',
      });
    }
  };

  const bestModel = useMemo<ModelResult | null>(() => {
    if (!session?.results?.length) return null;
    return session.results.reduce((best, current) => (current.testScore > best.testScore ? current : best));
  }, [session]);

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;

  if (!session) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto py-8">
          <Card className="border-destructive/30">
            <CardContent className="py-6 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">Aucune session chargee</p>
                <p className="text-sm text-muted-foreground mt-1">{error ?? 'Session introuvable.'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const isRegression = session.config?.taskType === 'regression';
  const hasBinaryResult = !isRegression && session.results.some(
    (result) => buildClassificationView(result).classificationType === 'binary'
  );
  const progressValue = Number(session.progress ?? 0);

  return (
    <AppLayout>
      <motion.div className="space-y-6" initial="initial" animate="animate" variants={staggerContainer}>
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Resultats d'entrainement</h1>
            <p className="text-muted-foreground mt-1">Analysez les performances de vos modeles</p>
            <p className="text-xs text-muted-foreground mt-1">
              Session #{session.id} | Statut: <span className="font-medium">{session.status ?? 'unknown'}</span>
            </p>
          </div>
          <Button variant="outline" onClick={handleDownloadReport}>
            <Download className="h-4 w-4 mr-2" />
            Telecharger le rapport
          </Button>
        </motion.div>

        {(session.status === 'queued' || session.status === 'running') && (
          <motion.div variants={staggerItem}>
            <Card className="border-primary/20">
              <CardContent className="py-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {session.status === 'queued' ? 'En attente de démarrage...' : 'Entraînement en cours...'}
                    </p>
                    {session.currentModel && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Modèle actuel&nbsp;: <span className="font-medium text-primary">{session.currentModel}</span>
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{session.status}</Badge>
                </div>
                <Progress value={Math.max(0, Math.min(100, progressValue))} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{Math.round(Math.max(0, Math.min(100, progressValue)))}%</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {session.status === 'failed' && (
          <motion.div variants={staggerItem}>
            <Card className="border-destructive/30">
              <CardContent className="py-5">
                <p className="font-medium text-destructive">Echec de l'entrainement</p>
                <p className="text-sm text-muted-foreground mt-1">{session.errorMessage || 'Consultez les logs backend.'}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {bestModel && (
          <motion.div variants={staggerItem}>
            <Card className="bg-gradient-to-r from-warning/10 via-warning/5 to-transparent border-warning/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Meilleur modele: {bestModel.modelType.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    Score test: {toPercent(bestModel.testScore)}
                    {bestModel.primaryMetric ? ` (${bestModel.primaryMetric})` : ''}
                  </p>
                </div>
                <Button onClick={() => handleSaveModel(bestModel.id)} className="bg-warning text-warning-foreground hover:bg-warning/90">
                  <Star className="h-4 w-4 mr-2" />
                  Selectionner
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!!session.results.length && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {session.results.map((result, index) => (
              <ModelResultCard
                key={result.id}
                result={result}
                index={index}
                isBestModel={result === bestModel}
                isRegression={isRegression}
                isActive={result.id === activeModelId}
                onSaveModel={handleSaveModel}
              />
            ))}
          </div>
        )}

        {!session.results.length && session.status !== 'failed' && (
          <motion.div variants={staggerItem}>
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">
                  Aucun resultat disponible pour l'instant. Cette page se met a jour automatiquement.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!!session.results.length && (
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
                        <th className="px-4 py-3 text-left font-medium">Modele</th>
                        <th className="px-4 py-3 text-left font-medium">{isRegression ? 'R2' : 'Accuracy'}</th>
                        <th className="px-4 py-3 text-left font-medium">{isRegression ? 'RMSE' : hasBinaryResult ? 'Precision (+)' : 'Precision (macro)'}</th>
                        <th className="px-4 py-3 text-left font-medium">{isRegression ? 'MAE' : hasBinaryResult ? 'Recall (+)' : 'Recall (macro)'}</th>
                        <th className="px-4 py-3 text-left font-medium">{hasBinaryResult ? 'F1 (+)' : 'F1 (macro)'}</th>
                        <th className="px-4 py-3 text-left font-medium">ROC AUC</th>
                        <th className="px-4 py-3 text-left font-medium">Temps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.results.map((result) => {
                        const classView = isRegression ? null : buildClassificationView(result);
                        return (
                          <tr key={result.id} className="border-t border-border">
                            <td className="px-4 py-3 font-medium">{result.modelType.toUpperCase()}</td>
                            <td className="px-4 py-3">{isRegression ? toNumber(result.metrics.r2) : toPercent(classView?.accuracy)}</td>
                            <td className="px-4 py-3">{isRegression ? toNumber(result.metrics.rmse) : toPercent(classView?.precisionMain)}</td>
                            <td className="px-4 py-3">{isRegression ? toNumber(result.metrics.mae) : toPercent(classView?.recallMain)}</td>
                            <td className="px-4 py-3">{isRegression ? '-' : toPercent(classView?.f1Main)}</td>
                            <td className="px-4 py-3">{isRegression ? '-' : toPercent(classView?.rocAuc)}</td>
                            <td className="px-4 py-3">{toSeconds(result.trainingTime)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
  );
}

export default TrainingResultsPage;
