import { _fmt } from './helpers';

export function PredictionBadge({
  prediction,
  isClassification,
}: {
  prediction: string | number;
  isClassification: boolean;
}) {
  const val = String(prediction);
  if (!isClassification) {
    return <span className="font-mono text-sm font-semibold">{_fmt(prediction)}</span>;
  }
  const lower = val.toLowerCase();
  const isPositive = lower === '1' || lower === 'true' || lower === 'yes' || lower === 'oui' || lower === 'positive';
  const isNegative = lower === '0' || lower === 'false' || lower === 'no' || lower === 'non' || lower === 'negative';
  const cls = isPositive
    ? 'bg-red-50 text-red-700 border-red-400/50 dark:bg-red-950/30 dark:text-red-300'
    : isNegative
      ? 'bg-emerald-50 text-emerald-700 border-emerald-400/50 dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'bg-muted text-foreground border-border';
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{val}</span>;
}
