import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageUploadZone } from "@/components/imaging/upload/ImageUploadZone";
import { imagingService } from "@/services/imagingService";
import type { ImageClassInfo } from "@/types/imaging";

interface Props {
  projectId: string | number;
  onValidChange: (valid: boolean, classes: string[]) => void;
}

export function ImagingStep1DataSource({ projectId, onValidChange }: Props) {
  const [classes, setClasses] = useState<ImageClassInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const res = await imagingService.listImages(projectId);
      setClasses(res.classes.filter((c) => c.count > 0));
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [projectId]);

  useEffect(() => {
    const validClasses = classes.filter((c) => c.count > 0);
    const isValid = validClasses.length >= 2;
    onValidChange(isValid, validClasses.map((c) => c.name));
  }, [classes]);

  const totalImages = classes.reduce((s, c) => s + c.count, 0);
  const isValid = classes.length >= 2;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Jeu de données images</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadClasses} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length > 0 && (
            <div className="mb-4 flex items-center gap-3 text-sm">
              {isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span>
                <strong>{classes.length}</strong> classe(s) ·{" "}
                <strong>{totalImages}</strong> image(s) total
              </span>
              {!isValid && (
                <Badge variant="destructive" className="text-xs">
                  Minimum 2 classes requises
                </Badge>
              )}
            </div>
          )}

          <ImageUploadZone
            projectId={projectId}
            classes={classes}
            onClassesChange={loadClasses}
          />
        </CardContent>
      </Card>

      {classes.length === 0 && !loading && (
        <Card className="border-dashed border-amber-200 bg-amber-50/40">
          <CardContent className="pt-4 text-sm text-amber-700">
            Commencez par créer au moins 2 classes et y déposer vos images.
            Chaque classe correspond à une catégorie (ex : "tumeur", "sain").
          </CardContent>
        </Card>
      )}

      {isValid && (
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="pt-4 text-sm text-green-700 space-y-1">
            <p className="font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Dataset prêt à l'entraînement
            </p>
            <ul className="ml-6 list-disc space-y-0.5 text-xs">
              {classes.map((c) => (
                <li key={c.name}>
                  <strong>{c.name}</strong> — {c.count} image(s)
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
