// Types TypeScript pour le pipeline imagerie

export type ImagingTaskType = "image_classification";

export type ImagingModelName =
  | "resnet18"
  | "resnet50"
  | "resnet101"
  | "efficientnet_b0"
  | "efficientnet_b3"
  | "vgg16"
  | "densenet121"
  | "simple_cnn";

export interface AugmentationConfig {
  horizontalFlip: boolean;
  verticalFlip: boolean;
  rotationDegrees: number;
  brightnessLimit: number;
  contrastLimit: number;
  normalizeMean: number[];
  normalizeStd: number[];
}

export interface ImagingConfig {
  taskType: ImagingTaskType;
  models: ImagingModelName[];
  imageSize: number;
  pretrained: boolean;
  epochs: number;
  batchSize: number;
  learningRate: number;
  weightDecay: number;
  freezeBackbone: boolean;
  unfreezeAfterEpoch: number;
  valSplit: number;
  testSplit: number;
  augmentation: AugmentationConfig;
}

export const DEFAULT_AUGMENTATION: AugmentationConfig = {
  horizontalFlip: true,
  verticalFlip: false,
  rotationDegrees: 15,
  brightnessLimit: 0.2,
  contrastLimit: 0.2,
  normalizeMean: [0.485, 0.456, 0.406],
  normalizeStd: [0.229, 0.224, 0.225],
};

export const DEFAULT_IMAGING_CONFIG: ImagingConfig = {
  taskType: "image_classification",
  models: ["resnet50"],
  imageSize: 224,
  pretrained: true,
  epochs: 20,
  batchSize: 32,
  learningRate: 0.0001,
  weightDecay: 0.00001,
  freezeBackbone: true,
  unfreezeAfterEpoch: 5,
  valSplit: 0.2,
  testSplit: 0.1,
  augmentation: DEFAULT_AUGMENTATION,
};

// ── Résultats ─────────────────────────────────────────────────────────────────

export interface ImagingEpochCurvePoint {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  valAcc: number;
}

export interface ImagingPerClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ImagingMetrics {
  accuracy?: number;
  f1_macro?: number;
  f1_weighted?: number;
  precision_macro?: number;
  recall_macro?: number;
  roc_auc?: number | null;
  confusion_matrix?: number[][];
  per_class?: Record<string, ImagingPerClassMetrics>;
  best_epoch?: number;
  best_val_loss?: number;
  best_val_acc?: number;
  epoch_curves?: ImagingEpochCurvePoint[];
  training_time_s?: number;
  n_samples?: number;
}

export interface ImagingArtifacts {
  model_pt?: string;
  class_names?: string[];
  num_classes?: number;
  image_size?: number;
  pretrained?: boolean;
  model_name?: string;
}

export interface ImagingModelResult {
  id: number;
  session_id: number;
  project_id: number;
  model_name: ImagingModelName;
  task_type: ImagingTaskType;
  is_saved: boolean;
  metrics_json: ImagingMetrics;
  artifacts_json: ImagingArtifacts;
  created_at: string;
}

export interface ImagingSession {
  id: number;
  project_id: number;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  current_model: string | null;
  config_json: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  results: ImagingModelResult[];
}

// ── Événements SSE ────────────────────────────────────────────────────────────

export interface ImagingEpochEvent {
  modelName: string;
  modelIndex: number;
  totalModels: number;
  epoch: number;
  totalEpochs: number;
  trainLoss: number;
  valLoss: number;
  valAcc: number;
  progress: number;
  seq: number;
  ts: number;
}

export interface ImagingModelCompleteEvent {
  modelName: string;
  modelIndex: number;
  totalModels: number;
  metrics: { accuracy?: number; f1Macro?: number };
  progress: number;
  seq: number;
  ts: number;
}

// ── Prédiction ────────────────────────────────────────────────────────────────

export interface ImagingPredictionResult {
  model_id: number;
  model_name: string;
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
}

// ── Liste d'images ────────────────────────────────────────────────────────────

export interface ImageClassInfo {
  name: string;
  count: number;
}

export interface ImageListResponse {
  classes: ImageClassInfo[];
  total_images: number;
  images_dir: string;
}

// ── Capacités ─────────────────────────────────────────────────────────────────

export interface ImagingCapabilities {
  supportedModels: ImagingModelName[];
  supportedTaskTypes: ImagingTaskType[];
  maxImageSize: number;
  minImageSize: number;
}

// ── Labels affichage ──────────────────────────────────────────────────────────

export const IMAGING_MODEL_LABELS: Record<ImagingModelName, string> = {
  resnet18:        "ResNet-18",
  resnet50:        "ResNet-50",
  resnet101:       "ResNet-101",
  efficientnet_b0: "EfficientNet-B0",
  efficientnet_b3: "EfficientNet-B3",
  vgg16:           "VGG-16",
  densenet121:     "DenseNet-121",
  simple_cnn:      "CNN Simple",
};

export const IMAGING_MODEL_DESCRIPTIONS: Record<ImagingModelName, string> = {
  resnet18:        "Léger, rapide. Idéal pour les datasets petits.",
  resnet50:        "Bon équilibre performance / vitesse. Recommandé.",
  resnet101:       "Plus profond, meilleur sur grands datasets.",
  efficientnet_b0: "Très efficace, petit modèle haute précision.",
  efficientnet_b3: "EfficientNet intermédiaire, excellent rapport.",
  vgg16:           "Architecture classique, facile à interpréter.",
  densenet121:     "Dense connections, bon pour l'imagerie médicale.",
  simple_cnn:      "Réseau convolutif simple, sans ImageNet. Rapide, adapté aux petits datasets.",
};
