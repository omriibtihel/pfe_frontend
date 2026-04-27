import type { CvMetricsSummary } from '@/types/training/results';
import { metricLabel, pct, num4 } from './formatters';

/**
 * Converts a CvMetricsSummary into table rows for the PDF CV stability section.
 * Each row: [metric label, mean ± std, min, max]
 *
 * Exported as a pure function so unit tests can verify the extraction logic
 * without constructing a jsPDF document.
 */
export function buildCvStabilityRows(
  cvSummary: CvMetricsSummary,
  isReg: boolean,
): string[][] {
  const fmt = (v: number | null | undefined): string =>
    v != null ? (isReg ? num4(v) : pct(v)) : '—';

  return Object.entries(cvSummary.mean ?? {})
    .filter(([, v]) => v != null)
    .map(([k, mv]) => {
      const sv = (cvSummary.std ?? {})[k];
      const minV = (cvSummary.min ?? {})[k];
      const maxV = (cvSummary.max ?? {})[k];
      return [
        metricLabel(k),
        `${fmt(mv as number)}  ±  ${fmt(sv)}`,
        fmt(minV),
        fmt(maxV),
      ];
    });
}
