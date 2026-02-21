
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Save, Download, BarChart3, Star, Loader2, AlertTriangle } from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { trainingService } from '@/services/trainingService';
import type { DetailedClassificationMetrics, ModelResult, TrainingSession } from '@/types';
import { staggerContainer, staggerItem } from '@/components/ui/page-transition';

const modelColors: Record<string, string> = {
  lightgbm: 'from-blue-500 to-blue-600',
  xgboost: 'from-purple-500 to-purple-600',
  randomforest: 'from-green-500 to-green-600',
  svm: 'from-teal-500 to-teal-600',
  knn: 'from-orange-500 to-orange-600',
  decisiontree: 'from-red-500 to-red-600',
  logisticregression: 'from-cyan-500 to-cyan-600',
  logreg: 'from-cyan-500 to-cyan-600',
  naivebayes: 'from-pink-500 to-pink-600',
};

const metricLabels: Record<string, string> = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1',
  roc_auc: 'ROC AUC',
  pr_auc: 'PR AUC',
  r2: 'R2',
  rmse: 'RMSE',
  mae: 'MAE',
};

type ClassificationType = 'binary' | 'multiclass' | 'multilabel' | 'unknown';

type FeatureImportanceChartRow = {
  feature: string;
  label: string;
  rawImportance: number;
  normalizedImportance: number;
};

type AverageRow = {
  key: 'macro' | 'weighted' | 'micro';
  label: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
};

type PerClassRow = {
  label: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  support: number | null;
};

type ConfusionPayload = {
  labels: string[];
  matrix: number[][];
};

type ClassificationView = {
  classificationType: ClassificationType;
  positiveLabel: string | null;
  accuracy: number | null;
  rocAuc: number | null;
  prAuc: number | null;
  precisionMain: number | null;
  recallMain: number | null;
  f1Main: number | null;
  balancedAccuracy: number | null;
  specificity: number | null;
  averages: AverageRow[];
  perClass: PerClassRow[];
  confusion: ConfusionPayload;
  warnings: string[];
};

