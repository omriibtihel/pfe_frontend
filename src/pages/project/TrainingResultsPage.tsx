import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ModelResultCard } from '@/components/training/results/ModelResultCard';
import { ModelsComparisonTable } from '@/components/training/results/ModelsComparisonTable';
import { ResultsOverview } from '@/components/training/results/ResultsOverview';
import {
  TrainingResultsHeader,
  type ReportDownloadFormat,
} from '@/components/training/results/TrainingResultsHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { Progress } from '@/components/ui/progress';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/layouts/AppLayout';
import { trainingService } from '@/services/trainingService';
import type { ModelResult, TrainingSession } from '@/types';
import { generateTrainingReportPdf } from '@/utils/trainingReportPdf';

type NormalizableModelResult = ModelResult & {
  modelId?: unknown;
  model_id?: unknown;
  is_saved?: unknown;
  is_active?: unknown;
};

type NormalizableTrainingSession = TrainingSession & {
  activeModelId?: unknown;
  active_model_id?: unknown;
};

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSessionResult(result: ModelResult, index: number): ModelResult {
  const source = result as NormalizableModelResult;
  const id = normalizeId(source.id ?? source.modelId ?? source.model_id);
  const fallbackId = normalizeId(result.modelType) || `model-${index + 1}`;
  return {
    ...result,
    id: id || fallbackId,
    isSaved: Boolean(source.isSaved ?? source.is_saved),
    isActive: Boolean(source.isActive ?? source.is_active),
  };
}

function normalizeSession(data: TrainingSession): TrainingSession {
  const source = data as NormalizableTrainingSession;
  const activeModelId = normalizeId(source.activeModelId ?? source.active_model_id) || null;

  return {
    ...data,
    activeModelId,
    results: (data.results ?? []).map((result, index) => normalizeSessionResult(result, index)),
  };
}

function getSavedIdsFromSession(data: TrainingSession): Set<string> {
  return new Set(
    (data.results ?? [])
      .filter((result) => Boolean(result.isSaved))
      .map((result) => normalizeId(result.id))
      .filter(Boolean),
  );
}

function getActiveIdFromSession(data: TrainingSession): string | null {
  const explicitActiveId = normalizeId((data as NormalizableTrainingSession).activeModelId);
  if (explicitActiveId) return explicitActiveId;

  const activeResult = (data.results ?? []).find((result) =>
    Boolean((result as NormalizableModelResult).isActive ?? (result as NormalizableModelResult).is_active),
  );
  if (!activeResult) return null;

  return normalizeId(activeResult.id);
}

function toComparableScore(value: unknown): number {
  const score = Number(value);
  return Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY;
}

