import { CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ImagingConfig, ImagingModelName } from "@/types/imaging";
import {
  IMAGING_MODEL_LABELS,
  IMAGING_MODEL_DESCRIPTIONS,
} from "@/types/imaging";

const ALL_MODELS: ImagingModelName[] = [
  "simple_cnn",
  "resnet50",
  "efficientnet_b0",
  "resnet18",
  "densenet121",
  "efficientnet_b3",
  "resnet101",
  "vgg16",
];

interface Props {
  config: ImagingConfig;
  onChange: (updated: Partial<ImagingConfig>) => void;
}

export function ImagingStep2Architecture({ config, onChange }: Props) {
  const toggleModel = (model: ImagingModelName) => {
    const current = config.models;
    if (current.includes(model)) {
      if (current.length <= 1) return; // au moins 1
      onChange({ models: current.filter((m) => m !== model) });
    } else {
      onChange({ models: [...current, model] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Model selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Architecture(s) à entraîner</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sélectionnez un ou plusieurs modèles. Chacun sera entraîné séparément.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ALL_MODELS.map((model) => {
              const selected = config.models.includes(model);
              return (
                <div
                  key={model}
                  onClick={() => toggleModel(model)}
                  className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {IMAGING_MODEL_LABELS[model]}
                    </span>
                    {selected && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {model === "resnet50" && !selected && (
                      <Badge variant="secondary" className="text-[10px]">Recommandé</Badge>
                    )}
                    {model === "simple_cnn" && !selected && (
                      <Badge variant="outline" className="text-[10px]">Léger</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {IMAGING_MODEL_DESCRIPTIONS[model]}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Training params */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paramètres d'entraînement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="epochs">Epochs</Label>
            <input
              id="epochs"
              type="number"
              min={1}
              max={300}
              value={config.epochs}
              onChange={(e) => onChange({ epochs: parseInt(e.target.value) || 20 })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batchSize">Batch size</Label>
            <input
              id="batchSize"
              type="number"
              min={1}
              max={512}
              value={config.batchSize}
              onChange={(e) => onChange({ batchSize: parseInt(e.target.value) || 32 })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lr">Learning rate</Label>
            <input
              id="lr"
              type="number"
              step="0.00001"
              min={0.000001}
              max={0.1}
              value={config.learningRate}
              onChange={(e) => onChange({ learningRate: parseFloat(e.target.value) || 1e-4 })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imageSize">Taille image (px)</Label>
            <select
              id="imageSize"
              value={config.imageSize}
              onChange={(e) => onChange({ imageSize: parseInt(e.target.value) })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {[64, 128, 224, 256, 299, 384, 512].map((s) => (
                <option key={s} value={s}>{s}×{s}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Transfer learning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transfer Learning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.pretrained}
              onChange={(e) => onChange({ pretrained: e.target.checked })}
              className="h-4 w-4"
            />
            <div>
              <p className="text-sm font-medium">Poids ImageNet pré-entraînés</p>
              <p className="text-xs text-muted-foreground">
                Fortement recommandé sur des datasets médicaux de petite taille.
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.freezeBackbone}
              onChange={(e) => onChange({ freezeBackbone: e.target.checked })}
              disabled={!config.pretrained}
              className="h-4 w-4"
            />
            <div>
              <p className="text-sm font-medium">Geler le backbone initialement</p>
              <p className="text-xs text-muted-foreground">
                Entraîne seulement la tête de classification pendant les premières epochs.
              </p>
            </div>
          </label>

          {config.freezeBackbone && config.pretrained && (
            <div className="space-y-1.5">
              <Label htmlFor="unfreeze">Dégel après epoch</Label>
              <input
                id="unfreeze"
                type="number"
                min={0}
                max={config.epochs - 1}
                value={config.unfreezeAfterEpoch}
                onChange={(e) =>
                  onChange({ unfreezeAfterEpoch: parseInt(e.target.value) || 5 })
                }
                className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Après cette epoch, tous les paramètres seront entraînables.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
