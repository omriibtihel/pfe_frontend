import type { ModelType } from '@/types';

/** Display labels for model types. */
export const MODEL_LABELS: Record<ModelType, string> = {
  lightgbm: 'LightGBM',
  xgboost: 'XGBoost',
  randomforest: 'Random Forest',
  svm: 'SVM',
  knn: 'KNN',
  decisiontree: 'Decision Tree',
  logreg: 'Logistic Regression',
  logisticregression: 'Logistic Regression',
  naivebayes: 'Naive Bayes',
};

export type HoldoutPreset = {
  label: string;
  train: number;
  val: number;
  test: number;
  description: string;
  recommended?: boolean;
};

/** Standard holdout split ratio presets shown in the wizard. */
export const HOLDOUT_PRESETS: HoldoutPreset[] = [
  { label: '70/15/15', train: 70, val: 15, test: 15, description: 'Equilibre general', recommended: true },
  { label: '80/10/10', train: 80, val: 10, test: 10, description: 'Bon compromis precision/stabilite' },
  { label: '80/0/20', train: 80, val: 0, test: 20, description: 'Sans validation, ideal avec CV' },
  { label: '90/0/10', train: 90, val: 0, test: 10, description: 'Priorite a l\'apprentissage' },
];
