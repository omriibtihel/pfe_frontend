import { SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TrainingPreprocessingConfig, TrainingPreprocessingDefaults } from '@/types';
import { labelForMethod } from './helpers';
import type { Step3Options } from './types';

interface DefaultsPanelProps {
  preprocessing: TrainingPreprocessingConfig;
  options: Step3Options;
  onSetDefault: <K extends keyof TrainingPreprocessingDefaults>(key: K, value: TrainingPreprocessingDefaults[K]) => void;
}

export function DefaultsPanel({ preprocessing, options, onSetDefault }: DefaultsPanelProps) {
  return (
    <Card className="glass-premium shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
          </div>
          Defaults (templates)
          <Badge variant="secondary" className="ml-auto text-xs">
            Aucune activation auto
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Numerique</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Imputation numerique</p>
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
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Scaling numerique</p>
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoriel</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Imputation categorielle</p>
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
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Encodage categoriel</p>
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
      </CardContent>
    </Card>
  );
}
