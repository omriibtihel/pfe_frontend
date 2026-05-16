import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/layouts/AppLayout';
import { trainingService } from '@/services/trainingService';
import type { ModelResult, TrainingSession } from '@/types';
import { generateTrainingReportPdf } from '@/utils/trainingReportPdf';
import { selectBestModel } from '@/utils/metricUtils';

function getDownloadErrorMessage(
  format: ReportDownloadFormat,
  error: unknown,
  t: (key: string) => string,
): string {
  const fallback =
    format === 'pdf'
      ? t('trainingResults.page.pdfErrDefault')
      : t('trainingResults.page.jsonErrDefault');
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
  const { t } = useTranslation();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedModelIds, setSavedModelIds] = useState<Set<string>>(new Set());
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [savingModelIds, setSavingModelIds] = useState<Set<string>>(new Set());
  const [preferredReportFormat, setPreferredReportFormat] =
    useState<ReportDownloadFormat>('json');
  const [downloadingFormat, setDownloadingFormat] = useState<ReportDownloadFormat | null>(null);
  const [silentPollFailed, setSilentPollFailed] = useState(false);

  const sessionId = useMemo(() => String(searchParams.get('session') || '').trim(), [searchParams]);

  const loadSession = useCallback(
    async (silent = false) => {
      if (!projectId || !sessionId) {
        setSession(null);
        setError(t('trainingResults.page.errInvalidParams'));
        setIsLoading(false);
        return;
      }

      try {
        if (!silent) setIsLoading(true);
        const data = await trainingService.getSession(String(projectId), sessionId);
        setSession(data);
        setError(null);
        setSilentPollFailed(false);
        setSavedModelIds(new Set(data.results.filter((r) => r.isSaved).map((r) => r.id)));
        setActiveModelId(data.activeModelId ?? null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : t('trainingResults.page.errLoad');
        setError(message);
        if (silent) {
          setSilentPollFailed(true);
        } else {
          toast({ title: t('trainingResults.page.toastErrTitle'), description: message, variant: 'destructive' });
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [projectId, sessionId, toast, t],
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

  const handleSaveModel = useCallback(
    async (modelId: string) => {
      if (!session || !projectId) return;
      if (!modelId || savingModelIds.has(modelId)) return;

      const isCurrentlySaved = savedModelIds.has(modelId);
      setSavingModelIds((previous) => new Set(previous).add(modelId));
      setSavedModelIds((previous) => {
        const next = new Set(previous);
        if (isCurrentlySaved) next.delete(modelId);
        else next.add(modelId);
        return next;
      });

      try {
        if (isCurrentlySaved) {
          await trainingService.unsaveModel(String(projectId), session.id, modelId);
          if (activeModelId === modelId) setActiveModelId(null);
          toast({
            title: t('trainingResults.page.toastModelRemovedTitle'),
            description: t('trainingResults.page.toastModelRemovedDesc'),
          });
        } else {
          const response = await trainingService.saveModel(
            String(projectId),
            session.id,
            modelId,
          );
          const resolvedId = response.modelId != null ? String(response.modelId) : modelId;
          if (resolvedId !== modelId) {
            setSavedModelIds((previous) => {
              const next = new Set(previous);
              next.delete(modelId);
              next.add(resolvedId);
              return next;
            });
          }
          if (response.isNowActive) setActiveModelId(resolvedId);
          else if (!activeModelId) setActiveModelId(resolvedId);
          toast({
            title: t('trainingResults.page.toastModelSavedTitle'),
            description: t('trainingResults.page.toastModelSavedDesc'),
          });
        }
      } catch (err: unknown) {
        setSavedModelIds((previous) => {
          const next = new Set(previous);
          if (isCurrentlySaved) next.add(modelId);
          else next.delete(modelId);
          return next;
        });

        toast({
          title: t('trainingResults.page.toastErrTitle'),
          description:
            err instanceof Error ? err.message : t('trainingResults.page.errSaveModel'),
          variant: 'destructive',
        });
      } finally {
        setSavingModelIds((previous) => {
          const next = new Set(previous);
          next.delete(modelId);
          return next;
        });
      }
    },
    [session, projectId, savedModelIds, savingModelIds, activeModelId, toast, t],
  );

  const handleDownloadReport = useCallback(
    async (format: ReportDownloadFormat) => {
      if (!session || !projectId || downloadingFormat) return;

      setPreferredReportFormat(format);
      setDownloadingFormat(format);

      try {
        if (format === 'pdf') {
          if (!session.results.length) {
            throw new Error(t('trainingResults.page.pdfNoResult'));
          }

          await waitForNextPaint();
          await generateTrainingReportPdf(session, String(projectId));
        } else {
          await trainingService.downloadResultsAndSaveToDisk(String(projectId), session.id);
        }
      } catch (err: unknown) {
        toast({
          title: format === 'pdf' ? t('trainingResults.page.pdfErrTitle') : t('trainingResults.page.jsonErrTitle'),
          description: getDownloadErrorMessage(format, err, t),
          variant: 'destructive',
        });
      } finally {
        setDownloadingFormat(null);
      }
    },
    [downloadingFormat, projectId, session, toast, t],
  );

  const { bestModel, hasMixedMetrics } = useMemo(() => {
    if (!session?.results?.length) return { bestModel: null, hasMixedMetrics: false };
    const result = selectBestModel(session.results, session.config?.metrics?.[0]);
    return {
      bestModel: result ?? null,
      hasMixedMetrics: result === null,
    };
  }, [session]);

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
        <main className="py-8" aria-label={t('trainingResults.page.ariaLoadError')}>
          <Card className="border-destructive/30">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{t('trainingResults.page.sessionNotFound')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error ?? t('trainingResults.page.sessionNotFoundDefault')}
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
  const isRegression = session.config?.taskType === 'regression';

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
                          ? t('trainingResults.page.stateQueued')
                          : t('trainingResults.page.stateRunning')}
                      </p>
                      {session.currentModel ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {t('trainingResults.page.currentModelLabel')}{' '}
                          <span className="font-medium text-primary">{session.currentModel}</span>
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {session.status}
                    </Badge>
                    {silentPollFailed && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              data-testid="silent-poll-failed"
                              className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
                              aria-label={t('trainingResults.page.silentPollFailedAria')}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            {t('trainingResults.page.silentPollFailedTip')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  <Progress
                    value={progressValue}
                    className="h-2"
                    aria-label={t('trainingResults.page.progressAria', { pct: Math.round(progressValue) })}
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
                    <p className="font-medium text-destructive">{t('trainingResults.page.failedTitle')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {session.errorMessage || t('trainingResults.page.failedDefault')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}

          {hasMixedMetrics ? (
            <motion.div variants={staggerItem}>
              <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-950/20" role="alert">
                <CardContent className="flex items-start gap-3 py-4">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      {t('trainingResults.page.mixedMetricsTitle')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('trainingResults.page.mixedMetricsDesc')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}

          {hasResults ? (
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
                {t('trainingResults.page.detailsHeading')}
              </h2>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {session.results.map((result, index) => (
                  <ModelResultCard
                    key={result.id || `${result.modelType}-${index}`}
                    result={result}
                    index={index}
                    isBestModel={result === bestModel}
                    sessionId={sessionId}
                    projectId={String(projectId)}
                    selectedMetrics={session.config?.metrics}
                    isActive={result.id === activeModelId}
                    isSaved={savedModelIds.has(result.id)}
                    isSaving={savingModelIds.has(result.id)}
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
                    {t('trainingResults.page.noResults')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('trainingResults.page.noResultsHint')}
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
