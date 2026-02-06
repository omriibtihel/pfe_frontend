import { motion } from 'framer-motion';
import { Brain, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ModelType } from '@/types';

const models: { value: ModelType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'lightgbm', label: 'LightGBM', description: 'Rapide et efficace', icon: <Zap className="h-4 w-4" /> },
  { value: 'xgboost', label: 'XGBoost', description: 'Haute performance', icon: <Sparkles className="h-4 w-4" /> },
  { value: 'randomforest', label: 'Random Forest', description: 'Robuste et interprétable', icon: <Brain className="h-4 w-4" /> },
  { value: 'svm', label: 'SVM', description: 'Bon pour petits datasets', icon: <Brain className="h-4 w-4" /> },
  { value: 'knn', label: 'KNN', description: 'Simple et intuitif', icon: <Brain className="h-4 w-4" /> },
  { value: 'decisiontree', label: 'Decision Tree', description: 'Très interprétable', icon: <Brain className="h-4 w-4" /> },
];

interface ModelSelectorProps {
  selectedModels: ModelType[];
  onToggleModel: (model: ModelType) => void;
  useGridSearch: boolean;
  onGridSearchChange: (value: boolean) => void;
  useSmote: boolean;
  onSmoteChange: (value: boolean) => void;
}

export function ModelSelector({
  selectedModels,
  onToggleModel,
  useGridSearch,
  onGridSearchChange,
  useSmote,
  onSmoteChange,
}: ModelSelectorProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-xl bg-secondary/10">
            <Brain className="h-5 w-5 text-secondary" />
          </div>
          Modèles d'apprentissage
        </CardTitle>
        <p className="text-sm text-muted-foreground">Sélectionnez les algorithmes à entraîner</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {models.map((model, index) => {
            const isSelected = selectedModels.includes(model.value);
            return (
              <motion.label
                key={model.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <Checkbox 
                  checked={isSelected} 
                  onCheckedChange={() => onToggleModel(model.value)} 
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-primary">{model.icon}</span>
                    <span className="font-semibold text-sm">{model.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1"
                  >
                    <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full">✓</Badge>
                  </motion.div>
                )}
              </motion.label>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 pt-4 border-t">
          <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <Checkbox checked={useGridSearch} onCheckedChange={(c) => onGridSearchChange(!!c)} />
            <div>
              <span className="text-sm font-medium">GridSearch</span>
              <p className="text-xs text-muted-foreground">Optimisation hyperparamètres</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <Checkbox checked={useSmote} onCheckedChange={(c) => onSmoteChange(!!c)} />
            <div>
              <span className="text-sm font-medium">SMOTE</span>
              <p className="text-xs text-muted-foreground">Équilibrage des classes</p>
            </div>
          </label>
        </div>

        {selectedModels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-2"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedModels.length}</span> modèle{selectedModels.length > 1 ? 's' : ''} sélectionné{selectedModels.length > 1 ? 's' : ''}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
