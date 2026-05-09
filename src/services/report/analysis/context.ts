import type { ReportContext, ReportInput } from '../types';
import {
  detectConstant,
  detectHighCardinality,
  detectOutlierCols,
  detectSuspectedIds,
  detectZeroSuspects,
} from './detectors';
import { computeMLReadiness } from './mlReadiness';
import { analyzeTarget } from './target';

/**
 * Compute every aggregate the PDF sections rely on, in one pass.
 * Each section reads from the resulting `ReportContext` — they never
 * recompute or filter the raw profile themselves.
 */
export function buildReportContext(input: ReportInput): ReportContext {
  const { overview, profile, targetColumn } = input;

  const totalRows = overview.shape.rows;
  const totalCols = overview.shape.cols;
  const totalNulls = Object.values(overview.missing).reduce((a, b) => a + b, 0);
  const completeness =
    totalRows * totalCols > 0 ? Math.round((1 - totalNulls / (totalRows * totalCols)) * 100) : 100;

  const numericProfiles = profile.profiles.filter((p) => p.kind === 'numeric' && p.numeric);
  const numericCount = numericProfiles.length;
  const catCount = profile.profiles.filter((p) => p.kind === 'categorical' || p.kind === 'text').length;
  const missingEntries: Array<[string, number]> = Object.entries(overview.missing)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  const outlierCols = detectOutlierCols(profile.profiles);
  const suspectedIds = detectSuspectedIds(profile.profiles);
  const constantCols = detectConstant(profile.profiles);
  const highCardinalityCols = detectHighCardinality(profile.profiles);
  const zeroSuspects = detectZeroSuspects(profile.profiles);
  const parasiteCols = profile.profiles.filter((p) => p.parasites && p.parasites.count > 0);
  const heavyMissingCols = missingEntries
    .filter(([, count]) => (count / totalRows) * 100 >= 15)
    .map(([col]) => col);

  const targetAnalysis = targetColumn ? analyzeTarget(targetColumn, profile.profiles, totalRows) : null;

  const mlReadiness = computeMLReadiness({
    completeness,
    targetColumn,
    imbalanceRatio: targetAnalysis?.imbalanceRatio ?? null,
    suspectedIds,
    constantCols,
    heavyMissingCols,
    outlierCols,
    zeroSuspects,
    parasiteCols: parasiteCols.map((p) => p.name),
  });

  return {
    totalRows,
    totalCols,
    totalNulls,
    completeness,
    numericProfiles,
    numericCount,
    catCount,
    missingEntries,
    outlierCols,
    suspectedIds,
    constantCols,
    highCardinalityCols,
    zeroSuspects,
    parasiteCols,
    heavyMissingCols,
    targetAnalysis,
    mlReadiness,
  };
}
