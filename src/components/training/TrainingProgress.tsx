import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Brain, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ModelType } from '@/types';

interface TrainingProgressProps {
  isTraining: boolean;
  selectedModels: ModelType[];
}

const modelLabels: Record<ModelType, string> = {
  lightgbm: 'LightGBM',
  xgboost: 'XGBoost',
  randomforest: 'Random Forest',
  svm: 'SVM',
  knn: 'KNN',
  decisiontree: 'Decision Tree',
};

export function TrainingProgress({ isTraining, selectedModels }: TrainingProgressProps) {
  if (!isTraining) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="bg-card border rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4"
        >
          <div className="text-center space-y-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-primary via-secondary to-accent flex items-center justify-center"
            >
              <Brain className="h-8 w-8 text-white" />
            </motion.div>

            <div>
              <h3 className="text-xl font-bold">Entraînement en cours</h3>
              <p className="text-muted-foreground mt-1">Vos modèles apprennent de vos données...</p>
            </div>

            <div className="space-y-3">
              {selectedModels.map((model, index) => (
                <motion.div
                  key={model}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium flex-1 text-left">{modelLabels[model]}</span>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              ))}
            </div>

            <div className="pt-4">
              <Progress value={66} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Optimisation des hyperparamètres...
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
