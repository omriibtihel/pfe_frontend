import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TrainingConfig, MetricType } from '@/types';
import { cn } from '@/lib/utils';

interface Step5Props {
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

const classificationMetrics: { value: MetricType; label: string; desc: string }[] = [
  { value: 'accuracy', label: 'Accuracy', desc: 'Proportion de predictions correctes' },
  { value: 'precision', label: 'Precision', desc: 'Qualite des predictions positives' },
  { value: 'recall', label: 'Recall', desc: 'Couverture des positifs reels' },
  { value: 'f1', label: 'F1 Score', desc: 'Moyenne harmonique precision/recall' },
  { value: 'precision_macro', label: 'Precision Macro', desc: 'Moyenne non ponderee sur les classes' },
  { value: 'recall_macro', label: 'Recall Macro', desc: 'Sensibilite moyenne par classe' },
  { value: 'f1_macro', label: 'F1 Macro', desc: 'F1 moyen non pondere par classe' },
  { value: 'precision_weighted', label: 'Precision Weighted', desc: 'Moyenne ponderee par support' },
  { value: 'recall_weighted', label: 'Recall Weighted', desc: 'Moyenne ponderee par support' },
  { value: 'f1_weighted', label: 'F1 Weighted', desc: 'F1 pondere par support' },
  { value: 'precision_micro', label: 'Precision Micro', desc: 'Agregation globale TP/FP' },
  { value: 'recall_micro', label: 'Recall Micro', desc: 'Agregation globale TP/FN' },
  { value: 'f1_micro', label: 'F1 Micro', desc: 'F1 global calcule sur tous les labels' },
  { value: 'roc_auc', label: 'ROC AUC', desc: 'Aire sous la courbe ROC' },
  { value: 'pr_auc', label: 'PR AUC', desc: 'Aire sous la courbe Precision-Recall' },
  { value: 'f1_pos', label: 'F1 Positif', desc: 'F1 score pour la classe positive' },
  { value: 'confusion_matrix', label: 'Matrice de confusion', desc: 'Tableau TP/FP/TN/FN' },
];

const regressionMetrics: { value: MetricType; label: string; desc: string }[] = [
  { value: 'mae', label: 'MAE', desc: 'Erreur absolue moyenne' },
  { value: 'mse', label: 'MSE', desc: 'Erreur quadratique moyenne' },
  { value: 'rmse', label: 'RMSE', desc: "Racine de l'erreur quadratique" },
  { value: 'r2', label: 'R2', desc: 'Coefficient de determination' },
];

export function Step5Metrics({ config, onConfigChange }: Step5Props) {
  const metrics = config.taskType === 'classification' ? classificationMetrics : regressionMetrics;
  const positiveLabelValue = config.positiveLabel == null ? '' : String(config.positiveLabel);

  const toggleMetric = (m: MetricType) => {
    const next = config.metrics.includes(m)
      ? config.metrics.filter((x) => x !== m)
      : [...config.metrics, m];
    onConfigChange({ metrics: next });
  };

  const selectAll = () => {
    onConfigChange({ metrics: metrics.map((m) => m.value) });
  };

  return (
    <Card className="glass-premium shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-accent/10">
            {config.taskType === 'classification' ? (
              <BarChart3 className="h-4 w-4 text-accent" />
            ) : (
              <TrendingUp className="h-4 w-4 text-accent" />
            )}
          </div>
          Metriques d'evaluation
          <Badge variant="outline" className="ml-2 text-[10px]">
            {config.taskType === 'classification' ? 'Classification' : 'Regression'}
          </Badge>
          <button onClick={selectAll} className="ml-auto text-xs text-primary hover:underline">
            Tout selectionner
          </button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Ces metriques seront affichees dans la page resultats</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {metrics.map((m, i) => {
            const selected = config.metrics.includes(m.value);
            return (
              <motion.label
                key={m.value}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
                  selected ? 'border-accent bg-accent/5 shadow-sm' : 'border-border hover:border-accent/30'
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleMetric(m.value)}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-semibold text-sm">{m.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              </motion.label>
            );
          })}
        </div>

        {config.metrics.length === 0 && (
          <p className="text-sm text-destructive mt-4">Selectionnez au moins une metrique</p>
        )}

        {config.taskType === 'classification' && (
          <div className="mt-5 space-y-4 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold">Classe positive (positiveLabel)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Recommande pour la binaire non {'{0,1}'} pour stabiliser ROC-AUC / PR-AUC et F1 pos.
              </p>
              <Input
                value={positiveLabelValue}
                onChange={(e) =>
                  onConfigChange({
                    positiveLabel: e.target.value.trim() ? e.target.value : null,
                  })
                }
                placeholder="Ex: Yes, Malade, 1"
                className="mt-2"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={Boolean(config.trainingDebug)}
                onCheckedChange={(checked) => onConfigChange({ trainingDebug: Boolean(checked) })}
              />
              <div>
                <span className="text-sm font-semibold">Mode debug training</span>
                <p className="text-xs text-muted-foreground">
                  Envoie `debug=true` au backend pour logs détaillés (splits, classes, AUC source).
                </p>
              </div>
            </label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
