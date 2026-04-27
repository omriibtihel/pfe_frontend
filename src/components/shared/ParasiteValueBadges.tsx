import { AlertCircle } from 'lucide-react';

interface Props {
  count: number;
  distinct: string[];
  convertible_ratio: number;
}

export function ParasiteValueBadges({ count, distinct, convertible_ratio }: Props) {
  return (
    <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
          Valeurs suspectes — {count} occurrence{count > 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {distinct.map((v) => (
          <span
            key={v}
            className="inline-flex items-center rounded-md bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 px-2 py-0.5 text-xs font-mono font-semibold text-red-700 dark:text-red-300"
          >
            "{v}"
          </span>
        ))}
      </div>
      <p className="text-[11px] text-red-500/80 dark:text-red-400/60 mt-1.5">
        {(convertible_ratio * 100).toFixed(0)}% des valeurs non-nulles sont numériques
      </p>
    </div>
  );
}
