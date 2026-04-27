import { describe, expect, it } from 'vitest';
import {
  isBetter,
  metricDirection,
  selectBestModel,
  formatMetricValue,
} from './metricUtils';

// ── metricDirection ───────────────────────────────────────────────────────────

describe('metricDirection', () => {
  it('returns lower_is_better for rmse, mae, mse, log_loss, brier_score', () => {
    for (const name of ['rmse', 'mae', 'mse', 'log_loss', 'brier_score']) {
      expect(metricDirection(name)).toBe('lower_is_better');
    }
  });

  it('returns higher_is_better for accuracy, f1, roc_auc and unknown metrics', () => {
    for (const name of ['accuracy', 'f1', 'roc_auc', 'r2', 'custom_metric']) {
      expect(metricDirection(name)).toBe('higher_is_better');
    }
  });

  it('is case-insensitive', () => {
    expect(metricDirection('RMSE')).toBe('lower_is_better');
    expect(metricDirection('Accuracy')).toBe('higher_is_better');
  });
});

// ── isBetter ─────────────────────────────────────────────────────────────────

describe('isBetter', () => {
  it('returns true when challenger > champion for higher_is_better metric', () => {
    expect(isBetter('accuracy', 0.9, 0.8)).toBe(true);
  });

  it('returns false when challenger < champion for higher_is_better metric', () => {
    expect(isBetter('accuracy', 0.7, 0.8)).toBe(false);
  });

  it('returns true when challenger < champion for lower_is_better metric', () => {
    expect(isBetter('rmse', 0.1, 0.2)).toBe(true);
  });

  it('returns false when challenger > champion for lower_is_better metric', () => {
    expect(isBetter('rmse', 0.3, 0.2)).toBe(false);
  });
});

// ── selectBestModel ───────────────────────────────────────────────────────────

describe('selectBestModel', () => {
  it('returns undefined for an empty array', () => {
    expect(selectBestModel([])).toBeUndefined();
  });

  it('returns undefined when all testScores are null', () => {
    const models = [
      { testScore: null, primaryMetric: { name: 'accuracy' } },
      { testScore: null, primaryMetric: { name: 'accuracy' } },
    ];
    expect(selectBestModel(models)).toBeUndefined();
  });

  it('returns undefined when all testScores are non-finite', () => {
    const models = [
      { testScore: NaN, primaryMetric: { name: 'accuracy' } },
      { testScore: Infinity, primaryMetric: { name: 'accuracy' } },
    ];
    expect(selectBestModel(models)).toBeUndefined();
  });

  it('returns null when models carry different primaryMetric names and no sessionPrimaryMetric is given', () => {
    const models = [
      { testScore: 0.9, primaryMetric: { name: 'accuracy' } },
      { testScore: 0.7, primaryMetric: { name: 'f1' } },
    ];
    expect(selectBestModel(models)).toBeNull();
  });

  it('returns null for three models with three different metrics (not just two)', () => {
    const models = [
      { testScore: 0.9, primaryMetric: { name: 'accuracy' } },
      { testScore: 0.85, primaryMetric: { name: 'f1' } },
      { testScore: 0.1, primaryMetric: { name: 'rmse' } },
    ];
    expect(selectBestModel(models)).toBeNull();
  });

  it('picks the highest score for a higher_is_better metric when all models share it', () => {
    const a = { testScore: 0.7, primaryMetric: { name: 'accuracy' } };
    const b = { testScore: 0.9, primaryMetric: { name: 'accuracy' } };
    const c = { testScore: 0.8, primaryMetric: { name: 'accuracy' } };
    expect(selectBestModel([a, b, c])).toBe(b);
  });

  it('picks the lowest score for a lower_is_better metric when all models share it', () => {
    const a = { testScore: 0.3, primaryMetric: { name: 'rmse' } };
    const b = { testScore: 0.1, primaryMetric: { name: 'rmse' } };
    const c = { testScore: 0.2, primaryMetric: { name: 'rmse' } };
    expect(selectBestModel([a, b, c])).toBe(b);
  });

  it('uses sessionPrimaryMetric to rank even when model metrics are mixed', () => {
    const a = { testScore: 0.7, primaryMetric: { name: 'accuracy' } };
    const b = { testScore: 0.9, primaryMetric: { name: 'f1' } };
    const best = selectBestModel([a, b], 'accuracy');
    expect(best).toBe(b);
    expect(best?.testScore).toBe(0.9);
  });

  it('sessionPrimaryMetric takes precedence over per-model primaryMetric for ranking direction', () => {
    // rmse is lower_is_better — the model with 0.1 should win
    const a = { testScore: 0.5, primaryMetric: { name: 'accuracy' } };
    const b = { testScore: 0.1, primaryMetric: { name: 'accuracy' } };
    expect(selectBestModel([a, b], 'rmse')).toBe(b);
  });

  it('skips null testScores and still ranks the remaining models', () => {
    const a = { testScore: null, primaryMetric: { name: 'accuracy' } };
    const b = { testScore: 0.6, primaryMetric: { name: 'accuracy' } };
    const c = { testScore: 0.8, primaryMetric: { name: 'accuracy' } };
    expect(selectBestModel([a, b, c])).toBe(c);
  });

  it('handles a single valid model correctly', () => {
    const model = { testScore: 0.75, primaryMetric: { name: 'f1' } };
    expect(selectBestModel([model])).toBe(model);
  });

  it('falls back to accuracy when all primaryMetric fields are absent and no sessionPrimaryMetric is given', () => {
    const a = { testScore: 0.6, primaryMetric: null };
    const b = { testScore: 0.8, primaryMetric: null };
    // Both models lack a metric name — treated as single-metric group, ranked as accuracy (higher_is_better)
    expect(selectBestModel([a, b])).toBe(b);
  });
});

// ── formatMetricValue ─────────────────────────────────────────────────────────

describe('formatMetricValue', () => {
  it('returns — for null', () => {
    expect(formatMetricValue(null, 'accuracy')).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(formatMetricValue(undefined, 'accuracy')).toBe('—');
  });

  it('returns — for NaN', () => {
    expect(formatMetricValue(NaN, 'accuracy')).toBe('—');
  });

  it('formats higher_is_better metrics as percentage with 1 decimal', () => {
    expect(formatMetricValue(0.876, 'accuracy')).toBe('87.6%');
    expect(formatMetricValue(0.9, 'f1')).toBe('90.0%');
  });

  it('formats lower_is_better metrics as 4-decimal raw value', () => {
    expect(formatMetricValue(0.1234, 'rmse')).toBe('0.1234');
    expect(formatMetricValue(0.05678, 'mae')).toBe('0.0568');
  });

  it('treats unknown metric names as higher_is_better', () => {
    expect(formatMetricValue(0.5, 'custom')).toBe('50.0%');
  });
});
