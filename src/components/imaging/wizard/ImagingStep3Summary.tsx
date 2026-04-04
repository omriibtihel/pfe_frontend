import { Brain, ImageIcon, Rocket, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImagingConfig } from "@/types/imaging";
import { IMAGING_MODEL_LABELS } from "@/types/imaging";

interface Props {
  config: ImagingConfig;
  classNames: string[];
  totalImages: number;
  onLaunch: () => void;
  launching: boolean;
}

export function ImagingStep3Summary({
  config,
  classNames,
  totalImages,
  onLaunch,
  launching,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dataset */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Dataset
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Classes :</span>{" "}
              <strong>{classNames.length}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Images :</span>{" "}
              <strong>{totalImages}</strong>
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {classNames.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modèles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Modèles sélectionnés
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {config.models.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <span>{IMAGING_MODEL_LABELS[m]}</span>
                {config.pretrained && (
                  <Badge variant="outline" className="text-[10px]">
                    ImageNet
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Paramètres */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Paramètres
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Epochs :</span>{" "}
              {config.epochs}
            </p>
            <p>
              <span className="text-muted-foreground">Batch size :</span>{" "}
              {config.batchSize}
            </p>
            <p>
              <span className="text-muted-foreground">Learning rate :</span>{" "}
              {config.learningRate}
            </p>
            <p>
              <span className="text-muted-foreground">Taille image :</span>{" "}
              {config.imageSize}×{config.imageSize} px
            </p>
            <p>
              <span className="text-muted-foreground">Transfer learning :</span>{" "}
              {config.pretrained ? (
                <Badge variant="secondary" className="text-[10px]">
                  ImageNet
                </Badge>
              ) : (
                "Non"
              )}
            </p>
            {config.freezeBackbone && (
              <p>
                <span className="text-muted-foreground">Dégel backbone :</span>{" "}
                epoch {config.unfreezeAfterEpoch}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Splits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Splits
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Validation :</span>{" "}
              {Math.round(config.valSplit * 100)}%
            </p>
            <p>
              <span className="text-muted-foreground">Test :</span>{" "}
              {Math.round(config.testSplit * 100)}%
            </p>
            <p>
              <span className="text-muted-foreground">Train :</span>{" "}
              {Math.round((1 - config.valSplit - config.testSplit) * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Launch */}
      <div className="flex justify-center pt-2">
        <Button
          size="lg"
          onClick={onLaunch}
          disabled={launching}
          className="gap-2 min-w-48"
        >
          <Rocket className="h-5 w-5" />
          {launching ? "Lancement..." : `Lancer l'entraînement (${config.models.length} modèle(s))`}
        </Button>
      </div>
    </div>
  );
}
