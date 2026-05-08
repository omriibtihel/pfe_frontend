export type ModelHyperparamScalar = string | number | boolean | null;
export type ModelHyperparamValue = ModelHyperparamScalar | ModelHyperparamScalar[];
export type ModelHyperparams = Record<string, Record<string, ModelHyperparamValue>>;

export interface TrainingHyperparamFieldSchema {
  type: 'int' | 'int_or_none' | 'float' | 'float_or_enum' | 'enum' | 'enum_or_null' | 'str';
  default: ModelHyperparamValue;
  min?: number;
  max?: number;
  gt?: number;
  ge?: number;
  lt?: number;
  le?: number;
  enum?: string[];
  /** Preset values from the parameter grid — rendered as a Select (fixed mode) or toggleable chips (search mode). */
  grid_values?: (number | string | null)[];
  /** Task types for which this field is applicable (e.g. ['classification']). */
  supported_in?: string[];
  help?: string;
}

export interface ClassWeightModelCapability {
  supported: boolean;
  supportedIn: string[];
  options: Array<string | null>;
  default: string | null;
  help: string;
}

/** Discrete list of candidate values for GridSearch. */
export interface HpGrid {
  kind: "grid";
  values: ModelHyperparamScalar[];
}

/** Continuous interval for RandomSearch / HalvingRandom. */
export interface HpRange {
  kind: "range";
  min: number;
  max: number;
  distribution?: "uniform" | "log_uniform";
  /** For int_or_none fields: also sample None (no upper limit). */
  includeNull?: boolean;
}

/** Union of all HP value representations used in search mode. */
export type ModelHyperparamSpec = ModelHyperparamScalar | HpGrid | HpRange;
