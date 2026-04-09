import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_ADVANCED_PARAMS,
  type TrainingPreprocessingAdvancedParams,
  type TrainingPreprocessingConfig,
  type TrainingPreprocessingDefaults,
} from '@/types';
import { AdvancedPreprocessingModal } from './AdvancedPreprocessingModal';
import { labelForMethod } from './helpers';
import type { Step3Options } from './types';

interface DefaultsPanelProps {
  preprocessing: TrainingPreprocessingConfig;
  options: Step3Options;
  onSetDefault: <K extends keyof TrainingPreprocessingDefaults>(key: K, value: TrainingPreprocessingDefaults[K]) => void;
  onSetAdvancedParams: (params: TrainingPreprocessingAdvancedParams) => void;
}

export function DefaultsPanel({ preprocessing, options, onSetDefault, onSetAdvancedParams }: DefaultsPanelProps) {
  const advancedParams = preprocessing.advancedParams ?? DEFAULT_ADVANCED_PARAMS;

  return (
    <Card className="glass-premium shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
          </div>
          Paramètres par défaut
          <div className="ml-auto">
            <AdvancedPreprocessingModal params={advancedParams} onChange={onSetAdvancedParams} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variables numériques</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Valeurs manquantes</p>
                <Select
                  value={preprocessing.defaults.numericImputation}
                  onValueChange={(v) => onSetDefault('numericImputation', v as TrainingPreprocessingDefaults['numericImputation'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.numericImputation.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preprocessing.defaults.numericImputation === 'knn' && (
                  <p className="text-[10px] text-primary">k = {advancedParams.knnNeighbors}</p>
                )}
                {preprocessing.defaults.numericImputation === 'constant' && (
                  <p className="text-[10px] text-primary">fill = {advancedParams.constantFillNumeric}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Transformation</p>
                <Select
                  value={preprocessing.defaults.numericPowerTransform}
                  onValueChange={(v) => onSetDefault('numericPowerTransform', v as TrainingPreprocessingDefaults['numericPowerTransform'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.numericPowerTransform.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Normalisation (linéaire)</p>
                <Select
                  value={preprocessing.defaults.numericScaling}
                  onValueChange={(v) => onSetDefault('numericScaling', v as TrainingPreprocessingDefaults['numericScaling'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.numericScaling.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variables catégorielles</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Valeurs manquantes</p>
                <Select
                  value={preprocessing.defaults.categoricalImputation}
                  onValueChange={(v) => onSetDefault('categoricalImputation', v as TrainingPreprocessingDefaults['categoricalImputation'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.categoricalImputation.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preprocessing.defaults.categoricalImputation === 'constant' && (
                  <p className="text-[10px] text-primary">fill = "{advancedParams.constantFillCategorical}"</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Encodage</p>
                <Select
                  value={preprocessing.defaults.categoricalEncoding}
                  onValueChange={(v) => onSetDefault('categoricalEncoding', v as TrainingPreprocessingDefaults['categoricalEncoding'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.categoricalEncoding.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground">Seuil de variance :</p>
          {advancedParams.varianceThreshold === 0 ? (
            <Badge variant="secondary" className="text-xs">Désactivé</Badge>
          ) : (
            <Badge variant="outline" className="text-xs font-mono">
              seuil = {advancedParams.varianceThreshold}
            </Badge>
          )}
          <p className="text-[10px] text-muted-foreground">
            — colonnes avec trop peu de variation supprimées automatiquement
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
