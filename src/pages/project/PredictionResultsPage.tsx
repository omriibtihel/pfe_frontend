import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, Target } from 'lucide-react';

import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { BatchPredictionResults, SinglePredictionResult } from '@/components/prediction/predictionResults';
import { useToast } from '@/hooks/use-toast';
import type { PredictionResponse } from '@/types';
import { withDemoPrefix } from '@/demo/paths';

/**
 * Detect single-prediction (manual form) mode: the manual flow stores
 * 'manual' in sessionStorage and produces a single row.
 */
function _isSingleMode(result: PredictionResponse): boolean {
  return result.nRows === 1 && sessionStorage.getItem('lastPredictionFile') === 'manual';
}

export function PredictionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const appPath = (path: string) => withDemoPrefix(path, location.pathname);

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    setParseError(false);
    const raw = sessionStorage.getItem('lastPrediction');
    if (raw) {
      try {
        setResult(JSON.parse(raw) as PredictionResponse);
      } catch (e) {
        console.error('[PredictionResultsPage] Failed to parse prediction response:', e);
        toast({
          title: t('predictionResults.toastLoadErrTitle'),
          description: t('predictionResults.toastLoadErrDesc'),
          variant: 'destructive',
        });
        setParseError(true);
      }
    }
    setIsLoading(false);
    // toast is stable from the hook; running once on mount is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{t('predictionResults.loading')}</p>
        </div>
      </AppLayout>
    );
  }

  if (parseError) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-5 pt-16" data-testid="prediction-parse-error">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">{t('predictionResults.parseErrorTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('predictionResults.parseErrorDesc')}
            </p>
          </div>
          <Button onClick={() => navigate(appPath(`/projects/${id}/predict`))}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('predictionResults.newPrediction')}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!result || !id) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-5 pt-16" data-testid="prediction-empty">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Target className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">{t('predictionResults.emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('predictionResults.emptyDesc')}
            </p>
          </div>
          <Button onClick={() => navigate(appPath(`/projects/${id}/predict`))}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('predictionResults.back')}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (_isSingleMode(result)) {
    return <SinglePredictionResult result={result} projectId={id} />;
  }

  return <BatchPredictionResults result={result} projectId={id} />;
}

export default PredictionResultsPage;
