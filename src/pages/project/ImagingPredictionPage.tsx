import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Play,
  Target,
  Upload,
  X,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { imagingService } from "@/services/imagingService";
import type { ImagingModelResult, ImagingPredictionResult } from "@/types/imaging";
import { IMAGING_MODEL_LABELS } from "@/types/imaging";
import { cn } from "@/lib/utils";
import { fadeInUp } from "@/components/ui/page-transition";

const ACCEPTED = ["image/jpeg", "image/png", "image/bmp", "image/webp", "image/tiff"];

export function ImagingPredictionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [savedModels, setSavedModels] = useState<ImagingModelResult[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [isPredicting, setIsPredicting] = useState(false);
  const [result, setResult] = useState<ImagingPredictionResult | null>(null);

  useEffect(() => {
    if (!id) return;
    imagingService
      .listSavedModels(id)
      .then((models) => {
        setSavedModels(models);
        if (models.length > 0) setSelectedModelId(String(models[0].id));
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false));
  }, [id]);

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Format non supporté", description: "JPG, PNG, BMP, WebP ou TIFF uniquement.", variant: "destructive" });
      return;
    }
    setImage(file);
    setResult(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePredict = async () => {
    if (!id || !image || !selectedModelId) return;
    setIsPredicting(true);
    setResult(null);
    try {
      const res = await imagingService.predictImage(id, Number(selectedModelId), image);
      setResult(res);
    } catch (err) {
      toast({
        title: "Erreur de prédiction",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsPredicting(false);
    }
  };

  const selectedModel = savedModels.find((m) => String(m.id) === selectedModelId) ?? null;
  const classNames = selectedModel?.artifacts_json?.class_names ?? [];

  if (!id) return null;

  return (
    <AppLayout>
      <motion.div
        className="w-full max-w-3xl mx-auto space-y-6"
        initial="initial"
        animate="animate"
        variants={fadeInUp}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="h-7 w-7 text-primary" />
              Prédiction imagerie
            </h1>
            <p className="text-muted-foreground mt-1">
              Classifiez une image avec un modèle entraîné.
            </p>
          </div>
          <Badge variant="secondary"><Brain className="mr-1 h-3 w-3" />Inférence</Badge>
        </div>

        {/* Model selector */}
        {loadingModels ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Chargement des modèles…</span>
            </CardContent>
          </Card>
        ) : savedModels.length === 0 ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Aucun modèle sauvegardé</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entraînez un modèle et cliquez sur Sauvegarder pour pouvoir faire des prédictions.
                </p>
                <Button variant="link" className="mt-1 h-auto p-0 text-sm"
                  onClick={() => navigate(`/projects/${id}/imaging/training`)}>
                  Aller vers l'entraînement →
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-primary" />
                Modèle sélectionné
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Modèle sauvegardé</Label>
                <Select value={selectedModelId} onValueChange={(v) => { setSelectedModelId(v); setResult(null); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un modèle…" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedModels.map((m) => {
                      const acc = m.metrics_json?.accuracy;
                      return (
                        <SelectItem key={m.id} value={String(m.id)}>
                          <span className="font-medium">{IMAGING_MODEL_LABELS[m.model_name] ?? m.model_name}</span>
                          {acc != null && (
                            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                              {(acc * 100).toFixed(1)}% acc.
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedModel && classNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {classNames.map((cls) => (
                    <span key={cls} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {cls}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Image drop zone */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-secondary" />
              Image à classifier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!image ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <Upload className={cn("h-8 w-8", dragging ? "text-primary" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="text-sm font-medium">Déposez une image ou cliquez</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, BMP, WebP, TIFF</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED.join(",")}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={preview!}
                    alt="Preview"
                    className="max-h-64 max-w-full rounded-xl object-contain border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => { setImage(null); setPreview(null); setResult(null); }}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{image.name} — {(image.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Predict button */}
        <Button
          size="lg"
          className="h-14 w-full bg-gradient-to-r from-primary to-secondary text-lg shadow-glow"
          disabled={!image || !selectedModelId || isPredicting || savedModels.length === 0}
          onClick={handlePredict}
        >
          {isPredicting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Inférence en cours…</>
          ) : (
            <><Play className="mr-2 h-5 w-5" />Classifier l'image</>
          )}
        </Button>

        {/* Result */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Résultat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main prediction */}
                <div className="flex items-center justify-between rounded-xl bg-card px-5 py-4 shadow-sm border border-border/60">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Classe prédite</p>
                    <p className="text-2xl font-bold text-primary">{result.predicted_class}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Confiance</p>
                    <p className="text-2xl font-bold">{(result.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Probability bars */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distribution des probabilités</p>
                  {Object.entries(result.probabilities).map(([cls, prob]) => (
                    <div key={cls} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={cn("font-medium", cls === result.predicted_class && "text-primary")}>{cls}</span>
                        <span className="text-muted-foreground tabular-nums">{(prob * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            cls === result.predicted_class
                              ? "bg-gradient-to-r from-primary to-secondary"
                              : "bg-muted-foreground/30"
                          )}
                          style={{ width: `${prob * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
  );
}

export default ImagingPredictionPage;
