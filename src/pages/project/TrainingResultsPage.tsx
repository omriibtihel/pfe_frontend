import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Save, Download, BarChart3, Star, AlertCircle, RefreshCw } from "lucide-react";

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

function sec(v: unknown) {
  const n = typeof v === "number" ? v : 0;
  return `${n.toFixed(1)}s`;
}

function safeUpper(s: unknown) {
  return String(s ?? "").toUpperCase();
}

/**
 * ✅ Cette page supporte 2 formats:
 * 1) Backend actuel:   TrainingSession { results: [...] }
 * 2) Format futur:     { session: TrainingSession, models: [...] }
 */
function normalizeSession(payload: any): TrainingSession | null {
  if (!payload) return null;

  // format futur { session, models }
  if (payload.session && payload.session.id) {
    const s = payload.session as TrainingSession;
    // si models existe, on le mappe dans results pour compat
    if (Array.isArray(payload.models) && !Array.isArray((s as any).results)) {
      (s as any).results = payload.models;
    }
    return s;
  }

  // format actuel: session direct
  if (payload.id) return payload as TrainingSession;

  return null;
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

    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setLoadError(null);

    try {
      const raw = await trainingService.getSession(String(projectId), String(sessionId));
      const s = normalizeSession(raw);
      setSession(s);
    } catch (error: any) {
      const msg = error?.message || "Impossible de charger la session";
      setLoadError(msg);
      setSession(null);
      if (!silent) {
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Chargement initial
  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sessionId]);

  // Auto-refresh tant que status=running
  useEffect(() => {
    if (!session) return;
    if (session.status !== "running") return;

    const t = setTimeout(() => {
      fetchSession({ silent: true });
    }, 2000);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.progress, session?.id]);

  const results: ModelResult[] = useMemo(() => {
    return (session?.results ?? []) as ModelResult[];
  }, [session]);

  const bestModel = useMemo(() => {
    if (!results.length) return null;
    // Choix par F1 si dispo, sinon accuracy
    return results.reduce((best, cur) => {
      const curScore = (cur.metrics?.f1 ?? cur.metrics?.accuracy ?? 0) as number;
      const bestScore = (best.metrics?.f1 ?? best.metrics?.accuracy ?? 0) as number;
      return curScore > bestScore ? cur : best;
    });
  }, [results]);

  const handleSaveModel = async (modelId: string) => {
    if (!projectId || !session) return;

    try {
      await trainingService.saveModel(String(projectId), String(session.id), String(modelId));
      toast({ title: "Modèle enregistré", description: "Le modèle a été sauvegardé avec succès" });
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
            {session.status === "failed" && session.errorMessage && (
              <p className="text-sm text-destructive mt-2">{session.errorMessage}</p>
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
                    F1: {pct(bestModel.metrics?.f1 ?? 0)} • Accuracy: {pct(bestModel.metrics?.accuracy ?? 0)}
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
          {results.map((result, index) => (
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
                  <p className="text-xs text-muted-foreground">Status: {result.status}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid grid-cols-4 gap-3">
                    {(["accuracy", "precision", "recall", "f1"] as const).map((metric) => (
                      <div key={metric} className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-xl font-bold text-primary">{pct((result.metrics as any)?.[metric] ?? 0)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{metric}</p>
                      </div>
                    ))}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Train score: {pct(result.trainScore ?? 0)}</span>
                      <span>Test score: {pct(result.testScore ?? 0)}</span>
                    </div>
                    <p className="text-xs mt-2">
                      (Si tu vois 0 partout ici, c'est normal: ton backend ne remplit pas encore trainScore/testScore.)
                    </p>
                  </div>

                  <Button className="w-full" onClick={() => handleSaveModel(result.id)}>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer ce modèle
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
                        <th className="px-4 py-3 text-left font-medium">Accuracy</th>
                        <th className="px-4 py-3 text-left font-medium">Precision</th>
                        <th className="px-4 py-3 text-left font-medium">Recall</th>
                        <th className="px-4 py-3 text-left font-medium">F1</th>
                        <th className="px-4 py-3 text-left font-medium">ROC AUC</th>
                        <th className="px-4 py-3 text-left font-medium">Temps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-4 py-3 font-medium">{safeUpper(r.modelType)}</td>
                          <td className="px-4 py-3">{pct((r.metrics as any)?.accuracy ?? 0)}</td>
                          <td className="px-4 py-3">{pct((r.metrics as any)?.precision ?? 0)}</td>
                          <td className="px-4 py-3">{pct((r.metrics as any)?.recall ?? 0)}</td>
                          <td className="px-4 py-3">{pct((r.metrics as any)?.f1 ?? 0)}</td>
                          <td className="px-4 py-3">{pct((r.metrics as any)?.roc_auc ?? 0)}</td>
                          <td className="px-4 py-3">{sec(r.trainingTime ?? 0)}</td>
                        </tr>
                      ))}
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
