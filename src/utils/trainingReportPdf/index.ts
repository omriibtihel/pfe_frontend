/**
 * Training session PDF report — pure async function.
 * Orchestrates: build context → cover → sections 1–5 → footers → save.
 *
 * Implementation lives under this folder, split by responsibility:
 *   - constants.ts, formatters.ts, quality.ts, drawing.ts  (rendering primitives)
 *   - session.ts, cvStability.ts                           (data helpers)
 *   - enrichment.ts                                        (per-model fetch)
 *   - context.ts                                           (TrainingReportContext)
 *   - sections/*.ts                                        (one file per section)
 */
import jsPDF from 'jspdf';
import type { TrainingSession } from '@/types';
import { buildTrainingReportContext } from './context';
import { footers } from './drawing';
import { renderComparison } from './sections/comparison';
import { renderCover } from './sections/cover';
import { renderDetailedAnalysis } from './sections/detailedAnalysis';
import { renderMetricsGuide } from './sections/metricsGuide';
import { renderParameters } from './sections/parameters';
import { renderWarnings } from './sections/warnings';

export async function generateTrainingReportPdf(
  session: TrainingSession,
  projectId: string,
): Promise<void> {
  if (!session.results?.length) {
    throw new Error('Aucun résultat disponible pour générer le rapport PDF.');
  }

  const ctx = await buildTrainingReportContext(session, projectId);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = renderCover(doc, ctx);
  y = renderParameters(doc, ctx, y);
  y = renderComparison(doc, ctx, y);
  y = renderDetailedAnalysis(doc, ctx, y);
  y = renderMetricsGuide(doc, ctx, y);
  renderWarnings(doc, ctx, y);

  footers(doc, ctx.genDate);
  doc.save(`rapport_session_${session.id}.pdf`);
}
