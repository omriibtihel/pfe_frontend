import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Save, Download, BarChart3, Star, AlertCircle, RefreshCw, SlidersHorizontal } from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/components/ui/page-transition";

import trainingService, { TrainingSession, ModelResult } from "@/services/trainingService";

const modelColors: Record<string, string> = {
  lightgbm: "from-blue-500 to-blue-600",
  xgboost: "from-purple-500 to-purple-600",
  randomforest: "from-green-500 to-green-600",
  svm: "from-teal-500 to-teal-600",
  knn: "from-orange-500 to-orange-600",
  decisiontree: "from-red-500 to-red-600",
};

function pct(v: unknown) {
  const n = typeof v === "number" ? v : 0;
  return `${(n * 100).toFixed(1)}%`;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

function sec(v: unknown) {
  const n = typeof v === "number" ? v : 0;
  return `${n.toFixed(1)}s`;
}

function safeUpper(s: unknown) {
  return String(s ?? "").toUpperCase();
}

/**
 * If metric is likely a probability/score in [0..1] => pct,
 * else => num.
 */
function smartValue(v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  if (v >= 0 && v <= 1) return pct(v);
  return num(v);
}

function fmtDist(dist?: Record<string, number> | null) {
  if (!dist) return "—";
  const entries = Object.entries(dist);
  if (!entries.length) return "—";
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join("  •  ");
}

function imbalanceRatio(dist?: Record<string, number> | null) {
  if (!dist) return null;
  const vals = Object.values(dist).filter((n) => typeof n === "number" && n > 0);
  if (vals.length < 2) return null;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  if (!Number.isFinite(max) || !Number.isFinite(min) || min === 0) return null;
  return max / min;
}

/**
 * ✅ Cette page supporte 2 formats:
 * 1) Backend actuel:   TrainingSession { results: [...] }
 * 2) Format futur:     { session: TrainingSession, models: [...] }
 */
function normalizeSession(payload: any): TrainingSession | null {
  if (!payload) return null;

  if (payload.session && payload.session.id) {
    const s = payload.session as TrainingSession;
    if (Array.isArray(payload.models) && !Array.isArray((s as any).results)) {
      (s as any).results = payload.models;
    }
    return s;
  }

  if (payload.id) return payload as TrainingSession;
  return null;
}

function isBinaryLike(result: ModelResult) {
  const m: any = result.metrics || {};
  return (
    typeof m.precision_pos === "number" ||
    typeof m.recall_pos === "number" ||
    typeof m.f1_pos === "number" ||
    typeof m.pr_auc === "number"
  );
}

function scoreHigherIsBetter(metric?: string | null, taskType?: "classification" | "regression") {
  if (taskType === "regression") {
    // error metrics lower better
    if (metric && ["rmse", "mae", "mse"].includes(metric)) return false;
    return true; // r2
  }
  return true;
}

export function TrainingResultsPage() {
  const { projectId, versionId } = useParams<{ projectId: string; versionId: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const sessionId = useMemo(() => searchParams.get("session"), [searchParams]);

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSession = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    if (!projectId || !sessionId) {
      setLoadError("Paramètres manquants (projectId ou session).");
      setSession(null);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    setLoadError(null);

    try {
      const raw = await trainingService.getSession(String(projectId), String(sessionId));
      const s = normalizeSession(raw);
      setSession(s);
    } catch (error: any) {
      const msg = error?.message || "Impossible de charger la session";
      setLoadError(msg);
      setSession(null);
      if (!silent) toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sessionId]);

  useEffect(() => {
    if (!session) return;
    if (session.status !== "running") return;

    const t = setTimeout(() => fetchSession({ silent: true }), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.progress, session?.id]);

  const results: ModelResult[] = useMemo(() => {
    return (session?.results ?? []) as ModelResult[];
  }, [session]);

  const taskType = useMemo(() => {
    const t = (session as any)?.config?.taskType;
    return t === "regression" ? "regression" : "classification";
  }, [session]);

  const anyBinary = useMemo(() => results.some(isBinaryLike), [results]);

  const bestModel = useMemo(() => {
    if (!results.length) return null;

    // Prefer backend decision: testScore (already reflects primary metric)
    // If regression error metrics => lower is better (but our backend primary_score sets higher_is_better flag;
    // we don't have it here reliably, so we fallback to heuristic.)
    return results.reduce((best, cur) => {
      const scoreOf = (r: ModelResult) => {
        const ts = (r as any).testScore;
        if (typeof ts === "number" && Number.isFinite(ts)) return ts;

        const pm = (r as any).primaryMetric as string | undefined;
        const m: any = r.metrics || {};
        if (pm && typeof m[pm] === "number") return m[pm] as number;

        if (taskType === "regression") return (m.r2 ?? 0) as number;
        return (m.f1 ?? m.accuracy ?? 0) as number;
      };

      const better = (a: ModelResult, b: ModelResult) => {
        const sA = scoreOf(a);
        const sB = scoreOf(b);
        // if regression and pm is error metric -> lower better
        const pm = (a as any).primaryMetric as string | null | undefined;
        const hib = scoreHigherIsBetter(pm ?? null, taskType);
        return hib ? sA > sB : sA < sB;
      };

      return better(cur, best) ? cur : best;
    });
  }, [results, taskType]);

  const handleSaveModel = async (modelId: string) => {
    if (!projectId || !session) return;

    try {
      await trainingService.saveModel(String(projectId), String(session.id), String(modelId));
      toast({ title: "Modèle enregistré", description: "Le modèle a été sauvegardé avec succès" });
      fetchSession({ silent: true });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'enregistrer le modèle",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    if (!projectId || !sessionId) return;

    try {
      await trainingService.downloadResultsAndSaveToDisk(String(projectId), String(sessionId));
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Téléchargement impossible",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Impossible de charger les résultats</p>
                <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  URL attendue : /projects/&lt;projectId&gt;/versions/&lt;versionId&gt;/training/results?session=&lt;id&gt;
                  <br />
                  Actuel : projectId={String(projectId)} | versionId={String(versionId)} | session={String(sessionId)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="p-6">Aucune session</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div className="space-y-6" initial="initial" animate="animate" variants={staggerContainer}>
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Résultats d'entraînement</h1>
            <p className="text-muted-foreground mt-1">
              Projet #{projectId} • Version #{versionId} • Session #{session.id} • Status:{" "}
              <span className="font-medium">{session.status}</span>
              {session.status === "running" && (
                <span className="ml-2 text-xs text-muted-foreground">(progress {session.progress}%)</span>
              )}
            </p>

            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <Badge variant="outline">Task: {taskType}</Badge>
              {anyBinary && <Badge className="bg-accent text-accent-foreground">Binaire (metrics pos)</Badge>}
            </div>

            {session.status === "failed" && session.errorMessage && (
              <p className="text-sm text-destructive mt-2 whitespace-pre-line">{session.errorMessage}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchSession()} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger le rapport
            </Button>
          </div>
        </motion.div>

        {/* Best Model */}
        {bestModel && (
          <motion.div variants={staggerItem}>
            <Card className="bg-gradient-to-r from-warning/10 via-warning/5 to-transparent border-warning/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Meilleur modèle: {safeUpper(bestModel.modelType)}</p>
                  <p className="text-sm text-muted-foreground">
                    {bestModel.primaryMetric ? (
                      <>
                        Primary: <span className="font-medium">{bestModel.primaryMetric}</span> ={" "}
                        <span className="font-medium">
                          {smartValue((bestModel.metrics as any)?.[bestModel.primaryMetric] ?? bestModel.testScore ?? 0)}
                        </span>
                      </>
                    ) : taskType === "regression" ? (
                      <>R2: {num((bestModel.metrics as any)?.r2 ?? 0)}</>
                    ) : (
                      <>
                        F1: {pct((bestModel.metrics as any)?.f1 ?? 0)} • Accuracy: {pct((bestModel.metrics as any)?.accuracy ?? 0)}
                      </>
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => handleSaveModel(bestModel.id)}
                  className="bg-warning text-warning-foreground hover:bg-warning/90"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Sélectionner
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty results message */}
        {results.length === 0 && (
          <motion.div variants={staggerItem}>
            <Card className="border-muted">
              <CardContent className="py-5">
                <p className="font-medium">
                  {session.status === "running" ? "Entraînement en cours..." : "Aucun résultat disponible"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ce backend renvoie les modèles dans <code>session.results</code>.
                  <br />
                  Si c'est vide alors que la session est <code>succeeded</code>, vérifie que ton backend écrit bien les résultats.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Results grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {results.map((result, index) => {
            const m: any = result.metrics || {};
            const showPos = taskType === "classification" && isBinaryLike(result);
            const thr = (result as any).thresholding;

            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.12, type: "spring", stiffness: 200, damping: 20 }}
              >
                <Card className="overflow-hidden h-full">
                  <div className={`h-2 bg-gradient-to-r ${modelColors[result.modelType] ?? "from-primary to-primary"}`} />
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {safeUpper(result.modelType)}
                        {bestModel && result.id === bestModel.id && (
                          <Badge className="bg-warning text-warning-foreground">Meilleur</Badge>
                        )}
                      </CardTitle>
                      <Badge variant="outline">{sec(result.trainingTime ?? 0)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Status: {result.status}
                      {result.primaryMetric ? (
                        <span className="ml-2">
                          • Primary: <span className="font-medium">{result.primaryMetric}</span>
                        </span>
                      ) : null}
                    </p>

                    {result.splitInfo?.method && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Split: <span className="font-medium">{result.splitInfo.method}</span>{" "}
                        {result.splitInfo.method === "holdout" && (
                          <>
                            • train {result.splitInfo.train_rows ?? "—"} • val {result.splitInfo.val_rows ?? "—"} • test{" "}
                            {result.splitInfo.test_rows ?? "—"}
                          </>
                        )}
                        {result.splitInfo.method === "kfold" && (
                          <>
                            • folds {result.splitInfo.folds ?? "—"} • rows {result.splitInfo.rows ?? "—"}
                          </>
                        )}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* ✅ Step 1 visibility: distributions + baseline */}
                    {taskType === "classification" && (
                      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">Données (classes)</p>
                          {(() => {
                            const r = imbalanceRatio(result.classDistribution?.train ?? null);
                            if (!r) return null;
                            return <Badge variant="outline">Imbalance ~{r.toFixed(1)}x (train)</Badge>;
                          })()}
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            <span className="font-medium">All</span>: {fmtDist(result.classDistribution?.all)}
                          </p>
                          <p>
                            <span className="font-medium">Train</span>: {fmtDist(result.classDistribution?.train)}
                          </p>
                          {result.classDistribution?.val && Object.keys(result.classDistribution.val).length > 0 && (
                            <p>
                              <span className="font-medium">Val</span>: {fmtDist(result.classDistribution?.val)}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Test</span>: {fmtDist(result.classDistribution?.test)}
                          </p>
                        </div>

                        {result.baselineMajority?.metrics && (
                          <div className="mt-2 rounded-lg bg-background/60 p-3">
                            <p className="text-xs font-medium">
                              Baseline majority (predict "{result.baselineMajority.majority_label ?? "?"}")
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Acc: {pct((result.baselineMajority.metrics as any)?.accuracy ?? 0)}
                              {typeof (result.baselineMajority.metrics as any)?.recall_pos === "number" && (
                                <> • Recall_pos: {pct((result.baselineMajority.metrics as any)?.recall_pos ?? 0)}</>
                              )}
                              {typeof (result.baselineMajority.metrics as any)?.f1_pos === "number" && (
                                <> • F1_pos: {pct((result.baselineMajority.metrics as any)?.f1_pos ?? 0)}</>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ✅ NEW: Thresholding info */}
                    {showPos && thr && thr.enabled && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            Seuil auto (threshold tuning)
                          </p>
                          <Badge variant="outline">
                            {thr.val_source === "user_val" ? "Val" : thr.val_source === "inner_val_from_train" ? "Inner-Val" : "Val"}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            Threshold: <span className="font-medium">{num(thr.threshold)}</span>{" "}
                            {thr.score_kind ? <span className="ml-2">(score: {String(thr.score_kind)})</span> : null}
                          </p>
                          <p>
                            Val precision_pos: <span className="font-medium">{pct(thr.val_precision_pos ?? 0)}</span> • Val recall_pos:{" "}
                            <span className="font-medium">{pct(thr.val_recall_pos ?? 0)}</span> • Val f1_pos:{" "}
                            <span className="font-medium">{pct(thr.val_f1_pos ?? 0)}</span>
                          </p>
                          <p className="text-[11px]">
                            Ce seuil est optimisé sur la validation pour améliorer F1_pos (utile en classe rare), sans toucher au test split.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* MAIN METRICS */}
                    {taskType === "classification" ? (
                      <div className="grid grid-cols-4 gap-3">
                        {(["accuracy", "precision", "recall", "f1"] as const).map((metric) => (
                          <div key={metric} className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-xl font-bold text-primary">{pct(m?.[metric] ?? 0)}</p>
                            <p className="text-xs text-muted-foreground capitalize">{metric}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3">
                        {(["r2", "rmse", "mae", "mse"] as const).map((metric) => (
                          <div key={metric} className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-xl font-bold text-primary">{smartValue(m?.[metric])}</p>
                            <p className="text-xs text-muted-foreground capitalize">{metric}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ✅ BINARY POSITIVE METRICS */}
                    {showPos && (
                      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">Positive class metrics</p>
                          <Badge className="bg-accent text-accent-foreground">Binaire</Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          {(["recall_pos", "precision_pos", "f1_pos", "pr_auc"] as const).map((metric) => (
                            <div key={metric} className="text-center p-3 rounded-lg bg-muted/40">
                              <p className="text-xl font-bold text-primary">{pct(m?.[metric] ?? 0)}</p>
                              <p className="text-xs text-muted-foreground">{metric}</p>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Astuce médical: surveille surtout <span className="font-medium">recall_pos</span> et{" "}
                          <span className="font-medium">pr_auc</span> si la classe positive est rare.
                        </p>
                      </div>
                    )}

                    {/* ROC-AUC info */}
                    {taskType === "classification" && (
                      <div className="text-sm text-muted-foreground flex justify-between">
                        <span>ROC AUC: {pct(m?.roc_auc ?? 0)}</span>
                        {typeof m?.pr_auc === "number" && <span>PR AUC: {pct(m?.pr_auc ?? 0)}</span>}
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Train score: {smartValue(result.trainScore ?? 0)}</span>
                        <span>Test score: {smartValue(result.testScore ?? 0)}</span>
                      </div>
                    </div>

                    <Button className="w-full" onClick={() => handleSaveModel(result.id)}>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer ce modèle
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison table */}
        {results.length > 0 && (
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

                        {taskType === "classification" ? (
                          <>
                            <th className="px-4 py-3 text-left font-medium">Accuracy</th>
                            <th className="px-4 py-3 text-left font-medium">Precision</th>
                            <th className="px-4 py-3 text-left font-medium">Recall</th>
                            <th className="px-4 py-3 text-left font-medium">F1</th>
                            <th className="px-4 py-3 text-left font-medium">ROC AUC</th>
                            {anyBinary && <th className="px-4 py-3 text-left font-medium">PR AUC</th>}
                            <th className="px-4 py-3 text-left font-medium">TestScore</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 text-left font-medium">R2</th>
                            <th className="px-4 py-3 text-left font-medium">RMSE</th>
                            <th className="px-4 py-3 text-left font-medium">MAE</th>
                            <th className="px-4 py-3 text-left font-medium">MSE</th>
                            <th className="px-4 py-3 text-left font-medium">TestScore</th>
                          </>
                        )}

                        <th className="px-4 py-3 text-left font-medium">Temps</th>
                      </tr>
                    </thead>

                    <tbody>
                      {results.map((r) => {
                        const m: any = r.metrics || {};
                        return (
                          <tr key={r.id} className="border-t border-border">
                            <td className="px-4 py-3 font-medium">{safeUpper(r.modelType)}</td>

                            {taskType === "classification" ? (
                              <>
                                <td className="px-4 py-3">{pct(m?.accuracy ?? 0)}</td>
                                <td className="px-4 py-3">{pct(m?.precision ?? 0)}</td>
                                <td className="px-4 py-3">{pct(m?.recall ?? 0)}</td>
                                <td className="px-4 py-3">{pct(m?.f1 ?? 0)}</td>
                                <td className="px-4 py-3">{pct(m?.roc_auc ?? 0)}</td>
                                {anyBinary && <td className="px-4 py-3">{pct(m?.pr_auc ?? 0)}</td>}
                                <td className="px-4 py-3">{smartValue(r.testScore ?? 0)}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3">{smartValue(m?.r2)}</td>
                                <td className="px-4 py-3">{smartValue(m?.rmse)}</td>
                                <td className="px-4 py-3">{smartValue(m?.mae)}</td>
                                <td className="px-4 py-3">{smartValue(m?.mse)}</td>
                                <td className="px-4 py-3">{smartValue(r.testScore ?? 0)}</td>
                              </>
                            )}

                            <td className="px-4 py-3">{sec(r.trainingTime ?? 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {taskType === "classification" && anyBinary && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Note: pour une classe rare, <span className="font-medium">PR-AUC</span> et{" "}
                    <span className="font-medium">Recall_pos</span> sont souvent plus pertinents que l’Accuracy.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
  );
}

export default TrainingResultsPage;
