// ── Formateurs ────────────────────────────────────────────────────────────────
export function safeN(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function pct(v: unknown): string {
  const n = safeN(v); return n == null ? 'N/A' : `${(n * 100).toFixed(1)} %`;
}
export function num4(v: unknown): string {
  const n = safeN(v); return n == null ? 'N/A' : n.toFixed(4);
}
export function sec(v: unknown): string {
  const n = safeN(v); return n == null ? 'N/A' : `${n.toFixed(2)} s`;
}

// ── Noms lisibles des modèles ─────────────────────────────────────────────────
export const MODEL_NAMES: Record<string, string> = {
  lightgbm: 'LightGBM', xgboost: 'XGBoost',
  randomforest: 'Random Forest', svm: 'SVM',
  knn: 'K-Plus Proches Voisins', decisiontree: 'Arbre de décision',
  logisticregression: 'Régression Logistique', logreg: 'Régression Logistique',
  naivebayes: 'Naïf Bayésien',
};
export function modelName(t: string): string { return MODEL_NAMES[t.toLowerCase()] ?? t.toUpperCase(); }

// ── Traduction des clés de métriques backend ───────────────────────────────
export const METRIC_LABELS: Record<string, string> = {
  accuracy:          'Accuracy',
  precision:         'Precision',
  recall:            'Recall',
  f1:                'F1',
  f1_score:          'F1',
  roc_auc:           'ROC AUC',
  pr_auc:            'PR AUC',
  specificity:       'Specificity',
  balanced_accuracy: 'Balanced Accuracy',
  r2:                'R2',
  rmse:              'RMSE',
  mae:               'MAE',
  mse:               'MSE',
  train_score:       'Train Score',
};

export function metricLabel(k: string): string {
  return METRIC_LABELS[k.toLowerCase()] ?? k.replace(/_/g, ' ');
}
