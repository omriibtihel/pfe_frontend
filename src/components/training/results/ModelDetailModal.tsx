import { useEffect, useRef, useState } from 'react';
import { BarChart2, Info, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CurvesData, ExplainabilityData, ModelResult, ModelResultDetail } from '@/types';
import { trainingService } from '@/services/trainingService';
import { ModelCardAnalyseTab } from './ModelCardAnalyseTab';
import { ModelCardVariablesTab, ModelCardCourbesTab } from './ModelCardVariablesTab';
import { buildClassificationView, toSeconds } from './trainingResultsHelpers';

interface ModelDetailModalProps {
  result: ModelResult;
  sessionId: string;
  projectId: string;
  isRegression: boolean;
  open: boolean;
  onClose: () => void;
}

type TabId = 'analyse' | 'variables' | 'courbes' | 'details';

export function ModelDetailModal({
  result,
  sessionId,
  projectId,
  isRegression,
  open,
  onClose,
}: ModelDetailModalProps) {
  const [detail, setDetail] = useState<ModelResultDetail | null>(null);
  const [explainability, setExplainability] = useState<ExplainabilityData | null>(null);
  const [curves, setCurves] = useState<CurvesData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [loadingCurves, setLoadingCurves] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [errorExplain, setErrorExplain] = useState<string | null>(null);
  const [errorCurves, setErrorCurves] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('analyse');
  const [retryExplain, setRetryExplain] = useState(0);
  const [retryCurves, setRetryCurves] = useState(0);

  const fetchedExplain = useRef(false);
  const fetchedCurves = useRef(false);

  useEffect(() => {
    if (!open) return;
    setLoadingDetail(true);
    setErrorDetail(null);
    trainingService
      .getModelDetails(projectId, sessionId, result.id)
      .then(setDetail)
      .catch((err: unknown) =>
        setErrorDetail(err instanceof Error ? err.message : 'Erreur de chargement des détails.'),
      )
      .finally(() => setLoadingDetail(false));
  }, [open, projectId, sessionId, result.id]);

  useEffect(() => {
    if (activeTab !== 'variables') return;
    if (fetchedExplain.current) return;
    setLoadingExplain(true);
    trainingService
      .getModelExplainability(projectId, sessionId, result.id)
      .then((data) => {
        fetchedExplain.current = true;
        setExplainability(data);
      })
      .catch((err) => {
        setErrorExplain(err?.message ?? "Erreur de chargement de l'explicabilité");
      })
      .finally(() => setLoadingExplain(false));
  }, [activeTab, projectId, sessionId, result.id, retryExplain]);

  useEffect(() => {
    if (activeTab !== 'courbes') return;
    if (fetchedCurves.current) return;
    setLoadingCurves(true);
    trainingService
      .getModelCurves(projectId, sessionId, result.id)
      .then((data) => {
        fetchedCurves.current = true;
        setCurves(data);
      })
      .catch((err) => {
        setErrorCurves(err?.message ?? "Erreur de chargement des courbes");
      })
      .finally(() => setLoadingCurves(false));
  }, [activeTab, projectId, sessionId, result.id, retryCurves]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabId);
  };

  const classView = detail && !isRegression ? buildClassificationView(detail) : null;

  const hasAnalyse =
    detail &&
    ((!isRegression && classView !== null) ||
      (isRegression && detail.analysis.residualAnalysis != null) ||
      (detail.isCV && detail.analysis.crossValidation != null) ||
      detail.analysis.gridSearch?.enabled === true);

  const hasVariables =
    explainability &&
    (explainability.featureImportance.length > 0 ||
      (explainability.permutationImportance?.length ?? 0) > 0 ||
      explainability.shapGlobal != null ||
      (explainability.artifactWarnings?.length ?? 0) > 0);

  const hasCourbes =
    curves &&
    (curves.roc != null ||
      curves.pr != null ||
      curves.calibration != null ||
      curves.multiclassRoc != null ||
      curves.multiclassPr != null ||
      curves.learningCurves != null ||
      (curves.artifactWarnings?.length ?? 0) > 0);

  const hasDetails =
    detail && (detail.automl != null || detail.preprocessing != null || detail.balancing != null);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="2xl"
      icon={<BarChart2 className="h-5 w-5" />}
      title={
        <span className="flex items-center gap-2">
          {result.modelType.toUpperCase()}
          <Badge variant="outline" className="text-[11px] font-normal">
            {toSeconds(result.trainingTime)}
          </Badge>
        </span>
      }
    >
      {loadingDetail && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement des détails...</span>
        </div>
      )}

      {errorDetail && (
        <p className="py-6 text-center text-sm text-destructive">{errorDetail}</p>
      )}

      {detail && !loadingDetail && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="analyse" className="text-xs">Analyse</TabsTrigger>
            <TabsTrigger value="variables" className="text-xs">Variables</TabsTrigger>
            <TabsTrigger value="courbes" className="text-xs">Courbes</TabsTrigger>
            <TabsTrigger value="details" className="text-xs">Détails</TabsTrigger>
          </TabsList>

          <TabsContent value="analyse" className="mt-0">
            {hasAnalyse ? (
              <ModelCardAnalyseTab
                result={detail}
                isRegression={isRegression}
                classView={classView}
              />
            ) : (
              <EmptyTabState label="Aucune analyse disponible." />
            )}
          </TabsContent>

          <TabsContent value="variables" className="mt-0">
            {errorExplain ? (
              <div className="flex flex-col items-center gap-2 p-4 text-sm text-red-600">
                <p>{errorExplain}</p>
                <button
                  className="text-xs underline"
                  onClick={() => {
                    setErrorExplain(null);
                    fetchedExplain.current = false;
                    setRetryExplain((n) => n + 1);
                  }}
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                {loadingExplain && <LoadingState label="Chargement des variables..." />}
                {!loadingExplain && explainability && hasVariables ? (
                  <ModelCardVariablesTab explainability={explainability} />
                ) : (
                  !loadingExplain && <EmptyTabState label="Aucune donnée d'importance disponible." />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="courbes" className="mt-0">
            {errorCurves ? (
              <div className="flex flex-col items-center gap-2 p-4 text-sm text-red-600">
                <p>{errorCurves}</p>
                <button
                  className="text-xs underline"
                  onClick={() => {
                    setErrorCurves(null);
                    fetchedCurves.current = false;
                    setRetryCurves((n) => n + 1);
                  }}
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                {loadingCurves && <LoadingState label="Chargement des courbes..." />}
                {!loadingCurves && curves && hasCourbes ? (
                  <ModelCardCourbesTab curves={curves} />
                ) : (
                  !loadingCurves && (
                    <EmptyTabState
                      label={
                        result.evaluationSource?.type === 'loo'
                          ? "Pas de courbes : la stratégie Leave-One-Out ne génère pas de jeu de test indépendant."
                          : result.isCV && !result.hasHoldoutTest
                            ? "Pas de courbes : aucun jeu de test mis de côté (testRatio = 0). Augmente le testRatio pour les générer."
                            : "Aucune courbe disponible."
                      }
                    />
                  )
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-0">
            {hasDetails ? (
              <ModelCardDetailsSection detail={detail} />
            ) : (
              <EmptyTabState label="Aucun détail technique disponible." />
            )}
          </TabsContent>
        </Tabs>
      )}
    </Modal>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyTabState({ label }: { label: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>
  );
}

function ModelCardDetailsSection({ detail }: { detail: ModelResultDetail }) {
  return (
    <div className="space-y-4 text-sm">
      {detail.automl && (
        <section>
          <p className="mb-2 text-xs font-semibold text-foreground">AutoML — FLAML</p>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Meilleur modèle trouvé</span>
            <span className="font-medium text-foreground">{detail.automl.bestEstimator ?? '—'}</span>
            <span>Itérations explorées</span>
            <span className="font-medium text-foreground">{detail.automl.nIterations ?? '—'}</span>
            <span>Temps total</span>
            <span className="font-medium text-foreground">
              {detail.automl.totalTimeS != null ? `${detail.automl.totalTimeS.toFixed(1)}s` : '—'}
              {detail.automl.timeBudgetS != null ? ` / ${detail.automl.timeBudgetS}s budget` : ''}
            </span>
            <span>Métrique optimisée</span>
            <span className="font-medium text-foreground">{detail.automl.metricOptimized ?? '—'}</span>
          </div>
        </section>
      )}

      {detail.automl && <AutoMLPreprocessingSection preprocessing={detail.preprocessing} />}

      {detail.splitInfo && (
        <section>
          <p className="mb-1 text-xs font-semibold text-foreground">Split</p>
          <p className="text-xs text-muted-foreground">
            {detail.splitInfo.method ?? 'holdout'} · train {detail.splitInfo.trainRows ?? 0} · val{' '}
            {detail.splitInfo.valRows ?? 0} · test {detail.splitInfo.testRows ?? 0}
          </p>
        </section>
      )}

      {detail.balancing && (
        <section>
          <p className="mb-1 text-xs font-semibold text-foreground">Balancing</p>
          <p className="text-xs text-muted-foreground">
            Stratégie : {detail.balancing.strategyApplied ?? '—'} · Refit :{' '}
            {detail.balancing.refitMetric ?? '—'}
            {detail.balancing.imbalanceRatio != null &&
              ` · IR : ${Number(detail.balancing.imbalanceRatio).toFixed(2)}`}
          </p>
        </section>
      )}

      {detail.analysis.thresholding?.enabled && (
        <section>
          <p className="mb-1 text-xs font-semibold text-foreground">Seuil de décision</p>
          <p className="text-xs text-muted-foreground">
            Stratégie : {detail.analysis.thresholding.strategy ?? '—'} · Seuil optimal :{' '}
            {detail.analysis.thresholding.optimalThreshold?.toFixed(3) ?? '—'}
            {detail.analysis.thresholding.improvementDelta != null && (
              <span
                className={
                  (detail.analysis.thresholding.improvementDelta ?? 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }
              >
                {' '}· Gain F1 :{' '}
                {(detail.analysis.thresholding.improvementDelta ?? 0) > 0 ? '+' : ''}
                {((detail.analysis.thresholding.improvementDelta ?? 0) * 100).toFixed(1)}%
              </span>
            )}
          </p>
        </section>
      )}
    </div>
  );
}

type AutoMLPreprocessingStep = {
  step?: string;
  method?: string;
  columns?: string[];
};

type AutoMLPreprocessingBlock = {
  mode?: string;
  note?: string;
  steps?: AutoMLPreprocessingStep[];
  imbalanceHandling?: {
    applied?: boolean;
    method?: string;
    imbalanceRatio?: number | null;
  };
  smote?: { applied?: boolean; trigger?: string };
  crossValidation?: { evalMethod?: string; nSplits?: number };
};

function formatImbalanceHandling(
  imb: AutoMLPreprocessingBlock['imbalanceHandling'],
  smote: AutoMLPreprocessingBlock['smote'],
): string {
  const ir = imb?.imbalanceRatio;
  const irLabel = ir != null ? `IR ${Number(ir).toFixed(2)}` : null;

  const actions: string[] = [];
  if (smote?.applied) actions.push('SMOTE');
  if (imb?.applied) actions.push('sample_weight=balanced');

  if (actions.length > 0) {
    return [actions.join(' + '), irLabel].filter(Boolean).join(' · ');
  }
  if (ir != null && ir > 1.2) {
    return `Aucune action appliquée · ${irLabel}`;
  }
  return irLabel
    ? `Aucun déséquilibre significatif (${irLabel})`
    : 'Aucun déséquilibre significatif';
}

function AutoMLPreprocessingSection({
  preprocessing,
}: {
  preprocessing: ModelResultDetail['preprocessing'];
}) {
  const block = preprocessing as AutoMLPreprocessingBlock | null | undefined;
  if (!block || block.mode !== 'automl') return null;

  const {
    steps = [],
    imbalanceHandling: imb,
    smote,
    crossValidation: cv,
    note,
  } = block;

  return (
    <section>
      <p className="mb-2 text-xs font-semibold text-foreground">
        Préparation automatique
      </p>

      {note && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-yellow-400/40 bg-yellow-50 p-2 text-xs text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-900/20 dark:text-yellow-100">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{note}</p>
        </div>
      )}

      {steps.length > 0 && (
        <ul className="mb-2 space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
          {steps.map((s, idx) => (
            <li key={idx} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground">{s.step}</span>
              <span>—</span>
              <span>{s.method}</span>
              {s.columns && s.columns.length > 0 && (
                <span className="opacity-70">({s.columns.length} colonne{s.columns.length > 1 ? 's' : ''})</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        {(imb || smote) && (
          <>
            <span>Gestion du déséquilibre</span>
            <span className="font-medium text-foreground">
              {formatImbalanceHandling(imb, smote)}
            </span>
          </>
        )}
        {cv && (
          <>
            <span>Validation croisée interne</span>
            <span className="font-medium text-foreground">
              {cv.evalMethod ?? '—'} · {cv.nSplits ?? '—'} folds
            </span>
          </>
        )}
      </div>
    </section>
  );
}
