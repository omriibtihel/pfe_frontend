import { motion } from 'framer-motion';
import { BarChart3, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricType } from '@/types';

const metrics: { value: MetricType; label: string; description: string }[] = [
  { value: 'accuracy', label: 'Accuracy', description: 'Taux de prédictions correctes' },
  { value: 'precision', label: 'Precision', description: 'Exactitude des positifs prédits' },
  { value: 'recall', label: 'Recall', description: 'Taux de vrais positifs détectés' },
  { value: 'f1', label: 'F1-Score', description: 'Moyenne harmonique precision/recall' },
  { value: 'roc_auc', label: 'ROC AUC', description: 'Aire sous la courbe ROC' },
];

interface MetricsSelectorProps {
  selectedMetrics: MetricType[];
  onToggleMetric: (metric: MetricType) => void;
}

export function MetricsSelector({ selectedMetrics, onToggleMetric }: MetricsSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-xl bg-success/10">
            <BarChart3 className="h-5 w-5 text-success" />
          </div>
          Métriques d'évaluation
        </CardTitle>
        <p className="text-sm text-muted-foreground">Choisissez les métriques pour évaluer vos modèles</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {metrics.map((metric, index) => {
            const isSelected = selectedMetrics.includes(metric.value);
            return (
              <motion.button
                key={metric.value}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onToggleMetric(metric.value)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-success bg-success/5 shadow-md'
                    : 'border-border hover:border-success/30 hover:bg-muted/50'
                }`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center">
                      <Check className="h-3 w-3 text-success-foreground" />
                    </div>
                  </motion.div>
                )}
                <div className="font-semibold text-sm">{metric.label}</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{metric.description}</p>
              </motion.button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
