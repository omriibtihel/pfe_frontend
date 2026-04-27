/**
 * Tests for the CV stability section of trainingReportPdf.
 *
 * Covers:
 *   1. Unit tests for buildCvStabilityRows — verifies extraction from
 *      ModelResultDetail.analysis.crossValidation without constructing a PDF.
 *   2. Integration test — generates a PDF for a k-fold session fixture with
 *      a mocked trainingService and asserts the CV stability section is non-empty
 *      (autoTable receives ≥ 1 row with the mean ± std column populated).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCvStabilityRows } from './cvStability';
import type { CvMetricsSummary } from '@/types/training/results';

// ── Mocks — hoisted so vi.mock factories can reference them ───────────────────

const { mockDoc, autoTableCalls } = vi.hoisted(() => {
  const calls: unknown[][] = [];
  const doc = {
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setLineWidth: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    circle: vi.fn(),
    line: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    getTextWidth: vi.fn(() => 20),
    splitTextToSize: vi.fn((s: string) => [s]),
    save: vi.fn(),
    setLineDashPattern: vi.fn(),
    lastAutoTable: { finalY: 50 },
  };
  return { mockDoc: doc, autoTableCalls: calls };
});

vi.mock('jspdf', () => ({ default: vi.fn(() => mockDoc) }));

vi.mock('jspdf-autotable', () => ({
  default: vi.fn((doc: Record<string, unknown>, opts: unknown) => {
    autoTableCalls.push(opts);
    doc['lastAutoTable'] = { finalY: 80 };
  }),
}));

vi.mock('@/services/trainingService', () => ({
  trainingService: {
    getModelDetails: vi.fn(),
    getModelExplainability: vi.fn().mockResolvedValue(null),
    getModelCurves: vi.fn().mockResolvedValue(null),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const kfoldCvSummary: CvMetricsSummary = {
  mean: { accuracy: 0.85, f1: 0.82, roc_auc: 0.90 },
  std:  { accuracy: 0.03, f1: 0.04, roc_auc: 0.02 },
  min:  { accuracy: 0.80, f1: 0.77, roc_auc: 0.87 },
  max:  { accuracy: 0.90, f1: 0.88, roc_auc: 0.93 },
  n_folds_ok: 5,
};

// ── Unit tests: buildCvStabilityRows ─────────────────────────────────────────

describe('buildCvStabilityRows', () => {
  it('produces one row per metric in mean', () => {
    const rows = buildCvStabilityRows(kfoldCvSummary, false);
    expect(rows).toHaveLength(3);
  });

  it('each row has 4 columns: label, mean±std, min, max', () => {
    const rows = buildCvStabilityRows(kfoldCvSummary, false);
    for (const row of rows) {
      expect(row).toHaveLength(4);
    }
  });

  it('mean±std column contains ±', () => {
    const rows = buildCvStabilityRows(kfoldCvSummary, false);
    for (const row of rows) {
      expect(row[1]).toContain('±');
    }
  });

  it('min and max columns are non-blank when data is present', () => {
    const rows = buildCvStabilityRows(kfoldCvSummary, false);
    for (const row of rows) {
      expect(row[2]).not.toBe('—');
      expect(row[3]).not.toBe('—');
    }
  });

  it('min < max for each metric', () => {
    // Values are formatted as percentages — parse them back to compare.
    const rows = buildCvStabilityRows(kfoldCvSummary, false);
    for (const row of rows) {
      const minVal = parseFloat(row[2]);
      const maxVal = parseFloat(row[3]);
      expect(minVal).toBeLessThanOrEqual(maxVal);
    }
  });

  it('returns empty array when mean is empty', () => {
    const rows = buildCvStabilityRows(
      { mean: {}, std: {}, min: {}, max: {}, n_folds_ok: 0 },
      false,
    );
    expect(rows).toHaveLength(0);
  });

  it('regression mode formats with num4 (no % sign)', () => {
    const rows = buildCvStabilityRows(
      { mean: { r2: 0.85 }, std: { r2: 0.03 }, min: { r2: 0.80 }, max: { r2: 0.90 }, n_folds_ok: 3 },
      true,
    );
    expect(rows[0][1]).not.toContain('%');
    expect(rows[0][2]).not.toContain('%');
    expect(rows[0][3]).not.toContain('%');
  });

  it('classification mode formats with pct (% sign present)', () => {
    const rows = buildCvStabilityRows(kfoldCvSummary, false);
    for (const row of rows) {
      expect(row[1]).toContain('%');
    }
  });

  it('missing std/min/max cells render as —', () => {
    const rows = buildCvStabilityRows(
      { mean: { accuracy: 0.8 }, std: {}, min: {}, max: {}, n_folds_ok: 1 },
      false,
    );
    expect(rows[0][1]).toContain('—'); // std part
    expect(rows[0][2]).toBe('—');     // min
    expect(rows[0][3]).toBe('—');     // max
  });

  it('maps known backend keys to readable labels', () => {
    const rows = buildCvStabilityRows(
      { mean: { roc_auc: 0.9 }, std: {}, min: {}, max: {}, n_folds_ok: 3 },
      false,
    );
    expect(rows[0][0]).toBe('ROC AUC');
  });
});

// ── Integration test: generateTrainingReportPdf for k-fold session ────────────

describe('generateTrainingReportPdf — k-fold CV stability section', () => {
  beforeEach(() => {
    autoTableCalls.length = 0;
    vi.clearAllMocks();
    mockDoc.getNumberOfPages.mockReturnValue(1);
    mockDoc.getTextWidth.mockReturnValue(20);
    mockDoc.splitTextToSize.mockImplementation((s: string) => [s]);
    mockDoc.lastAutoTable = { finalY: 50 };
  });

  it('CV stability section is non-empty for a k-fold classification session', async () => {
    const { trainingService } = await import('@/services/trainingService');

    // Return a ModelResultDetail with populated cvSummary
    (trainingService.getModelDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      // ModelResult base fields
      id: 'model-1',
      modelType: 'logisticregression',
      metrics: { accuracy: 0.85, rocAuc: 0.90, f1: 0.82 },
      trainScore: 0.88,
      testScore: 0.85,
      testLabel: 'CV validation (moyenne des folds)',
      trainingTime: 2.3,
      isSaved: false,
      isActive: false,
      isCV: true,
      hasHoldoutTest: false,
      testIsCvMean: true,
      evaluationSource: { type: 'cv_mean', label: 'CV mean', isIndependentTest: false, nSamples: null },
      primaryMetric: { name: 'accuracy', displayName: 'Accuracy', direction: 'higher_is_better' },
      // ModelResultDetail fields
      metricsDetailed: null,
      hyperparams: null,
      analysis: {
        crossValidation: {
          kFoldsUsed: 5,
          nestedCv: false,
          cvSummary: kfoldCvSummary,
          cvFoldResults: null,
        },
        thresholding: null,
        gridSearch: null,
        residualAnalysis: null,
        confusionMatrix: null,
        classDistribution: null,
        baselineMajority: null,
        metricsWarnings: [],
      },
      balancing: null,
    });

    const { generateTrainingReportPdf } = await import('./index');

    const session = {
      id: 'sess-1',
      projectId: 'proj-1',
      status: 'completed',
      progress: 100,
      createdAt: '2024-01-01T00:00:00Z',
      config: {
        targetColumn: 'label',
        taskType: 'classification',
        models: ['logisticregression'],
        metrics: ['accuracy'],
        splitMethod: 'kfold',
        kFolds: 5,
        trainRatio: 80,
        valRatio: 20,
        testRatio: 0,
        useGridSearch: false,
        balancing: { strategy: 'none' },
        preprocessing: {
          defaults: {
            numericImputation: 'none',
            numericScaling: 'none',
            categoricalImputation: 'none',
            categoricalEncoding: 'onehot',
          },
        },
      },
      results: [
        {
          id: 'model-1',
          modelType: 'logisticregression',
          metrics: { accuracy: 0.85, rocAuc: 0.90, f1: 0.82 },
          trainScore: 0.88,
          testScore: 0.85,
          testLabel: 'CV validation (moyenne des folds)',
          trainingTime: 2.3,
          isSaved: false,
          isActive: false,
          isCV: true,
          hasHoldoutTest: false,
          testIsCvMean: true,
          evaluationSource: { type: 'cv_mean', label: 'CV mean', isIndependentTest: false, nSamples: null },
          primaryMetric: { name: 'accuracy', displayName: 'Accuracy', direction: 'higher_is_better' },
        },
      ],
    };

    await generateTrainingReportPdf(session as any, 'proj-1');

    // The CV stability autoTable call has a head row and body rows with ±
    const cvTableCall = autoTableCalls.find(
      (opts: any) => Array.isArray(opts.body) && opts.body.some((row: string[]) => row[1]?.includes('±')),
    );

    expect(cvTableCall).toBeDefined();
    const rows = (cvTableCall as any).body as string[][];
    expect(rows.length).toBeGreaterThan(0);
    // Verify 4-column structure (label, mean±std, min, max)
    expect(rows[0]).toHaveLength(4);
    // Verify the header row is present
    expect((cvTableCall as any).head).toEqual([['Métrique', 'Moyenne  ±  Écart-type', 'Min', 'Max']]);
  });

  it('fallback renders r.metrics when detail fetch fails', async () => {
    const { trainingService } = await import('@/services/trainingService');
    (trainingService.getModelDetails as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    const { generateTrainingReportPdf } = await import('./index');

    const session = {
      id: 'sess-2',
      projectId: 'proj-1',
      status: 'completed',
      progress: 100,
      createdAt: '2024-01-01T00:00:00Z',
      config: {
        targetColumn: 'label',
        taskType: 'classification',
        models: ['logisticregression'],
        metrics: ['accuracy'],
        splitMethod: 'kfold',
        kFolds: 5,
        trainRatio: 80,
        valRatio: 20,
        testRatio: 0,
        useGridSearch: false,
        balancing: { strategy: 'none' },
        preprocessing: {
          defaults: {
            numericImputation: 'none',
            numericScaling: 'none',
            categoricalImputation: 'none',
            categoricalEncoding: 'onehot',
          },
        },
      },
      results: [
        {
          id: 'model-1',
          modelType: 'logisticregression',
          metrics: { accuracy: 0.85, rocAuc: 0.90, f1: 0.82 },
          trainScore: 0.88,
          testScore: 0.85,
          testLabel: 'CV validation (moyenne des folds)',
          trainingTime: 2.3,
          isSaved: false,
          isActive: false,
          isCV: true,
          hasHoldoutTest: false,
          testIsCvMean: true,
          evaluationSource: { type: 'cv_mean', label: 'CV mean', isIndependentTest: false, nSamples: null },
          primaryMetric: { name: 'accuracy', displayName: 'Accuracy', direction: 'higher_is_better' },
        },
      ],
    };

    await generateTrainingReportPdf(session as any, 'proj-1');

    // When detail fails, the fallback autoTable call has body rows with metric values but NO ±
    // At least one autoTable call must have non-empty rows (the fallback section)
    const nonEmptyCall = autoTableCalls.find(
      (opts: any) => Array.isArray(opts.body) && opts.body.length > 0,
    );
    expect(nonEmptyCall).toBeDefined();
    // The fallback section should not have a 4-column structure (only 2 columns: label + value)
    const fallbackRows = (nonEmptyCall as any).body as string[][];
    // All rows in the fallback are 2-column [label, value] — not 4-column
    expect(fallbackRows.every((r) => r.length === 2)).toBe(true);
  });
});
