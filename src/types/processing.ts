export type ImputationMethod = 'mean' | 'median' | 'mode' | 'constant' | 'knn';
export type NormalizationMethod = 'minmax' | 'zscore' | 'robust';
export type EncodingMethod = 'onehot' | 'label' | 'frequency';

export type ProcessingOperation = {
  id: number;
  project_id: number;
  dataset_id: number;
  user_id?: number | null;

  op_type: "cleaning" | "imputation" | "normalization" | "encoding" | "other" | string;
  description: string;

  columns: string[];
  params: Record<string, any>;
  created_at: string;

  result?: Record<string, any> | null;
};
