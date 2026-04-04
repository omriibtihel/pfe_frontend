import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { imagingService } from "@/services/imagingService";
import { ImagingResultCard } from "./ImagingResultCard";
import type { ImagingSession, ImagingEpochEvent, ImagingModelResult } from "@/types/imaging";

export function ImagingResultsOverview() {
  const { id: projectId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<ImagingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveProgress, setLiveProgress] = useState(0);
  const [liveModel, setLiveModel] = useState<string | null>(null);
  const [epochInfo, setEpochInfo] = useState<ImagingEpochEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadSession = useCallback(async () => {
    if (!projectId || !sessionId) return;
    try {
      const s = await imagingService.getSession(projectId, parseInt(sessionId));
      setSession(s);
      setLiveProgress(s.progress);
    } catch {
      toast({ title: "Erreur chargement session", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, sessionId]);

  // SSE subscription
  useEffect(() => {
    if (!projectId || !sessionId) return;
    loadSession();

    const es = imagingService.subscribeEvents(projectId, parseInt(sessionId));
    eventSourceRef.current = es;

    es.addEventListener("imaging.epoch.complete", (e: MessageEvent) => {
      const data: ImagingEpochEvent = JSON.parse(e.data);
      setLiveProgress(data.progress);
      setLiveModel(data.modelName);
      setEpochInfo(data);
    });

    es.addEventListener("imaging.model.complete", () => {
      loadSession();
    });

    es.addEventListener("imaging.final.complete", () => {
      setLiveProgress(100);
      loadSession();
      es.close();
    });

    es.addEventListener("imaging.error", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      toast({ title: "Erreur entraînement", description: data.message, variant: "destructive" });
      loadSession();
      es.close();
    });

    return () => {
      es.close();
    };
  }, [projectId, sessionId]);

  const handleSave = async (modelId: number) => {
    if (!projectId || !sessionId) return;
    await imagingService.saveModel(projectId, parseInt(sessionId), modelId);
    loadSession();
  };

  const handleUnsave = async (modelId: number) => {
    if (!projectId || !sessionId) return;
    await imagingService.unsaveModel(projectId, parseInt(sessionId), modelId);
    loadSession();
  };

  const isRunning = session?.status === "running" || session?.status === "queued";

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/training`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Résultats — Pipeline Imagerie</h1>
            <p className="text-sm text-muted-foreground">
              Session #{sessionId}
            </p>
          </div>
          <Badge
            variant={
              session?.status === "succeeded"
                ? "default"
                : session?.status === "failed"
                ? "destructive"
                : "secondary"
            }
          >
            {session?.status === "succeeded" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {session?.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
            {session?.status}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadSession}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar (running) */}
        {isRunning && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {liveModel ? (
                    <>
                      Entraînement <strong>{liveModel}</strong>
                      {epochInfo && (
                        <> — epoch {epochInfo.epoch}/{epochInfo.totalEpochs}</>
                      )}
                    </>
                  ) : (
                    "Démarrage..."
                  )}
                </span>
                <span className="font-medium">{liveProgress}%</span>
              </div>
              <Progress value={liveProgress} className="h-2" />
              {epochInfo && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Train loss: {epochInfo.trainLoss.toFixed(4)}</span>
                  <span>Val loss: {epochInfo.valLoss.toFixed(4)}</span>
                  <span>Val acc: {(epochInfo.valAcc * 100).toFixed(1)}%</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {session?.error_message && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 text-sm text-destructive">
              {session.error_message}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {session?.results && session.results.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">
              Modèles entraînés ({session.results.length})
            </h2>
            {session.results.map((r) => (
              <ImagingResultCard
                key={r.id}
                result={r}
                onSave={handleSave}
                onUnsave={handleUnsave}
              />
            ))}
          </div>
        ) : !isRunning ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Aucun résultat disponible.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
