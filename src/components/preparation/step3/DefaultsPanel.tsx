import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DEFAULT_ADVANCED_PARAMS,
  type TrainingPreprocessingAdvancedParams,
  type TrainingPreprocessingConfig,
  type TrainingPreprocessingDefaults,
} from '@/types';
import { SlidersHorizontal } from 'lucide-react';
import { labelForMethod } from './helpers';
import type { Step3Options } from './types';

interface DefaultsPanelProps {
  preprocessing: TrainingPreprocessingConfig;
  options: Step3Options;
  onSetDefault: <K extends keyof TrainingPreprocessingDefaults>(key: K, value: TrainingPreprocessingDefaults[K]) => void;
  onSetAdvancedParams: (params: TrainingPreprocessingAdvancedParams) => void;
}

export function DefaultsPanel({ preprocessing, options, onSetDefault, onSetAdvancedParams }: DefaultsPanelProps) {
  const adv = preprocessing.advancedParams ?? DEFAULT_ADVANCED_PARAMS;
  const setAdv = (patch: Partial<TrainingPreprocessingAdvancedParams>) =>
    onSetAdvancedParams({ ...adv, ...patch });

  const numImp = preprocessing.defaults.numericImputation;
  const catImp = preprocessing.defaults.categoricalImputation;

  return (
    <Card className="glass-premium shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
          </div>
          Paramètres par défaut
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* ── Variables numériques ─────────────────────────────────────── */}
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variables numériques</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Imputation numérique */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Imputation</p>
                <Select
                  value={numImp}
                  onValueChange={(v) => onSetDefault('numericImputation', v as TrainingPreprocessingDefaults['numericImputation'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.numericImputation.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {numImp === 'knn' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">Voisins k =</span>
                    <Input
                      type="number" min={1} max={50}
                      className="h-7 text-xs"
                      value={adv.knnNeighbors}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                        setAdv({ knnNeighbors: v });
                      }}
                    />
                  </div>
                )}
                {numImp === 'constant' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">Valeur =</span>
                    <Input
                      type="number" step="any"
                      className="h-7 text-xs"
                      value={adv.constantFillNumeric}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) setAdv({ constantFillNumeric: v });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Transformation */}
              <div className="space-y-1.5">
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

              {/* Normalisation */}
              <div className="space-y-1.5">
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

          {/* ── Variables catégorielles ──────────────────────────────────── */}
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variables catégorielles</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* Imputation catégorielle */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Imputation</p>
                <Select
                  value={catImp}
                  onValueChange={(v) => onSetDefault('categoricalImputation', v as TrainingPreprocessingDefaults['categoricalImputation'])}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.categoricalImputation.map((m) => (
                      <SelectItem key={m} value={m}>{labelForMethod(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {catImp === 'constant' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">Valeur =</span>
                    <Input
                      className="h-7 text-xs"
                      placeholder="__missing__"
                      value={adv.constantFillCategorical}
                      onChange={(e) => setAdv({ constantFillCategorical: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Encodage */}
              <div className="space-y-1.5">
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

        {/* ── Seuil de variance ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground shrink-0">Seuil de variance :</p>
          <Input
            type="number" min={0} max={1} step={0.001}
            className="h-7 text-xs w-24 font-mono"
            value={adv.varianceThreshold}
            onChange={(e) => {
              const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
              setAdv({ varianceThreshold: v });
            }}
          />
          {adv.varianceThreshold === 0 ? (
            <span className="text-[10px] text-amber-600">désactivé — aucune feature supprimée</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">— features avec variance &lt; seuil supprimées automatiquement</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
