import { Sparkles } from 'lucide-react';
import type { ExplanationMethod, LimeLocalItem, ShapLocalItem } from '@/types';
import { _fmt } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Explanation primitives — unified shape so SHAP and LIME render identically
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizedExplanationItem {
  feature: string;
  value: number;
  data: number | string | null;
}

function _normShap(items: ShapLocalItem[]): NormalizedExplanationItem[] {
  return items.map((d) => ({ feature: d.feature, value: d.shap_value, data: d.data }));
}

function _normLime(items: LimeLocalItem[]): NormalizedExplanationItem[] {
  return items.map((d) => ({ feature: d.feature, value: d.contribution, data: d.data }));
}

function SingleMethodPanel({
  items,
  label,
  accentClass,
}: {
  items: NormalizedExplanationItem[];
  label: string;
  accentClass: string;
}) {
  const top = items.slice(0, 8);
  const maxAbs = Math.max(...top.map((d) => Math.abs(d.value)), 1e-9);

  return (
    <div className="py-3 px-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${accentClass}`}>
          <Sparkles className="h-3 w-3" /> {label}
        </span>
        <span className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-400" /> baisse
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" /> hausse
          </span>
        </span>
      </div>

      <div className="space-y-1.5">
        {top.map((item) => {
          const pct = (Math.abs(item.value) / maxAbs) * 100;
          const isPos = item.value > 0;
          const color = isPos ? '#f97316' : '#60a5fa';

          return (
            <div
              key={item.feature}
              className="grid items-center gap-2 grid-cols-[minmax(0,1fr)_1.4fr_auto] sm:grid-cols-[minmax(90px,140px)_minmax(0,1fr)_56px_52px]"
            >
              <span className="text-[11px] text-foreground truncate" title={item.feature}>
                {item.feature}
              </span>
              <div className="relative h-3 rounded-sm bg-muted/40 overflow-hidden">
                <div
                  className="absolute top-0 h-full rounded-sm"
                  style={{
                    width: `${pct / 2}%`,
                    backgroundColor: color,
                    opacity: 0.75,
                    ...(isPos ? { left: '50%' } : { right: '50%' }),
                  }}
                />
                <div className="absolute inset-y-0 left-1/2 w-px bg-border/80" />
              </div>
              <span className="text-[11px] tabular-nums font-semibold text-right whitespace-nowrap" style={{ color }}>
                {isPos ? '+' : ''}
                {item.value.toFixed(3)}
              </span>
              <span
                className="hidden sm:block text-[10px] text-muted-foreground text-right truncate font-mono"
                title={item.data != null ? String(item.data) : ''}
              >
                {item.data != null ? _fmt(item.data) : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonPanel({
  shapItems,
  limeItems,
}: {
  shapItems: NormalizedExplanationItem[];
  limeItems: NormalizedExplanationItem[];
}) {
  const merged = new Map<string, { shap?: NormalizedExplanationItem; lime?: NormalizedExplanationItem }>();
  for (const s of shapItems) merged.set(s.feature, { ...(merged.get(s.feature) ?? {}), shap: s });
  for (const l of limeItems) merged.set(l.feature, { ...(merged.get(l.feature) ?? {}), lime: l });

  const ranked = Array.from(merged.entries())
    .map(([feature, { shap, lime }]) => ({
      feature,
      shap,
      lime,
      score: Math.max(Math.abs(shap?.value ?? 0), Math.abs(lime?.value ?? 0)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const maxAbs = Math.max(...ranked.map((d) => d.score), 1e-9);

  const drawBar = (val: number | undefined, hue: 'violet' | 'teal') => {
    if (val == null) {
      return (
        <div className="relative h-2.5 rounded-sm bg-muted/30 overflow-hidden">
          <div className="absolute inset-y-0 left-1/2 w-px bg-border/80" />
        </div>
      );
    }
    const pct = (Math.abs(val) / maxAbs) * 100;
    const isPos = val > 0;
    const color = isPos ? '#f97316' : '#60a5fa';
    const trackBg = hue === 'violet' ? 'bg-violet-500/10' : 'bg-teal-500/10';
    return (
      <div className={`relative h-2.5 rounded-sm overflow-hidden ${trackBg}`}>
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{
            width: `${pct / 2}%`,
            backgroundColor: color,
            opacity: 0.85,
            ...(isPos ? { left: '50%' } : { right: '50%' }),
          }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-border/80" />
      </div>
    );
  };

  return (
    <div className="py-3 px-2 space-y-3">
      <div className="hidden sm:grid items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground grid-cols-[minmax(90px,140px)_minmax(0,1fr)_56px_minmax(0,1fr)_56px]">
        <span>Variable</span>
        <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> SHAP
        </span>
        <span className="text-right text-violet-600 dark:text-violet-400">Δ</span>
        <span className="text-teal-600 dark:text-teal-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> LIME
        </span>
        <span className="text-right text-teal-600 dark:text-teal-400">Δ</span>
      </div>

      <div className="space-y-3 sm:space-y-1.5">
        {ranked.map(({ feature, shap, lime }) => {
          const sVal = shap?.value;
          const lVal = lime?.value;
          const disagree =
            sVal != null &&
            lVal != null &&
            Math.sign(sVal) !== Math.sign(lVal) &&
            Math.abs(sVal) > 1e-3 &&
            Math.abs(lVal) > 1e-3;

          const sValSpan = (
            <span
              className="text-[11px] tabular-nums font-semibold text-right whitespace-nowrap"
              style={{
                color: sVal == null ? 'var(--muted-foreground)' : sVal > 0 ? '#f97316' : '#60a5fa',
              }}
            >
              {sVal == null ? '—' : `${sVal > 0 ? '+' : ''}${sVal.toFixed(3)}`}
            </span>
          );
          const lValSpan = (
            <span
              className="text-[11px] tabular-nums font-semibold text-right whitespace-nowrap"
              style={{
                color: lVal == null ? 'var(--muted-foreground)' : lVal > 0 ? '#f97316' : '#60a5fa',
              }}
            >
              {lVal == null ? '—' : `${lVal > 0 ? '+' : ''}${lVal.toFixed(3)}`}
            </span>
          );

          return (
            <div key={feature} className="space-y-1.5 sm:space-y-0">
              {/* Mobile: stacked layout */}
              <div className="sm:hidden space-y-1.5">
                <span className="text-[11px] text-foreground truncate flex items-center gap-1" title={feature}>
                  {disagree && (
                    <span className="text-amber-500" title="SHAP et LIME divergent">⚠</span>
                  )}
                  {feature}
                </span>
                <div className="grid items-center gap-2 grid-cols-[40px_minmax(0,1fr)_auto]">
                  <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">SHAP</span>
                  {drawBar(sVal, 'violet')}
                  {sValSpan}
                </div>
                <div className="grid items-center gap-2 grid-cols-[40px_minmax(0,1fr)_auto]">
                  <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">LIME</span>
                  {drawBar(lVal, 'teal')}
                  {lValSpan}
                </div>
              </div>

              {/* Desktop: 5-col grid */}
              <div className="hidden sm:grid items-center gap-2 grid-cols-[minmax(90px,140px)_minmax(0,1fr)_56px_minmax(0,1fr)_56px]">
                <span className="text-[11px] text-foreground truncate flex items-center gap-1" title={feature}>
                  {disagree && (
                    <span className="text-amber-500" title="SHAP et LIME divergent sur cette variable">⚠</span>
                  )}
                  {feature}
                </span>
                {drawBar(sVal, 'violet')}
                {sValSpan}
                {drawBar(lVal, 'teal')}
                {lValSpan}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExplanationPanel({
  method,
  shapItems,
  limeItems,
}: {
  method: ExplanationMethod;
  shapItems?: ShapLocalItem[] | null;
  limeItems?: LimeLocalItem[] | null;
}) {
  const shapNorm = shapItems ? _normShap(shapItems) : [];
  const limeNorm = limeItems ? _normLime(limeItems) : [];

  if (method === 'shap') {
    if (shapNorm.length === 0)
      return <p className="text-xs text-muted-foreground py-6 text-center">SHAP indisponible.</p>;
    return (
      <SingleMethodPanel
        items={shapNorm}
        label="Contributions SHAP"
        accentClass="text-violet-600 dark:text-violet-400"
      />
    );
  }
  if (method === 'lime') {
    if (limeNorm.length === 0)
      return <p className="text-xs text-muted-foreground py-6 text-center">LIME indisponible.</p>;
    return (
      <SingleMethodPanel
        items={limeNorm}
        label="Contributions LIME"
        accentClass="text-teal-600 dark:text-teal-400"
      />
    );
  }
  if (shapNorm.length === 0 && limeNorm.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Aucune explication disponible.</p>;
  }
  return <ComparisonPanel shapItems={shapNorm} limeItems={limeNorm} />;
}

export const METHOD_LABELS: Record<ExplanationMethod, string> = {
  shap: 'SHAP',
  lime: 'LIME',
  both: 'Les deux',
};

export function MethodToggle({
  value,
  onChange,
}: {
  value: ExplanationMethod;
  onChange: (m: ExplanationMethod) => void;
}) {
  const options: ExplanationMethod[] = ['shap', 'lime', 'both'];
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? opt === 'shap'
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                  : opt === 'lime'
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                    : 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {METHOD_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
