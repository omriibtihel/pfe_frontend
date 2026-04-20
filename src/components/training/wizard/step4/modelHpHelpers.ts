import type {
  ModelHyperparamScalar,
  ModelHyperparamValue,
  TrainingHyperparamFieldSchema,
} from "@/types";

export function normalizeModelKey(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function toDisplayText(value: ModelHyperparamValue | undefined, fallback: ModelHyperparamValue): string {
  const source = value !== undefined ? value : fallback;
  if (Array.isArray(source)) return source.map((x) => String(x)).join(", ");
  if (source === null || source === undefined) return "";
  return String(source);
}

export function parseScalarToken(rawToken: string, fieldSchema: TrainingHyperparamFieldSchema): ModelHyperparamScalar {
  const token = String(rawToken ?? "").trim();
  const lowered = token.toLowerCase();
  const fieldType = String(fieldSchema?.type ?? "").toLowerCase();

  if (fieldType === "int_or_none" && (lowered === "none" || lowered === "null")) {
    return null;
  }
  if (fieldType === "int" || fieldType === "int_or_none") {
    const n = Number.parseInt(token, 10);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "float") {
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "float_or_enum") {
    const allowed = (fieldSchema.enum ?? []).map((x) => String(x).toLowerCase());
    if (allowed.includes(lowered)) return lowered;
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "enum") {
    return lowered;
  }
  return token;
}

export function parseFieldValue(rawInput: string, fieldSchema: TrainingHyperparamFieldSchema, allowList: boolean): ModelHyperparamValue | undefined {
  const text = String(rawInput ?? "").trim();
  if (!text) return undefined;

  if (allowList && text.includes(",")) {
    const parts = text
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.map((token) => parseScalarToken(token, fieldSchema));
    }
  }
  return parseScalarToken(text, fieldSchema);
}

/** Convert a grid_value to a string key usable in a Select / as chip id. */
export function gridValKey(v: number | string | null): string {
  return v === null ? "__null__" : String(v);
}

/** Convert the string key back to the typed scalar. */
export function gridValFromKey(key: string, fieldSchema: TrainingHyperparamFieldSchema): ModelHyperparamScalar {
  if (key === "__null__") return null;
  return parseScalarToken(key, fieldSchema);
}

/** Human-friendly label mapping for technical hyperparameter names. */
export const FRIENDLY_LABEL: Record<string, string> = {
  n_estimators: "Nombre d'arbres",
  max_depth: "Profondeur maximale",
  min_samples_split: "Séparation minimale",
  min_samples_leaf: "Feuilles minimales",
  C: "Force de régularisation (C)",
  gamma: "Gamma (SVM)",
  kernel: "Noyau (SVM)",
  n_neighbors: "Nombre de voisins",
  learning_rate: "Taux d'apprentissage",
  max_iter: "Iterations maximales",
  class_weight: "Poids des classes",
  alpha: "Régularisation (alpha)",
  max_features: "Variables par division",
  subsample: "Fraction de données",
  colsample_bytree: "Fraction de variables (arbre)",
  min_child_weight: "Poids minimal d'un nœud",
  reg_alpha: "Régularisation L1",
  reg_lambda: "Régularisation L2",
  num_leaves: "Feuilles par arbre",
  var_smoothing: "Lissage de variance",
  hidden_layer_sizes: "Architecture (couches)",
  activation: "Fonction d'activation",
  learning_rate_init: "Taux d'apprentissage",
  l1_ratio: "Ratio L1/L2",
};
