import type { ModelResult, TrainingSession } from '@/types';
import { bestModel } from './session';
import { EMPTY_ENRICHMENT, fetchModelEnrichments, type ModelEnrichment } from './enrichment';

/**
 * Pre-computed values shared by every PDF section.
 *
 * Sections receive a frozen context — they never re-fetch, never recompute
 * `best`, never inspect `session.config.taskType` themselves. This keeps each
 * section file pure relative to the report inputs and trivially testable.
 */
export type TrainingReportContext = {
  session: TrainingSession;
  projectId: string;
  isReg: boolean;
  best: ModelResult | null;
  bestEnrichment: ModelEnrichment | null;
  enrichments: Map<string, ModelEnrichment>;
  enrichmentFor: (id: string) => ModelEnrichment;
  genDate: string;
};

export async function buildTrainingReportContext(
  session: TrainingSession,
  projectId: string,
): Promise<TrainingReportContext> {
  const enrichments = await fetchModelEnrichments(
    projectId,
    session.id,
    (session.results ?? []).map((r) => r.id),
  );
  const enrichmentFor = (id: string): ModelEnrichment => enrichments.get(id) ?? EMPTY_ENRICHMENT;
  const best = bestModel(session);

  return {
    session,
    projectId,
    isReg: session.config.taskType === 'regression',
    best,
    bestEnrichment: best ? enrichmentFor(best.id) : null,
    enrichments,
    enrichmentFor,
    genDate: new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}
