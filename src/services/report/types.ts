import type { DatasetOut, DatasetOverviewOut, DatasetProfileOut, CorrelationOut } from '../databaseService';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ReportSections = {
  executiveSummary: boolean;
  generalInfo: boolean;
  dataQuality: boolean;
  columnAnalysis: boolean;
  missingValues: boolean;
  numericStats: boolean;
  targetAnalysis: boolean;
  correlations: boolean;
  recommendations: boolean;
  conclusion: boolean;
};

export const DEFAULT_SECTIONS: ReportSections = {
  executiveSummary: true,
  generalInfo: true,
  dataQuality: true,
  columnAnalysis: true,
  missingValues: true,
  numericStats: true,
  targetAnalysis: true,
  correlations: false,
  recommendations: true,
  conclusion: true,
};

export type ReportInput = {
  dataset: DatasetOut;
  overview: DatasetOverviewOut;
  profile: DatasetProfileOut;
  targetColumn: string | null;
  correlationData?: CorrelationOut | null;
  sections: ReportSections;
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal types (shared across analysis + pdf modules)
// ─────────────────────────────────────────────────────────────────────────────

export type RGB = [number, number, number];

export type ColumnProfile = DatasetProfileOut['profiles'][number];

export type MLReadiness = {
  level: 'ready' | 'ready_with_prep' | 'not_ready';
  blockers: string[];
  warnings: string[];
};

export type TargetAnalysis = {
  profile: ColumnProfile;
  taskType: string;
  effectiveUnique: number | undefined;
  classDistribution: Array<{ value: string; count: number }>;
  imbalanceRatio: number | null;
  dominantClass: string | null;
  minorityClass: string | null;
  /**
   * true when class counts for a numeric binary target were *estimated* from
   * the column mean rather than read from exact value_counts.
   */
  inferredFromMean: boolean;
};

/**
 * Pre-computed aggregates passed to every section so each renderer stays pure.
 */
export type ReportContext = {
  totalRows: number;
  totalCols: number;
  totalNulls: number;
  completeness: number;
  numericProfiles: ColumnProfile[];
  numericCount: number;
  catCount: number;
  missingEntries: Array<[string, number]>;
  outlierCols: ColumnProfile[];
  suspectedIds: string[];
  constantCols: string[];
  highCardinalityCols: string[];
  zeroSuspects: string[];
  parasiteCols: ColumnProfile[];
  heavyMissingCols: string[];
  targetAnalysis: TargetAnalysis | null;
  mlReadiness: MLReadiness;
};