function toPercent(value?: number | null): string {
  if (!Number.isFinite(value)) return '-';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function toNumber(value?: number | null): string {
  if (!Number.isFinite(value)) return '-';
  return Number(value).toFixed(3);
}

function toSeconds(value?: number | null): string {
  if (!Number.isFinite(value)) return '-';
  return `${Number(value).toFixed(1)}s`;
}

function clampPercent(value?: number | null): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v * 100));
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toUniqueWarnings(values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

function truncateFeatureLabel(value: string, max = 24): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function buildFeatureImportanceChartData(result: ModelResult, topN = 8): FeatureImportanceChartRow[] {
  const source = Array.isArray(result.featureImportance) ? result.featureImportance : [];
  const cleaned = source
    .map((item) => ({
      feature: String(item?.feature ?? '').trim(),
      rawImportance: Number(item?.importance),
    }))
    .filter((item) => item.feature && Number.isFinite(item.rawImportance))
    .sort((a, b) => b.rawImportance - a.rawImportance)
    .slice(0, topN);

  const maxImportance = cleaned.reduce((max, item) => Math.max(max, Math.abs(item.rawImportance)), 0);

  return cleaned.map((item) => ({
    feature: item.feature,
    label: truncateFeatureLabel(item.feature),
    rawImportance: item.rawImportance,
    normalizedImportance: maxImportance > 0 ? Math.abs(item.rawImportance) / maxImportance : 0,
  }));
}

function getPreprocessingSummary(result: ModelResult): string {
  const p = (result.preprocessing ?? {}) as Record<string, unknown>;
  const defaults = (p.defaults ?? {}) as Record<string, unknown>;
  const effectiveByColumn = (p.effectiveByColumn ?? {}) as Record<string, unknown>;
  const droppedColumns = Array.isArray(p.droppedColumns) ? p.droppedColumns : [];

  if (Object.keys(defaults).length || Object.keys(effectiveByColumn).length || droppedColumns.length) {
    const parts: string[] = [];
    if (Object.keys(defaults).length) {
      parts.push(
        `Defaults: numImp=${String(defaults.numericImputation ?? '-')}, numScale=${String(defaults.numericScaling ?? '-')}, catImp=${String(defaults.categoricalImputation ?? '-')}, catEnc=${String(defaults.categoricalEncoding ?? '-')}`
      );
    }
    if (Object.keys(effectiveByColumn).length) parts.push(`effectiveByColumn: ${Object.keys(effectiveByColumn).length}`);
    if (droppedColumns.length) parts.push(`dropped: ${droppedColumns.length}`);
    return parts.join(' | ');
  }

  const selected = (p.selectedMethods ?? {}) as Record<string, unknown>;
  const legacy = (selected.legacy ?? {}) as Record<string, unknown>;
  const imputation = ((legacy.imputation ?? selected.imputation) ?? {}) as Record<string, unknown>;
  const encoding = ((legacy.encoding ?? selected.encoding) ?? {}) as Record<string, unknown>;
  const scaling = ((legacy.scaling ?? selected.scaling) ?? {}) as Record<string, unknown>;

  const parts: string[] = [];

  const numImp = String(selected.numericImputation ?? imputation.numeric ?? '').trim();
  const catImp = String(selected.categoricalImputation ?? imputation.categorical ?? '').trim();
  const catEnc = String(selected.categoricalEncoding ?? encoding.categorical ?? '').trim();
  const numScaling = String(selected.numericScaling ?? scaling.numeric ?? '').trim();

  if (numImp) parts.push(`Imp(num): ${numImp}`);
  if (catImp) parts.push(`Imp(cat): ${catImp}`);
  if (catEnc) parts.push(`Enc(cat): ${catEnc}`);
  if (numScaling) parts.push(`Norm(num): ${numScaling}`);

  return parts.join(' | ');
}

function getDetailedMetrics(result: ModelResult): DetailedClassificationMetrics {
  const candidate = result.metricsDetailed;
  if (!candidate || typeof candidate !== 'object') return {};
  return candidate;
}

function getClassificationType(result: ModelResult): ClassificationType {
  const detailed = getDetailedMetrics(result);
  const rawType = String(detailed?.meta?.classification_type ?? '').trim().toLowerCase();
  if (rawType === 'binary' || rawType === 'multiclass' || rawType === 'multilabel') return rawType;

  const hasPos = Number.isFinite(Number(result.metrics?.precision_pos)) || Number.isFinite(Number(result.metrics?.recall_pos));
  if (hasPos) return 'binary';

  const cm = Array.isArray(result.confusionMatrix) ? result.confusionMatrix : [];
  if (cm.length === 2 && Array.isArray(cm[0]) && cm[0].length === 2) return 'binary';
  if (cm.length > 2) return 'multiclass';
  return 'unknown';
}
function buildConfusionPayload(result: ModelResult, detailed: DetailedClassificationMetrics): ConfusionPayload {
  const rawPayload = detailed?.confusion_matrix;
  const rawMatrix = Array.isArray(rawPayload?.matrix) ? rawPayload?.matrix : Array.isArray(result.confusionMatrix) ? result.confusionMatrix : [];

  const matrix = rawMatrix
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }));

  const rawLabels = Array.isArray(rawPayload?.labels) ? rawPayload.labels : [];
  const labels = (rawLabels.length === matrix.length ? rawLabels : matrix.map((_, idx) => idx)).map((v) => String(v));

  return { labels, matrix };
}

function buildAveragesRows(result: ModelResult, detailed: DetailedClassificationMetrics): AverageRow[] {
  const macro = detailed?.averaged?.macro ?? {};
  const weighted = detailed?.averaged?.weighted ?? {};
  const micro = detailed?.averaged?.micro ?? {};

  const rows: AverageRow[] = [
    {
      key: 'macro',
      label: 'Macro',
      precision: toFiniteNumber((macro as any)?.precision ?? result.metrics?.precision_macro),
      recall: toFiniteNumber((macro as any)?.recall ?? result.metrics?.recall_macro),
      f1: toFiniteNumber((macro as any)?.f1 ?? result.metrics?.f1_macro),
    },
    {
      key: 'weighted',
      label: 'Weighted',
      precision: toFiniteNumber((weighted as any)?.precision ?? result.metrics?.precision_weighted),
      recall: toFiniteNumber((weighted as any)?.recall ?? result.metrics?.recall_weighted),
      f1: toFiniteNumber((weighted as any)?.f1 ?? result.metrics?.f1_weighted),
    },
    {
      key: 'micro',
      label: 'Micro',
      precision: toFiniteNumber((micro as any)?.precision ?? result.metrics?.precision_micro),
      recall: toFiniteNumber((micro as any)?.recall ?? result.metrics?.recall_micro),
      f1: toFiniteNumber((micro as any)?.f1 ?? result.metrics?.f1_micro),
    },
  ];

  return rows.filter((row) => row.precision !== null || row.recall !== null || row.f1 !== null);
}

