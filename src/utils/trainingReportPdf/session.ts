import type { ModelResult, TrainingSession } from '@/types';
import { safeN } from './formatters';

// ── Helpers session ───────────────────────────────────────────────────────────
export function bestModel(session: TrainingSession): ModelResult | null {
  if (!session.results?.length) return null;
  return session.results.reduce((b, c) =>
    (safeN(c.testScore) ?? -Infinity) > (safeN(b.testScore) ?? -Infinity) ? c : b,
  );
}

export function duration(session: TrainingSession): string {
  if (!session.startedAt || !session.completedAt) return 'N/A';
  const s = Math.round(
    (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
  );
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}

export function splitLabel(session: TrainingSession): string {
  const { splitMethod, kFolds, trainRatio, valRatio, testRatio } = session.config;
  if (splitMethod === 'kfold')
    return `Validation croisée K-Fold (k = ${kFolds})`;
  if (splitMethod === 'stratified_kfold')
    return `Validation croisée stratifiée K-Fold (k = ${kFolds})`;
  return `Holdout — Entraînement ${trainRatio} % / Validation ${valRatio} % / Test ${testRatio} %`;
}