function getDownloadErrorMessage(format: ReportDownloadFormat, error: unknown): string {
  const fallback =
    format === 'pdf'
      ? 'Impossible de générer le rapport PDF.'
      : 'Impossible de télécharger le rapport JSON.';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.trim() || fallback;
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function TrainingResultsPage() {
  const params = useParams();
  const projectId = params.projectId ?? params.id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedModelIds, setSavedModelIds] = useState<Set<string>>(new Set());
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [savingModelIds, setSavingModelIds] = useState<Set<string>>(new Set());
  const [preferredReportFormat, setPreferredReportFormat] =
    useState<ReportDownloadFormat>('json');
  const [downloadingFormat, setDownloadingFormat] = useState<ReportDownloadFormat | null>(null);

  const sessionId = useMemo(() => String(searchParams.get('session') || '').trim(), [searchParams]);

  const loadSession = useCallback(
    async (silent = false) => {
      if (!projectId || !sessionId) {
        setSession(null);
        setError('Paramètres invalides : projectId ou session manquant.');
        setIsLoading(false);
        return;
      }

      try {
        if (!silent) setIsLoading(true);
        const raw = await trainingService.getSession(String(projectId), sessionId);
        const data = normalizeSession(raw);
        setSession(data);
        setError(null);
        setSavedModelIds(getSavedIdsFromSession(data));
        setActiveModelId(getActiveIdFromSession(data));
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Impossible de charger les résultats d'entraînement.";
        setError(message);
        if (!silent) {
          toast({ title: 'Erreur', description: message, variant: 'destructive' });
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [projectId, sessionId, toast],
  );

  useEffect(() => {
    loadSession(false);
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    if (session.status !== 'queued' && session.status !== 'running') return;

    const timer = window.setInterval(() => {
      void loadSession(true);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [session, loadSession]);

  const handleSaveModel = async (modelId: string) => {
    if (!session || !projectId) return;
    const normalizedModelId = normalizeId(modelId);
    if (!normalizedModelId || savingModelIds.has(normalizedModelId)) return;

    const isCurrentlySaved = savedModelIds.has(normalizedModelId);
    setSavingModelIds((previous) => {
      const next = new Set(previous);
      next.add(normalizedModelId);
      return next;
    });
    setSavedModelIds((previous) => {
      const next = new Set(previous);
      if (isCurrentlySaved) next.delete(normalizedModelId);
      else next.add(normalizedModelId);
      return next;
    });

    try {
      if (isCurrentlySaved) {
        await trainingService.unsaveModel(String(projectId), session.id, normalizedModelId);
        if (activeModelId === normalizedModelId) setActiveModelId(null);
        toast({
          title: 'Modèle retiré',
          description: 'Le modèle a été retiré des modèles sauvegardés.',
        });
      } else {
        const response = await trainingService.saveModel(
          String(projectId),
          session.id,
          normalizedModelId,
        );
        const resolvedModelId = normalizeId(response.modelId ?? normalizedModelId);
        if (response.isNowActive) setActiveModelId(resolvedModelId || normalizedModelId);
        else if (!activeModelId) setActiveModelId(resolvedModelId || normalizedModelId);
        toast({
          title: 'Modèle sauvegardé',
          description: 'Ce modèle est maintenant disponible pour les prédictions.',
        });
      }
    } catch (err: unknown) {
      setSavedModelIds((previous) => {
        const next = new Set(previous);
        if (isCurrentlySaved) next.add(normalizedModelId);
        else next.delete(normalizedModelId);
        return next;
      });

      toast({
        title: 'Erreur',
        description:
          err instanceof Error ? err.message : "Échec de l'enregistrement du modèle.",
        variant: 'destructive',
      });
    } finally {
      setSavingModelIds((previous) => {
        const next = new Set(previous);
        next.delete(normalizedModelId);
        return next;
      });
    }
  };

  const handleDownloadReport = useCallback(
    async (format: ReportDownloadFormat) => {
      if (!session || !projectId || downloadingFormat) return;

      setPreferredReportFormat(format);
      setDownloadingFormat(format);

      try {
        if (format === 'pdf') {
          if (!session.results.length) {
            throw new Error("Le PDF est disponible dès qu'au moins un résultat est généré.");
          }

          await waitForNextPaint();
          generateTrainingReportPdf(session);
        } else {
          await trainingService.downloadResultsAndSaveToDisk(String(projectId), session.id);
        }
      } catch (err: unknown) {
        toast({
          title: format === 'pdf' ? 'Export PDF impossible' : 'Export JSON impossible',
          description: getDownloadErrorMessage(format, err),
          variant: 'destructive',
        });
      } finally {
        setDownloadingFormat(null);
      }
    },
    [downloadingFormat, projectId, session, toast],
  );

  const bestModel = useMemo<ModelResult | null>(() => {
    if (!session?.results?.length) return null;
    return session.results.reduce((best, current) =>
      toComparableScore(current.testScore) > toComparableScore(best.testScore) ? current : best,
    );
  }, [session]);

  const isRegression = session?.config?.taskType === 'regression';

  if (isLoading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <main className="py-8" aria-label="Erreur de chargement">
          <Card className="border-destructive/30">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">Session introuvable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error ?? 'Session introuvable.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </AppLayout>
    );
  }

  const progressValue = Math.max(0, Math.min(100, Number(session.progress ?? 0)));
  const isRunning = session.status === 'queued' || session.status === 'running';
  const hasResults = session.results.length > 0;

  return (
    <AppLayout>
      <main>
        <motion.div
          className="space-y-8"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <TrainingResultsHeader
              session={session}
              preferredFormat={preferredReportFormat}
              downloadingFormat={downloadingFormat}
              canDownloadPdf={hasResults}
              onDownload={handleDownloadReport}
              onBack={() => navigate(-1)}
            />
          </motion.div>

          {isRunning ? (
            <motion.div variants={staggerItem} aria-live="polite" aria-atomic="true">
              <Card className="border-primary/20">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center gap-3">
                    <Loader2
                      className="h-5 w-5 shrink-0 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {session.status === 'queued'
                          ? 'En attente de démarrage...'
                          : 'Entraînement en cours...'}
                      </p>
                      {session.currentModel ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Modèle en cours&nbsp;:{' '}
                          <span className="font-medium text-primary">{session.currentModel}</span>
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {session.status}
                    </Badge>
                  </div>

                  <Progress
                    value={progressValue}
                    className="h-2"
                    aria-label={`Progression de l'entraînement : ${Math.round(progressValue)}%`}
                  />

                  <p className="text-right text-xs text-muted-foreground" aria-hidden="true">
                    {Math.round(progressValue)}%
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}

          {session.status === 'failed' ? (
            <motion.div variants={staggerItem}>
              <Card className="border-destructive/30" role="alert">
                <CardContent className="flex items-start gap-3 py-4">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium text-destructive">Échec de l'entraînement</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {session.errorMessage || 'Consultez les logs backend pour plus de détails.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}

          {bestModel ? (
            <motion.div variants={staggerItem}>
              <ResultsOverview
                session={session}
                bestModel={bestModel}
                savedModelIds={savedModelIds}
                onSaveModel={handleSaveModel}
              />
            </motion.div>
          ) : null}

          {hasResults ? (
            <motion.div variants={staggerItem}>
              <ModelsComparisonTable
                session={session}
                bestModel={bestModel}
                isRegression={isRegression ?? false}
              />
            </motion.div>
          ) : null}

          {hasResults ? (
            <motion.section variants={staggerItem} aria-labelledby="model-details-heading">
              <h2 id="model-details-heading" className="mb-4 text-lg font-semibold">
                Détails par modèle
              </h2>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {session.results.map((result, index) => (
                  <ModelResultCard
                    key={normalizeId(result.id) || `${result.modelType}-${index}`}
                    result={result}
                    index={index}
                    isBestModel={result === bestModel}
                    isRegression={isRegression ?? false}
                    isActive={normalizeId(result.id) === activeModelId}
                    isSaved={savedModelIds.has(normalizeId(result.id))}
                    isSaving={savingModelIds.has(normalizeId(result.id))}
                    defaultExpanded={false}
                    onSaveModel={handleSaveModel}
                  />
                ))}
              </div>
            </motion.section>
          ) : null}

          {!hasResults && session.status !== 'failed' ? (
            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="py-8 text-center" aria-live="polite">
                  <Loader2
                    className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground/40"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-muted-foreground">
                    Aucun résultat disponible pour l'instant.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cette page se met à jour automatiquement dès qu'un modèle termine.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </motion.div>
      </main>
    </AppLayout>
  );
}

export default TrainingResultsPage;
