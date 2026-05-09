/**
 * Dataset PDF report — pure function entry point.
 * Orchestrates: build context → render cover → render each enabled section → footers → save.
 */
import { buildReportContext } from './analysis/context';
import { PdfBuilder } from './pdf/PdfBuilder';
import { renderColumnAnalysis } from './pdf/sections/columnAnalysis';
import { renderConclusion } from './pdf/sections/conclusion';
import { renderCorrelations } from './pdf/sections/correlations';
import { renderDataQuality } from './pdf/sections/dataQuality';
import { renderExecutiveSummary } from './pdf/sections/executiveSummary';
import { renderGeneralInfo } from './pdf/sections/generalInfo';
import { renderMissingValues } from './pdf/sections/missingValues';
import { renderNumericStats } from './pdf/sections/numericStats';
import { renderRecommendations } from './pdf/sections/recommendations';
import { renderTargetAnalysis } from './pdf/sections/targetAnalysis';
import type { ReportInput, RGB } from './types';

export type { ReportInput, ReportSections } from './types';
export { DEFAULT_SECTIONS } from './types';

export function generateDatasetReport(input: ReportInput): void {
  const { dataset, profile, targetColumn, correlationData, sections } = input;
  const ctx = buildReportContext(input);

  const pdf = new PdfBuilder(dataset);

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  const completenessColor: RGB =
    ctx.completeness >= 95
      ? [74, 222, 128]
      : ctx.completeness >= 80
        ? [251, 191, 36]
        : [248, 113, 113];

  pdf.drawCoverPage({
    completeness: ctx.completeness,
    completenessColor,
    mlReadiness: ctx.mlReadiness,
    totalRows: ctx.totalRows,
    totalCols: ctx.totalCols,
  });

  // ── SECTIONS ────────────────────────────────────────────────────────────────
  if (sections.executiveSummary) renderExecutiveSummary(pdf, ctx, targetColumn);
  if (sections.generalInfo) renderGeneralInfo(pdf, ctx, dataset, targetColumn);
  if (sections.dataQuality) renderDataQuality(pdf, ctx);
  if (sections.columnAnalysis)
    renderColumnAnalysis(
      pdf,
      ctx,
      profile.profiles.map((p) => p.name),
    );
  if (sections.missingValues) renderMissingValues(pdf, ctx, profile);
  if (sections.numericStats) renderNumericStats(pdf, ctx);
  if (sections.targetAnalysis) renderTargetAnalysis(pdf, ctx, targetColumn);
  if (sections.correlations && correlationData) renderCorrelations(pdf, correlationData);
  if (sections.recommendations) renderRecommendations(pdf, ctx, targetColumn);
  if (sections.conclusion) renderConclusion(pdf, ctx, targetColumn);

  // ── FOOTERS & SAVE ──────────────────────────────────────────────────────────
  pdf.drawFooters();
  pdf.save();
}