function buildPerClassRows(detailed: DetailedClassificationMetrics): PerClassRow[] {
  const source = detailed?.per_class;
  if (!source || typeof source !== 'object') return [];

  return Object.entries(source)
    .map(([label, raw]) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        label,
        precision: toFiniteNumber(row.precision),
        recall: toFiniteNumber(row.recall),
        f1: toFiniteNumber(row.f1),
        support: toFiniteNumber(row.support),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildClassificationView(result: ModelResult): ClassificationView {
  const detailed = getDetailedMetrics(result);
  const global = (detailed?.global ?? {}) as Record<string, unknown>;
  const binary = (detailed?.binary ?? {}) as Record<string, unknown>;
  const classificationType = getClassificationType(result);

  const precisionPos = toFiniteNumber(binary.precision_pos ?? result.metrics?.precision_pos);
  const recallPos = toFiniteNumber(binary.recall_pos ?? result.metrics?.recall_pos);
  const f1Pos = toFiniteNumber(binary.f1_pos ?? result.metrics?.f1_pos);

  const macroPrecision = toFiniteNumber((detailed?.averaged?.macro as any)?.precision ?? result.metrics?.precision_macro ?? result.metrics?.precision);
  const macroRecall = toFiniteNumber((detailed?.averaged?.macro as any)?.recall ?? result.metrics?.recall_macro ?? result.metrics?.recall);
  const macroF1 = toFiniteNumber((detailed?.averaged?.macro as any)?.f1 ?? result.metrics?.f1_macro ?? result.metrics?.f1);

  const isBinary = classificationType === 'binary';

  const warnings = toUniqueWarnings([
    ...((Array.isArray(result.metricsWarnings) ? result.metricsWarnings : []) as unknown[]),
    ...((Array.isArray(detailed?.warnings) ? detailed.warnings : []) as unknown[]),
  ]);

  const positiveRaw = binary.positive_label ?? detailed?.meta?.positive_label;

  return {
    classificationType,
    positiveLabel: positiveRaw == null ? null : String(positiveRaw),
    accuracy: toFiniteNumber(global.accuracy ?? result.metrics?.accuracy),
    rocAuc: toFiniteNumber(global.roc_auc ?? result.metrics?.roc_auc),
    prAuc: toFiniteNumber(global.pr_auc ?? result.metrics?.pr_auc),
    precisionMain: isBinary ? precisionPos : macroPrecision,
    recallMain: isBinary ? recallPos : macroRecall,
    f1Main: isBinary ? f1Pos : macroF1,
    balancedAccuracy: toFiniteNumber(global.balanced_accuracy ?? result.metrics?.balanced_accuracy),
    specificity: toFiniteNumber(global.specificity ?? result.metrics?.specificity),
    averages: buildAveragesRows(result, detailed),
    perClass: buildPerClassRows(detailed),
    confusion: buildConfusionPayload(result, detailed),
    warnings,
  };
}

export function TrainingResultsPage() {
  const params = useParams();
  const projectId = params.projectId ?? params.id;
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const timer = window.setInterval(() => {
      loadSession(true);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [session, loadSession]);

  const handleSaveModel = async (modelId: string) => {
    if (!session || !projectId) return;
    try {
      await trainingService.saveModel(String(projectId), session.id, modelId);
      toast({ title: 'Modele enregistre', description: 'Le modele a ete sauvegarde avec succes' });
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
  const hasBinaryResult = !isRegression && session.results.some((result) => buildClassificationView(result).classificationType === 'binary');
  const progressValue = Number(session.progress ?? 0);
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
                  <p className="font-medium">Entrainement en cours...</p>
                  <Badge variant="secondary" className="ml-auto">{session.status}</Badge>
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
            {session.results.map((result, index) => {
              const color = modelColors[result.modelType] ?? 'from-slate-500 to-slate-600';
              const featureChartData = buildFeatureImportanceChartData(result);
              const classView = isRegression ? null : buildClassificationView(result);
              const isBinary = classView?.classificationType === 'binary';
              const aucMissing = !isRegression && classView?.rocAuc == null;

              const metricCards = isRegression
                ? [
                    { key: 'r2', label: metricLabels.r2, value: toNumber(result.metrics?.r2) },
                    { key: 'rmse', label: metricLabels.rmse, value: toNumber(result.metrics?.rmse) },
                    { key: 'mae', label: metricLabels.mae, value: toNumber(result.metrics?.mae) },
                  ]
                : [
                    { key: 'accuracy', label: metricLabels.accuracy, value: toPercent(classView?.accuracy) },
                    { key: 'roc_auc', label: metricLabels.roc_auc, value: toPercent(classView?.rocAuc) },
                    { key: 'pr_auc', label: metricLabels.pr_auc, value: toPercent(classView?.prAuc) },
                    {
                      key: 'precision_main',
                      label: isBinary ? `Precision (+${classView?.positiveLabel ?? ''})` : 'Precision (macro)',
                      value: toPercent(classView?.precisionMain),
                    },
                    {
                      key: 'recall_main',
                      label: isBinary ? `Recall (+${classView?.positiveLabel ?? ''})` : 'Recall (macro)',
                      value: toPercent(classView?.recallMain),
                    },
                    {
                      key: 'f1_main',
                      label: isBinary ? `F1 (+${classView?.positiveLabel ?? ''})` : 'F1 (macro)',
                      value: toPercent(classView?.f1Main),
                    },
                  ];

              return (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <Card className="overflow-hidden h-full">
                    <div className={`h-2 bg-gradient-to-r ${color}`} />
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          {result.modelType.toUpperCase()}
                          {result === bestModel && <Badge className="bg-warning text-warning-foreground">Meilleur</Badge>}
                          {!isRegression && classView?.classificationType && classView.classificationType !== 'unknown' && (
                            <Badge variant="outline">{classView.classificationType}</Badge>
                          )}
                          {aucMissing && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              AUC indisponible
                            </Badge>
                          )}
                        </CardTitle>
                        <Badge variant="outline">{toSeconds(result.trainingTime)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {metricCards.map((metric) => (
                          <div key={metric.key} className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold text-primary">{metric.value}</p>
                            <p className="text-xs text-muted-foreground">{metric.label}</p>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Train: {toPercent(result.trainScore)}</span>
                          <span>Test: {toPercent(result.testScore)}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                          <div className="bg-primary h-full" style={{ width: `${clampPercent(result.trainScore)}%` }} />
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden flex mt-1">
                          <div className="bg-secondary h-full" style={{ width: `${clampPercent(result.testScore)}%` }} />
                        </div>
                      </div>
                      {!isRegression && classView && (
                        <Tabs defaultValue="summary" className="space-y-4">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="averages">Averages</TabsTrigger>
                            <TabsTrigger value="per_class">Per-class</TabsTrigger>
                          </TabsList>

                          <TabsContent value="summary" className="space-y-4">
                            {!!classView.warnings.length && (
                              <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 text-xs text-amber-900">
                                <p className="font-medium mb-1">Warnings</p>
                                <ul className="space-y-1">
                                  {classView.warnings.map((warning, idx) => (
                                    <li key={`${result.id}-w-${idx}`}>- {warning}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {(classView.balancedAccuracy != null || classView.specificity != null) && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-border/60 p-3">
                                  <p className="text-xs text-muted-foreground">Balanced Accuracy</p>
                                  <p className="text-sm font-semibold">{toPercent(classView.balancedAccuracy)}</p>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                  <p className="text-xs text-muted-foreground">Specificity (TNR)</p>
                                  <p className="text-sm font-semibold">{toPercent(classView.specificity)}</p>
                                </div>
                              </div>
                            )}

                            {!!classView.confusion.matrix.length && (
                              <div>
                                <p className="text-sm font-medium mb-2">Matrice de confusion</p>
                                <div className="overflow-x-auto rounded-lg border border-border/60">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/60">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">True \\ Pred</th>
                                        {classView.confusion.labels.map((label) => (
                                          <th key={`${result.id}-cm-h-${label}`} className="px-3 py-2 text-left font-medium">{label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {classView.confusion.matrix.map((row, rowIndex) => (
                                        <tr key={`${result.id}-cm-r-${rowIndex}`} className="border-t border-border/60">
                                          <td className="px-3 py-2 font-medium">{classView.confusion.labels[rowIndex] ?? rowIndex}</td>
                                          {row.map((value, colIndex) => (
                                            <td key={`${result.id}-cm-c-${rowIndex}-${colIndex}`} className="px-3 py-2">
                                              {value}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="averages">
                            {!!classView.averages.length ? (
                              <div className="overflow-x-auto rounded-lg border border-border/60">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/60">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Average</th>
                                      <th className="px-3 py-2 text-left font-medium">Precision</th>
                                      <th className="px-3 py-2 text-left font-medium">Recall</th>
                                      <th className="px-3 py-2 text-left font-medium">F1</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {classView.averages.map((row) => (
                                      <tr key={`${result.id}-avg-${row.key}`} className="border-t border-border/60">
                                        <td className="px-3 py-2 font-medium">{row.label}</td>
                                        <td className="px-3 py-2">{toPercent(row.precision)}</td>
                                        <td className="px-3 py-2">{toPercent(row.recall)}</td>
                                        <td className="px-3 py-2">{toPercent(row.f1)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Aucune metrique average disponible.</p>
                            )}
                          </TabsContent>

                          <TabsContent value="per_class">
                            {!!classView.perClass.length ? (
                              <div className="overflow-x-auto rounded-lg border border-border/60">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/60">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Classe</th>
                                      <th className="px-3 py-2 text-left font-medium">Precision</th>
                                      <th className="px-3 py-2 text-left font-medium">Recall</th>
                                      <th className="px-3 py-2 text-left font-medium">F1</th>
                                      <th className="px-3 py-2 text-left font-medium">Support</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {classView.perClass.map((row) => (
                                      <tr key={`${result.id}-pc-${row.label}`} className="border-t border-border/60">
                                        <td className="px-3 py-2 font-medium">{row.label}</td>
                                        <td className="px-3 py-2">{toPercent(row.precision)}</td>
                                        <td className="px-3 py-2">{toPercent(row.recall)}</td>
                                        <td className="px-3 py-2">{toPercent(row.f1)}</td>
                                        <td className="px-3 py-2">{row.support != null ? Math.round(row.support) : '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Aucune metrique par classe disponible.</p>
                            )}
                          </TabsContent>
                        </Tabs>
                      )}

                      {!!featureChartData.length && (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-medium">Importance des features</p>
                            <span className="text-xs text-muted-foreground">Top {featureChartData.length}</span>
                          </div>
                          <div className="h-56 rounded-lg border border-border/50 bg-muted/20 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsBarChart
                                data={featureChartData}
                                layout="vertical"
                                margin={{ top: 6, right: 8, left: 8, bottom: 6 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis
                                  type="number"
                                  domain={[0, 1]}
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="label"
                                  width={120}
                                  tick={{ fontSize: 11 }}
                                />
                                <Tooltip
                                  formatter={(value, _name, item) => [
                                    Number(
                                      (item as { payload?: { rawImportance?: number } } | undefined)?.payload
                                        ?.rawImportance ?? value
                                    ).toFixed(4),
                                    'Importance',
                                  ]}
                                  labelFormatter={(_label, payload) =>
                                    String(
                                      (
                                        Array.isArray(payload)
                                          ? (payload[0] as { payload?: { feature?: string } } | undefined)
                                          : undefined
                                      )?.payload?.feature ?? ''
                                    )
                                  }
                                />
                                <Bar dataKey="normalizedImportance" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                              </RechartsBarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 text-xs text-muted-foreground">
                        {result.splitInfo && (
                          <p>
                            Split: {result.splitInfo.method || 'holdout'} | train {result.splitInfo.train_rows ?? 0} |
                            val {result.splitInfo.val_rows ?? 0} | test {result.splitInfo.test_rows ?? 0}
                          </p>
                        )}
                        {!!result.preprocessing && <p>Preprocessing: {getPreprocessingSummary(result)}</p>}
                        {Array.isArray((result.preprocessing as any)?.droppedColumns) &&
                          (result.preprocessing as any).droppedColumns.length > 0 && (
                            <p>Dropped columns: {(result.preprocessing as any).droppedColumns.join(', ')}</p>
                          )}
                        {!!result.smote && <p>SMOTE: {JSON.stringify(result.smote)}</p>}
                        {!!(result.preprocessing as any)?.effectiveByColumn && (
                          <details>
                            <summary className="cursor-pointer">effectiveByColumn</summary>
                            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                              {JSON.stringify((result.preprocessing as any).effectiveByColumn, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>

                      <Button className="w-full" onClick={() => handleSaveModel(result.id)}>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer ce modele
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
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
