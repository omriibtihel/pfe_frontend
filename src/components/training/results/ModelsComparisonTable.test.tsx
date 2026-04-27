import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ModelResult, TrainingSession } from '@/types';
import { columnLowerIsBetter, ModelsComparisonTable } from './ModelsComparisonTable';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeModel(
  id: string,
  modelType: string,
  rmse: number | null = null,
  mae: number | null = null,
): ModelResult {
  return {
    id,
    modelType,
    taskType: 'regression',
    primaryMetric: {
      name: 'rmse',
      value: rmse,
      displayName: 'RMSE',
      direction: 'lower_is_better',
      status: 'success',
    },
    metrics: {
      accuracy: null,
      f1: null,
      rocAuc: null,
      r2: null,
      rmse,
      mae,
    },
    trainScore: null,
    testScore: null,
    trainingTime: 1,
    isSaved: false,
    isActive: false,
    isCV: false,
    hasHoldoutTest: false,
    evaluationSource: {
      type: 'holdout_test',
      label: 'Test',
      isIndependentTest: true,
      nSamples: null,
    },
  } as unknown as ModelResult;
}

function makeSession(results: ModelResult[]): TrainingSession {
  return { results } as unknown as TrainingSession;
}

/** Returns model type names in their current rendered (sorted) order. */
function getRowOrder(): string[] {
  return Array.from(document.querySelectorAll('tbody span.font-semibold')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

// ── columnLowerIsBetter — unit tests ─────────────────────────────────────────

describe('columnLowerIsBetter', () => {
  it.each(['rmse', 'mae', 'mse', 'log_loss', 'brier_score'])(
    '%s → true (lower values are better)',
    (metric) => {
      expect(columnLowerIsBetter(metric)).toBe(true);
    },
  );

  it('mse is recognised as lower_is_better (was missing from the old local Set)', () => {
    expect(columnLowerIsBetter('mse')).toBe(true);
  });

  it('log_loss is recognised as lower_is_better (was missing from the old local Set)', () => {
    expect(columnLowerIsBetter('log_loss')).toBe(true);
  });

  it('brier_score is recognised as lower_is_better (was missing from the old local Set)', () => {
    expect(columnLowerIsBetter('brier_score')).toBe(true);
  });

  it('time → true (training time: shorter is better, handled explicitly)', () => {
    expect(columnLowerIsBetter('time')).toBe(true);
  });

  it.each(['accuracy', 'f1', 'rocAuc', 'r2'])(
    '%s → false (higher values are better)',
    (metric) => {
      expect(columnLowerIsBetter(metric)).toBe(false);
    },
  );
});

// ── ModelsComparisonTable — sort integration tests ───────────────────────────

describe('ModelsComparisonTable — sort behaviour', () => {
  it('regression: default sort is rmse ascending (lower is better — lower RMSE appears first)', () => {
    // Intentionally pass results in a scrambled order to prove sorting works
    const modelB = makeModel('b', 'ridge', 0.3);
    const modelA = makeModel('a', 'lasso', 0.1);
    const modelC = makeModel('c', 'svm', 0.2);

    render(
      <ModelsComparisonTable
        session={makeSession([modelB, modelA, modelC])}
        bestModel={null}
        isRegression
      />,
    );

    // Default: key='rmse', dir='asc' → lower values first
    expect(getRowOrder()).toEqual(['LASSO', 'SVM', 'RIDGE']);
  });

  it('regression: clicking the RMSE header once reverses to descending (higher RMSE first)', () => {
    const modelB = makeModel('b', 'ridge', 0.3);
    const modelA = makeModel('a', 'lasso', 0.1);
    const modelC = makeModel('c', 'svm', 0.2);

    render(
      <ModelsComparisonTable
        session={makeSession([modelB, modelA, modelC])}
        bestModel={null}
        isRegression
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /rmse/i }));

    // asc toggled to desc → higher RMSE first
    expect(getRowOrder()).toEqual(['RIDGE', 'SVM', 'LASSO']);
  });

  it('regression: MAE sorts ascending (lower is better) after two clicks', () => {
    // Clicking a new column defaults to desc; clicking again gives asc
    const modelB = makeModel('b', 'ridge', 0, 0.3);
    const modelA = makeModel('a', 'lasso', 0, 0.1);
    const modelC = makeModel('c', 'svm', 0, 0.2);

    render(
      <ModelsComparisonTable
        session={makeSession([modelB, modelA, modelC])}
        bestModel={null}
        isRegression
      />,
    );

    // First click on MAE: new key → dir defaults to 'desc' → higher MAE first
    fireEvent.click(screen.getByRole('button', { name: /mae/i }));
    expect(getRowOrder()).toEqual(['RIDGE', 'SVM', 'LASSO']);

    // Second click: toggles to 'asc' → lower MAE first
    fireEvent.click(screen.getByRole('button', { name: /mae/i }));
    expect(getRowOrder()).toEqual(['LASSO', 'SVM', 'RIDGE']);
  });

  it('regression: null RMSE values are pushed to the bottom of any sort direction', () => {
    const modelA = makeModel('a', 'lasso', 0.1);
    const modelNull = makeModel('n', 'missing', null); // no RMSE score
    const modelC = makeModel('c', 'svm', 0.2);

    render(
      <ModelsComparisonTable
        session={makeSession([modelNull, modelA, modelC])}
        bestModel={null}
        isRegression
      />,
    );

    // Default asc: finite values come before null
    const order = getRowOrder();
    expect(order[order.length - 1]).toBe('MISSING');
  });

  it('highlights the best model row with a trophy icon', () => {
    const modelA = makeModel('a', 'lasso', 0.1);
    const modelB = makeModel('b', 'ridge', 0.3);

    render(
      <ModelsComparisonTable
        session={makeSession([modelA, modelB])}
        bestModel={modelA}
        isRegression
      />,
    );

    expect(screen.getByLabelText('Meilleur modèle')).toBeInTheDocument();
  });
});
