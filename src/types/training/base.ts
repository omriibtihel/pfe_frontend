export type TaskType = 'classification' | 'regression';
export type ModelType =
  | 'automl'
  | 'lightgbm'
  | 'xgboost'
  | 'catboost'
  | 'randomforest'
  | 'extratrees'
  | 'gradientboosting'
  | 'svm'
  | 'knn'
  | 'decisiontree'
  | 'logreg'
  | 'logisticregression'
  | 'naivebayes'
  | 'ridge';
export type MetricType =
  | 'accuracy'
  | 'precision'
  | 'recall'
  | 'f1'
  | 'precision_macro'
  | 'recall_macro'
  | 'f1_macro'
  | 'precision_weighted'
  | 'recall_weighted'
  | 'f1_weighted'
  | 'precision_micro'
  | 'recall_micro'
  | 'f1_micro'
  | 'roc_auc'
  | 'pr_auc'
  | 'f1_pos'
  | 'confusion_matrix'
  | 'mse'
  | 'rmse'
  | 'mae'
  | 'r2';
export type SplitMethod =
  | 'holdout'
  | 'kfold'
  | 'stratified_kfold'
  | 'repeated_stratified_kfold'
  | 'group_kfold'
  | 'stratified_group_kfold'
  | 'loo';
export type NumericImputationStrategy = 'none' | 'mean' | 'median' | 'most_frequent' | 'constant' | 'knn';
export type CategoricalImputationStrategy = 'none' | 'most_frequent' | 'constant';
export type CategoricalEncodingStrategy = 'none' | 'onehot' | 'ordinal' | 'label';
export type NumericScalingStrategy = 'none' | 'standard' | 'minmax' | 'robust' | 'maxabs';
export type NumericPowerTransformStrategy = 'none' | 'yeo_johnson' | 'box_cox';
export type TrainingColumnType = 'numeric' | 'categorical' | 'ordinal';
export type TrainingColumnTypeSelection = 'auto' | TrainingColumnType;
export type TrainingBalancingStrategy =
  | 'none'
  | 'class_weight'
  | 'smote'
  | 'smote_tomek'
  | 'random_undersampling'
  | 'threshold_optimization';
export type TrainingThresholdStrategy =
  | 'maximize_f1'
  | 'maximize_f2'
  | 'maximize_f_beta'
  | 'min_recall'
  | 'precision_recall_balance'
  | 'youden'
  | 'minimize_cost';
export type TrainingImbalanceLevel = 'balanced' | 'mild' | 'moderate' | 'severe' | 'critical';
export type GridScoringOption = 'auto' | 'roc_auc' | 'average_precision' | 'f1_weighted' | 'r2';
export type SearchType = 'none' | 'grid' | 'random' | 'halving_random';
export type TrainingDatasetScale = 'tiny' | 'small' | 'medium' | 'large';
export type TrainingMode = 'manual' | 'automl';
export type TrainingValidationPreviewSubset = 'train' | 'val' | 'test';
export type TrainingValidationPreviewMode = 'head' | 'random';
