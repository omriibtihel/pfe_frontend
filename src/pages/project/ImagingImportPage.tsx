import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, ImageIcon } from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeInUp } from "@/components/ui/page-transition";
import { ImageUploadZone } from "@/components/imaging/upload/ImageUploadZone";
import { imagingService } from "@/services/imagingService";
import type { ImageClassInfo } from "@/types/imaging";

export function ImagingImportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ImageClassInfo[]>([]);

  const loadClasses = () => {
    if (!id) return;
    imagingService.listImages(id).then((data) => setClasses(data.classes)).catch(() => {});
  };

  useEffect(() => {
    loadClasses();
  }, [id]);

  if (!id) return null;

  const totalImages = classes.reduce((sum, c) => sum + c.count, 0);
  const canTrain = classes.length >= 2 && totalImages >= classes.length * 2;

  return (
    <AppLayout>
      <motion.div
        className="max-w-3xl mx-auto space-y-6"
        initial="initial"
        animate="animate"
        variants={fadeInUp}
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ImageIcon className="h-7 w-7 text-primary" />
            Import des images
          </h1>
          <p className="text-muted-foreground mt-1">
            Organisez vos images par classe pour l'entraînement du modèle.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classes détectées</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUploadZone
              projectId={id}
              classes={classes}
              onClassesChange={loadClasses}
            />
          </CardContent>
        </Card>

        {classes.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/70 px-5 py-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{classes.length}</span> classe(s) —{" "}
              <span className="font-semibold text-foreground">{totalImages}</span> image(s) au total
            </div>
            <Button
              disabled={!canTrain}
              onClick={() => navigate(`/projects/${id}/imaging/training`)}
              className="gap-2"
            >
              <Brain className="h-4 w-4" />
              Continuer vers l'entraînement
            </Button>
          </div>
        )}

        {classes.length > 0 && !canTrain && (
          <p className="text-xs text-muted-foreground text-center">
            Minimum 2 classes avec au moins 2 images chacune pour démarrer l'entraînement.
          </p>
        )}
      </motion.div>
    </AppLayout>
  );
}

export default ImagingImportPage;
