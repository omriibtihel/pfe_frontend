import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Unlock,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppLayout } from '@/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { PredictionReportPanel } from '@/components/prediction/PredictionReportPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { predictionService } from '@/services/predictionService';
import type {
  CounterfactualResult,
  ExplanationMethod,
  FeatureRange,
  FeatureRangesMap,
  LimeLocalItem,
  PredictionResponse,
  PredictionRow,
  ShapLocalItem,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

function _confLevel(score: number | null, threshold = 0.5): 'high' | 'medium' | 'low' | 'uncertain' {
  if (score === null) return 'medium';
  const d = Math.abs(score - threshold);
  if (d < 0.1)  return 'uncertain';
  if (d < 0.2)  return 'low';
  if (d < 0.35) return 'medium';
  return 'high';
}

function _confTooltip(level: string, threshold: number): string {
  const t = (threshold * 100).toFixed(0);
  const margin = (v: number) => `${(Math.abs(v * 100)).toFixed(0)}%`;
  switch (level) {
    case 'high':      return `Le score est loin du seuil de décision (${t}%). Le modèle prédit avec une forte séparation entre les classes.`;
    case 'medium':    return `Le score est à distance modérée du seuil (${t}%). La prédiction est probable mais mérite attention.`;
    case 'low':       return `Le score est proche du seuil de décision (${t}%). La prédiction pourrait changer avec de légères variations des données. Vérification recommandée.`;
    case 'uncertain': return `Le score est très proche du seuil de décision (${t}%). Le modèle ne discrimine pas clairement entre les classes. Un avis clinique est indispensable.`;
    default: return '';
  }
}

const CONF_BADGE: Record<string, { badge: string; bar: string; label: string }> = {
  high:      { badge: 'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300', bar: '#10b981', label: 'Net'    },
  medium:    { badge: 'border-blue-400/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',               bar: '#3b82f6', label: 'Modéré' },
  low:       { badge: 'border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',          bar: '#f59e0b', label: 'Limite' },
  uncertain: { badge: 'border-red-400/50 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',                    bar: '#ef4444', label: 'Ambigu' },
};

/** Count predictions per confidence zone, respecting the real threshold. */
function _buildZoneCounts(rows: PredictionRow[], threshold: number) {
  const counts = { uncertain: 0, low: 0, medium: 0, high: 0 };
  for (const r of rows) {
    if (r.score === null) continue;
    counts[_confLevel(r.score, threshold)]++;
  }
  return [
    { level: 'uncertain', label: 'Ambigu',  count: counts.uncertain, color: '#ef4444', desc: 'Avis clinique requis' },
    { level: 'low',       label: 'Limite',  count: counts.low,       color: '#f59e0b', desc: 'Vérification recommandée' },
    { level: 'medium',    label: 'Modéré',  count: counts.medium,    color: '#3b82f6', desc: 'Résultat probable' },
    { level: 'high',      label: 'Net',     count: counts.high,      color: '#10b981', desc: 'Forte séparation' },
  ];
}

function _triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

type KpiTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

/**
 * Tone-based accents for KpiCard. The card surface itself stays in the design
 * system (`bg-card`, `border-border`) — only the small accent rule, the icon
 * tile and the value colour vary by tone, keeping the row visually calm.
 */
const _KPI_TONE: Record<KpiTone, { value: string; iconBg: string; iconFg: string; rule: string }> = {
  neutral: { value: 'text-foreground',                     iconBg: 'bg-muted',                            iconFg: 'text-muted-foreground',           rule: 'bg-border' },
  primary: { value: 'text-primary',                        iconBg: 'bg-primary/10',                       iconFg: 'text-primary',                    rule: 'bg-primary' },
  success: { value: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10',                iconFg: 'text-emerald-600 dark:text-emerald-400', rule: 'bg-emerald-500' },
  warning: { value: 'text-amber-600 dark:text-amber-400',  iconBg: 'bg-amber-500/10',                     iconFg: 'text-amber-600 dark:text-amber-400',     rule: 'bg-amber-500'   },
  danger:  { value: 'text-red-600 dark:text-red-400',      iconBg: 'bg-red-500/10',                       iconFg: 'text-red-600 dark:text-red-400',         rule: 'bg-red-500'     },
};

function KpiCard({
  title,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  icon?: React.ReactNode;
}) {
  const t = _KPI_TONE[tone];
  return (
    <Card className="relative overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <span className={`absolute left-0 top-0 h-full w-1 ${t.rule}`} aria-hidden />
      <CardContent className="pt-5 pb-4 pl-6">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          {icon && (
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.iconBg} ${t.iconFg} shrink-0`}>
              {icon}
            </div>
          )}
        </div>
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${t.value}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score, threshold = 0.5 }: { score: number | null; threshold?: number }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const level = _confLevel(score, threshold);
  const style = CONF_BADGE[level];
  const pct = Math.round(score * 100);
  const tPct = Math.round(threshold * 100);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2.5 min-w-[140px]">
        <div className="relative h-2 w-24 rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct}%`, backgroundColor: style.bar }}
          />
          <div
            className="absolute inset-y-0 w-px bg-foreground/30"
            style={{ left: `${tPct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums font-semibold" style={{ color: style.bar }}>
          {pct}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`cursor-default rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${style.badge}`}>
              {style.label}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-center text-xs">
            {_confTooltip(level, threshold)}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

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
      {/* Header */}
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

      {/* Rows */}
      <div className="space-y-1.5">
        {top.map((item) => {
          const pct = (Math.abs(item.value) / maxAbs) * 100;
          const isPos = item.value > 0;
          const color = isPos ? '#f97316' : '#60a5fa';

          return (
            <div key={item.feature} className="grid items-center gap-2" style={{ gridTemplateColumns: '140px 1fr 60px 52px' }}>
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
              <span className="text-[11px] tabular-nums font-semibold text-right" style={{ color }}>
                {isPos ? '+' : ''}{item.value.toFixed(3)}
              </span>
              <span className="text-[10px] text-muted-foreground text-right truncate font-mono" title={item.data != null ? String(item.data) : ''}>
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
  // Take the union of features ranked by max(|shap|, |lime|).
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
      {/* Header — column labels */}
      <div className="grid items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: '140px 1fr 60px 1fr 60px' }}>
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

      {/* Rows */}
      <div className="space-y-1.5">
        {ranked.map(({ feature, shap, lime }) => {
          const sVal = shap?.value;
          const lVal = lime?.value;
          // Disagreement marker: opposite signs and both non-trivial
          const disagree = sVal != null && lVal != null && Math.sign(sVal) !== Math.sign(lVal) && Math.abs(sVal) > 1e-3 && Math.abs(lVal) > 1e-3;

          return (
            <div
              key={feature}
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: '140px 1fr 60px 1fr 60px' }}
            >
              <span className="text-[11px] text-foreground truncate flex items-center gap-1" title={feature}>
                {disagree && <span className="text-amber-500" title="SHAP et LIME divergent sur cette variable">⚠</span>}
                {feature}
              </span>
              {drawBar(sVal, 'violet')}
              <span
                className="text-[11px] tabular-nums font-semibold text-right"
                style={{ color: sVal == null ? 'var(--muted-foreground)' : sVal > 0 ? '#f97316' : '#60a5fa' }}
              >
                {sVal == null ? '—' : `${sVal > 0 ? '+' : ''}${sVal.toFixed(3)}`}
              </span>
              {drawBar(lVal, 'teal')}
              <span
                className="text-[11px] tabular-nums font-semibold text-right"
                style={{ color: lVal == null ? 'var(--muted-foreground)' : lVal > 0 ? '#f97316' : '#60a5fa' }}
              >
                {lVal == null ? '—' : `${lVal > 0 ? '+' : ''}${lVal.toFixed(3)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExplanationPanel({
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
    if (shapNorm.length === 0) return <p className="text-xs text-muted-foreground py-6 text-center">SHAP indisponible.</p>;
    return <SingleMethodPanel items={shapNorm} label="Contributions SHAP" accentClass="text-violet-600 dark:text-violet-400" />;
  }
  if (method === 'lime') {
    if (limeNorm.length === 0) return <p className="text-xs text-muted-foreground py-6 text-center">LIME indisponible.</p>;
    return <SingleMethodPanel items={limeNorm} label="Contributions LIME" accentClass="text-teal-600 dark:text-teal-400" />;
  }
  // both
  if (shapNorm.length === 0 && limeNorm.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Aucune explication disponible.</p>;
  }
  return <ComparisonPanel shapItems={shapNorm} limeItems={limeNorm} />;
}

const METHOD_LABELS: Record<ExplanationMethod, string> = {
  shap: 'SHAP',
  lime: 'LIME',
  both: 'Les deux',
};

function MethodToggle({ value, onChange }: { value: ExplanationMethod; onChange: (m: ExplanationMethod) => void }) {
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

function ExplanationModal({
  row,
  shapItems,
  limeItems,
  method,
  onMethodChange,
  isLoading,
  isClassification,
  onClose,
  projectId,
  modelId,
  modelName,
  projectName,
}: {
  row: PredictionRow;
  shapItems?: ShapLocalItem[] | null;
  limeItems?: LimeLocalItem[] | null;
  method: ExplanationMethod;
  onMethodChange: (m: ExplanationMethod) => void;
  isLoading: boolean;
  isClassification: boolean;
  onClose: () => void;
  projectId: string;
  modelId: number;
  modelName: string;
  projectName: string;
}) {
  const descParts = [
    `Prédiction : ${String(row.prediction)}`,
    isClassification && row.score != null ? `Score : ${(row.score * 100).toFixed(1)}%` : null,
  ].filter(Boolean).join('  ·  ');

  const titlePrefix = method === 'shap' ? 'SHAP' : method === 'lime' ? 'LIME' : 'SHAP vs LIME';

  // Inject the latest LIME items into the row so the report panel can use them.
  // The cache lives at the page level, but we already have limeItems here.
  const rowWithLime: PredictionRow = { ...row, lime: limeItems ?? row.lime ?? null };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={<Sparkles className="h-5 w-5" />}
      title={`Explication ${titlePrefix} — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-[11px] text-muted-foreground">
            Impact{' '}
            <span className="font-medium text-orange-600 dark:text-orange-400">positif ↑</span>
            {' '}ou{' '}
            <span className="font-medium text-blue-600 dark:text-blue-400">négatif ↓</span>
            {' '}par rapport à la prédiction moyenne du modèle.
          </p>
          <PredictionReportPanel
            projectId={projectId}
            modelId={modelId}
            row={rowWithLime}
            projectName={projectName}
            modelName={modelName}
          />
        </div>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] text-muted-foreground">Méthode d'explication</span>
          <MethodToggle value={method} onChange={onMethodChange} />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ExplanationPanel method={method} shapItems={shapItems} limeItems={limeItems} />
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive counterfactual panel — sliders + live prediction + auto-suggest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature names that are almost always immutable in a medical context
 * (demographics, identifiers). Used as the default lock state.
 */
const _DEMOGRAPHIC_RE = /\b(sex|sexe|genre|gender|age|âge|race|ethnicit|birth|naissance|nation|id)\b/i;

function _defaultLocked(featureName: string, value: unknown): boolean {
  if (_DEMOGRAPHIC_RE.test(featureName)) return true;
  if (typeof value !== 'number' && !(typeof value === 'string' && value !== '' && !isNaN(Number(value)))) {
    return true; // non-numeric → can't slider → locked
  }
  return false;
}

function _toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

/** Compute slider [min, max] from training stats with a small clinical margin. */
function _sliderBounds(range: FeatureRange | undefined, currentValue: number, originalValue: number): [number, number] {
  if (range && range.type === 'numeric' && range.min != null && range.max != null) {
    // Extend by ±20 % of the spread so the user can probe slightly outside the
    // observed range — useful when the patient sits at the edge of training.
    const spread = Math.max(range.max - range.min, Math.abs(range.mean ?? 0) * 0.5, 1);
    const margin = spread * 0.2;
    return [range.min - margin, range.max + margin];
  }
  // No stats: fall back to a range around the current/original value.
  const center = originalValue;
  const radius = Math.max(Math.abs(center) * 1.5, Math.abs(currentValue - originalValue) * 2, 1);
  return [center - radius, center + radius];
}

/** Round step size: 1 % of the range, rounded to a clean number of decimals. */
function _sliderStep(min: number, max: number): number {
  const raw = (max - min) / 100;
  if (raw <= 0) return 1;
  return Math.pow(10, Math.floor(Math.log10(raw)));
}

function _fmtNum(v: number, step: number): string {
  if (step >= 1) return Math.round(v).toString();
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}

// ── Probability gauge (live) ──────────────────────────────────────────────────

function ProbabilityGauge({
  score,
  prediction,
  threshold,
  isLoading,
}: {
  score: number | null;
  prediction: unknown;
  threshold: number;
  isLoading: boolean;
}) {
  if (score === null) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Prédiction</span>
        <span className="text-base font-mono font-bold tabular-nums text-foreground">{String(prediction)}</span>
      </div>
    );
  }
  const pct = Math.round(score * 100);
  const flipped = score < threshold;
  const tPct = Math.round(threshold * 100);
  const accent = flipped ? 'emerald' : 'red';
  const accentClass = flipped ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const bar = flipped ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Probabilité actuelle</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums tracking-tight ${accentClass}`}>{pct}</span>
            <span className={`text-base font-semibold ${accentClass}`}>%</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none ${
          flipped
            ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-red-400/50 bg-red-500/10 text-red-700 dark:text-red-300'
        }`}>
          {flipped ? '✓ Prédiction inversée' : `Classe : ${String(prediction)}`}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${bar}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-[-4px] w-0.5 bg-foreground/40 rounded-full"
          style={{ left: `${tPct}%` }}
          title={`Seuil de décision : ${tPct}%`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>0 %</span>
        <span className="font-mono">seuil {tPct} %</span>
        <span>100 %</span>
      </div>
    </div>
  );
}

// ── Per-feature row (slider for numeric, locked display otherwise) ────────────

function FeatureSliderRow({
  name,
  value,
  originalValue,
  range,
  locked,
  onValueChange,
  onLockToggle,
}: {
  name: string;
  value: number | null;        // null = non-numeric, not editable
  originalValue: unknown;
  range: FeatureRange | undefined;
  locked: boolean;
  onValueChange: (v: number) => void;
  onLockToggle: () => void;
}) {
  const origNum = _toNumber(originalValue);

  // ── Non-numeric / non-editable: compact read-only row ───────────────────────
  if (value === null || origNum === null) {
    return (
      <div className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
          <Lock className="h-3 w-3" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-medium text-foreground truncate" title={name}>{name}</span>
          <span className="text-[10px] text-muted-foreground">Variable non modifiable</span>
        </div>
        <span className="shrink-0 font-mono tabular-nums text-[11px] font-semibold text-foreground">
          {originalValue != null ? _fmt(originalValue) : '—'}
        </span>
      </div>
    );
  }

  const [min, max] = _sliderBounds(range, value, origNum);
  const step = _sliderStep(min, max);
  const delta = value - origNum;
  const hasDelta = Math.abs(delta) >= step / 2;

  const deltaTone =
    !hasDelta ? 'border-border bg-muted/40 text-muted-foreground'
    : delta < 0 ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-orange-400/40 bg-orange-500/10 text-orange-700 dark:text-orange-300';

  // Marker for the original value as a visual anchor on the track.
  const origPct = ((origNum - min) / (max - min)) * 100;
  const clampedOrigPct = Math.max(0, Math.min(100, origPct));

  return (
    <div className={`group px-3 py-2.5 rounded-md transition-colors ${locked ? 'opacity-60' : 'hover:bg-muted/20'}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onLockToggle}
            className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 transition-colors ${
              locked
                ? 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title={locked ? 'Déverrouiller cette variable' : 'Verrouiller cette variable'}
            aria-label={locked ? 'Déverrouiller' : 'Verrouiller'}
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <span className="text-[11px] font-medium text-foreground truncate" title={name}>
            {name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono tabular-nums text-[11px] font-semibold text-foreground">
            {_fmtNum(value, step)}
          </span>
          <span
            className={`min-w-[44px] text-center rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none ${deltaTone}`}
          >
            {hasDelta ? `${delta > 0 ? '+' : ''}${_fmtNum(delta, step)}` : '—'}
          </span>
        </div>
      </div>
      <div className="relative pl-8 pr-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={locked}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          className="w-full accent-primary disabled:opacity-50 disabled:cursor-not-allowed h-1"
        />
        {/* Original-value marker on the track */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-2.5 w-0.5 rounded-full bg-muted-foreground/60"
          style={{ left: `calc(2rem + (100% - 2.25rem) * ${clampedOrigPct / 100})` }}
          title={`Valeur d'origine : ${_fmtNum(origNum, step)}`}
        />
        {/* Track-bounds row, with a dynamically-positioned "original value"
            label pointing at the marker. The label's percentage matches the
            marker so the visual relationship is unambiguous. */}
        <div className="relative h-3 mt-1">
          <span className="absolute left-0 top-0 text-[10px] font-mono tabular-nums text-muted-foreground">
            {_fmtNum(min, step)}
          </span>
          <span className="absolute right-0 top-0 text-[10px] font-mono tabular-nums text-muted-foreground">
            {_fmtNum(max, step)}
          </span>
          <span
            className="absolute top-0 -translate-x-1/2 text-[10px] font-mono tabular-nums text-foreground/70 whitespace-nowrap"
            style={{ left: `calc((100% - 0.25rem) * ${clampedOrigPct / 100})` }}
            title="Valeur d'origine du patient"
          >
            ▴ {_fmtNum(origNum, step)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Interactive panel ─────────────────────────────────────────────────────────

function InteractiveCFPanel({
  row,
  result,
  featureRanges,
  cachedResult,
  isLoadingAutoSuggest,
  onAutoSuggest,
  liveRunner,
}: {
  row: PredictionRow;
  result: PredictionResponse;
  featureRanges: FeatureRangesMap;
  cachedResult?: CounterfactualResult;
  isLoadingAutoSuggest: boolean;
  onAutoSuggest: (featuresToVary: string[]) => Promise<void>;
  liveRunner: (overrides: Record<string, unknown>) => Promise<{ prediction: unknown; score: number | null }>;
}) {
  const featureNames = result.featureNamesExpected;
  const threshold = result.thresholdUsed ?? 0.5;

  // Build initial slider values from row.inputData (numeric features only).
  const buildInitial = useCallback((): Record<string, number> => {
    const init: Record<string, number> = {};
    for (const f of featureNames) {
      const n = _toNumber(row.inputData[f]);
      if (n !== null) init[f] = n;
    }
    return init;
  }, [featureNames, row.inputData]);

  const [values, setValues] = useState<Record<string, number>>(buildInitial);
  const [locked, setLocked] = useState<Set<string>>(
    () => new Set(featureNames.filter((f) => _defaultLocked(f, row.inputData[f]))),
  );
  const [livePrediction, setLivePrediction] = useState<{ prediction: unknown; score: number | null }>({
    prediction: row.prediction,
    score: row.score,
  });
  const [isLivePredicting, setIsLivePredicting] = useState(false);

  // Debounce live prediction calls. Each slider tick schedules a 300 ms timer;
  // any new tick within that window cancels the pending request.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>('');

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const merged: Record<string, unknown> = { ...row.inputData, ...values };
    const payloadKey = JSON.stringify(merged);
    if (payloadKey === lastPayloadRef.current) return;

    debounceRef.current = setTimeout(async () => {
      lastPayloadRef.current = payloadKey;
      setIsLivePredicting(true);
      try {
        const res = await liveRunner(merged);
        setLivePrediction(res);
      } catch {
        // Silent fail — keep last successful prediction visible.
      } finally {
        setIsLivePredicting(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [values, row.inputData, liveRunner]);

  // When auto-suggest finishes, populate sliders with the suggested values.
  // The CounterfactualResult feature names are stripped of CT prefix backend-side.
  useEffect(() => {
    if (!cachedResult?.counterfactual) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const item of cachedResult.counterfactual ?? []) {
        if (item.suggested_value != null && item.feature in next) {
          next[item.feature] = item.suggested_value;
        }
      }
      return next;
    });
  }, [cachedResult]);

  const toggleLock = (name: string) =>
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleReset = () => {
    setValues(buildInitial());
  };

  const handleAutoSuggest = () => {
    const modifiable = featureNames.filter((f) => !locked.has(f));
    if (modifiable.length === 0) return;
    void onAutoSuggest(modifiable);
  };

  const modifiableCount = featureNames.filter((f) => !locked.has(f)).length;
  const changedCount = Object.entries(values).filter(([f, v]) => {
    const orig = _toNumber(row.inputData[f]);
    return orig !== null && Math.abs(v - orig) > 1e-9;
  }).length;

  // Group features for display: modifiable first, then locked.
  const modifiableFeatures = featureNames.filter((f) => !locked.has(f));
  const lockedFeatures = featureNames.filter((f) => locked.has(f));

  const noFlipFound = cachedResult?.counterfactual !== undefined && cachedResult.counterfactual !== null && cachedResult.counterfactual.length === 0;

  return (
    <div className="space-y-4">
      {/* Sticky probability gauge — stays visible while scrolling sliders */}
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-2 bg-popover/95 backdrop-blur-sm">
        <ProbabilityGauge
          score={livePrediction.score}
          prediction={livePrediction.prediction}
          threshold={threshold}
          isLoading={isLivePredicting}
        />
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium tabular-nums">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {modifiableCount} modifiable{modifiableCount !== 1 ? 's' : ''}
        </span>
        {lockedFeatures.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            {lockedFeatures.length} fixe{lockedFeatures.length !== 1 ? 's' : ''}
          </span>
        )}
        {changedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {changedCount} ajustée{changedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Modifiable features section */}
      {modifiableFeatures.length > 0 && (
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Variables modifiables
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border max-h-72 overflow-y-auto">
            {modifiableFeatures.map((f) => (
              <FeatureSliderRow
                key={f}
                name={f}
                value={values[f] ?? null}
                originalValue={row.inputData[f]}
                range={featureRanges[f]}
                locked={false}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [f]: v }))}
                onLockToggle={() => toggleLock(f)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Locked features section */}
      {lockedFeatures.length > 0 && (
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Variables fixes
            <span className="ml-1.5 normal-case font-normal text-[10px] tracking-normal">— cliquez sur le cadenas pour autoriser leur modification</span>
          </p>
          <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border/50">
            {lockedFeatures.map((f) => (
              <FeatureSliderRow
                key={f}
                name={f}
                value={values[f] ?? null}
                originalValue={row.inputData[f]}
                range={featureRanges[f]}
                locked={true}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [f]: v }))}
                onLockToggle={() => toggleLock(f)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No-flip alert */}
      {noFlipFound && (
        <div className="rounded-xl border border-l-4 border-l-amber-500 border-border bg-card p-3 flex items-start gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <p className="text-[11px] text-foreground leading-relaxed">
            <span className="font-medium">Aucune combinaison automatique trouvée.</span>{' '}
            <span className="text-muted-foreground">
              {cachedResult?.message ??
                "Déverrouillez plus de variables ou ajustez manuellement les sliders."}
            </span>
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleReset}
          disabled={changedCount === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Remettre toutes les variables à leur valeur originale"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={handleAutoSuggest}
          disabled={isLoadingAutoSuggest || modifiableCount === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Laisser l'algorithme proposer une combinaison qui inverse la prédiction"
        >
          {isLoadingAutoSuggest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {isLoadingAutoSuggest ? 'Calcul en cours…' : 'Auto-suggérer'}
        </button>
      </div>
    </div>
  );
}


function CounterfactualModal({
  row,
  result,
  featureRanges,
  cachedResult,
  isLoadingAutoSuggest,
  onAutoSuggest,
  liveRunner,
  onClose,
}: {
  row: PredictionRow;
  result: PredictionResponse;
  featureRanges: FeatureRangesMap;
  cachedResult?: CounterfactualResult;
  isLoadingAutoSuggest: boolean;
  onAutoSuggest: (featuresToVary: string[]) => Promise<void>;
  liveRunner: (overrides: Record<string, unknown>) => Promise<{ prediction: unknown; score: number | null }>;
  onClose: () => void;
}) {
  const isClassification = result.taskType === 'classification';
  const descParts = [
    `Prédiction initiale : ${String(row.prediction)}`,
    isClassification && row.score != null ? `Score : ${(row.score * 100).toFixed(1)} %` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={<Shuffle className="h-5 w-5" />}
      title={`Que changer ? — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
          <Wand2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <p>
            Ajustez les sliders pour observer l'effet sur la prédiction en temps réel,
            ou cliquez sur <span className="font-medium text-foreground">Auto-suggérer</span> pour une combinaison automatique.
            Ces suggestions sont indicatives et ne remplacent pas un avis clinique.
          </p>
        </div>
      }
    >
      <InteractiveCFPanel
        row={row}
        result={result}
        featureRanges={featureRanges}
        cachedResult={cachedResult}
        isLoadingAutoSuggest={isLoadingAutoSuggest}
        onAutoSuggest={onAutoSuggest}
        liveRunner={liveRunner}
      />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row details modal — full feature inspection grouped by importance
// ─────────────────────────────────────────────────────────────────────────────

function RowDetailsModal({
  row,
  topFeatures,
  isClassification,
  threshold,
  onClose,
}: {
  row: PredictionRow;
  topFeatures: string[];
  isClassification: boolean;
  threshold: number;
  onClose: () => void;
}) {
  const allFeatures = Object.keys(row.inputData);
  const topSet = new Set(topFeatures);
  const otherFeatures = allFeatures.filter((f) => !topSet.has(f)).sort((a, b) => a.localeCompare(b));

  const descParts = [
    `Prédiction : ${String(row.prediction)}`,
    isClassification && row.score != null
      ? `Score : ${(row.score * 100).toFixed(1)} % (seuil ${(threshold * 100).toFixed(0)} %)`
      : null,
  ].filter(Boolean).join('  ·  ');

  const renderRow = (name: string, isTop: boolean) => {
    const value = row.inputData[name];
    return (
      <div
        key={name}
        className="grid grid-cols-[1fr_auto] items-baseline gap-3 px-3 py-1.5 rounded-md hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate" title={name}>
          {isTop && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
          <span className={isTop ? 'font-medium text-foreground' : ''}>{name}</span>
        </span>
        <span className="font-mono tabular-nums text-[12px] font-semibold text-foreground" title={_fmt(value)}>
          {_fmt(value)}
        </span>
      </div>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      icon={<FileText className="h-5 w-5" />}
      title={`Détails complets — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <p className="text-[11px] text-muted-foreground">
          ★ marque les variables jugées les plus importantes par le modèle (SHAP global).
          Les valeurs affichées sont celles passées en entrée — non transformées.
        </p>
      }
    >
      <div className="space-y-4">
        {topFeatures.length > 0 && (
          <section className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Variables clés du modèle
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
              {topFeatures.map((f) => renderRow(f, true))}
            </div>
          </section>
        )}

        {otherFeatures.length > 0 && (
          <section className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Autres variables
              <span className="ml-1.5 normal-case font-normal text-muted-foreground/80 tracking-normal">
                ({otherFeatures.length})
              </span>
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
              {otherFeatures.map((f) => renderRow(f, false))}
            </div>
          </section>
        )}

        {allFeatures.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune variable disponible.</p>
        )}
      </div>
    </Modal>
  );
}

function PredictionBadge({ prediction, isClassification }: { prediction: string | number; isClassification: boolean }) {
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
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {val}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function PredictionResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [parseError, setParseError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);

  // Unified explanation + counterfactual cache per row index.
  type ExplanationCacheEntry = {
    shap?: ShapLocalItem[];
    lime?: LimeLocalItem[];
    counterfactual?: CounterfactualResult;
  };
  const [explanationCache, setExplanationCache] = useState<Record<number, ExplanationCacheEntry>>({});
  const [loadingRows, setLoadingRows] = useState<Set<number>>(new Set());
  const [explainMethod, setExplainMethod] = useState<ExplanationMethod>('shap');
  const [openModalRow, setOpenModalRow] = useState<PredictionRow | null>(null);

  // Counterfactual modal state (separate from explanation modal).
  const [openCfModalRow, setOpenCfModalRow] = useState<PredictionRow | null>(null);
  const [loadingCfRows, setLoadingCfRows] = useState<Set<number>>(new Set());
  // Row-details modal — full feature inspection for one row.
  const [openDetailsRow, setOpenDetailsRow] = useState<PredictionRow | null>(null);
  // Per-model cache: feature ranges for interactive sliders.
  const [featureRanges, setFeatureRanges] = useState<FeatureRangesMap>({});

  useEffect(() => {
    setParseError(false);
    const raw = sessionStorage.getItem('lastPrediction');
    if (raw) {
      try {
        setResult(JSON.parse(raw) as PredictionResponse);
      } catch (e) {
        console.error('[PredictionResultsPage] Failed to parse prediction response:', e);
        toast({ title: 'Erreur de chargement', description: "Les résultats de prédiction n'ont pas pu être chargés. Réessayez.", variant: 'destructive' });
        setParseError(true);
      }
    }
    setIsLoading(false);
  }, []);

  const isClassification = result?.taskType === 'classification';
  const totalRows = result?.nRows ?? 0;
  const rows = result?.rows ?? [];

  /** True when at least one explanation (SHAP or LIME, server-provided or cached) exists. */
  const hasAnyExplanation =
    rows.some((r) => (r.shap && r.shap.length > 0) || (r.lime && r.lime.length > 0)) ||
    Object.keys(explanationCache).length > 0;

  /** Returns the cached explanation entry for a row, merged with server-provided fields. */
  const getRowExplanations = useCallback(
    (row: PredictionRow): ExplanationCacheEntry => {
      const cached = explanationCache[row.rowIndex] ?? {};
      return {
        shap: cached.shap ?? row.shap ?? undefined,
        lime: cached.lime ?? row.lime ?? undefined,
      };
    },
    [explanationCache],
  );

  /** Which methods does the cache+row need before we can render `method`? */
  const _missingMethods = (entry: ExplanationCacheEntry, method: ExplanationMethod): ExplanationMethod | null => {
    if (method === 'shap') return entry.shap ? null : 'shap';
    if (method === 'lime') return entry.lime ? null : 'lime';
    // both
    const missingShap = !entry.shap;
    const missingLime = !entry.lime;
    if (missingShap && missingLime) return 'both';
    if (missingShap) return 'shap';
    if (missingLime) return 'lime';
    return null;
  };

  const uncertainRows = useMemo(
    () => rows.filter((r) => _confLevel(r.score, result?.thresholdUsed) === 'uncertain'),
    [rows],
  );

  const zoneCounts = useMemo(
    () => (isClassification ? _buildZoneCounts(rows, result?.thresholdUsed ?? 0.5) : []),
    [rows, isClassification, result?.thresholdUsed],
  );

  const classDist = result?.summary?.classDistribution ?? null;
  const classEntries = classDist
    ? Object.entries(classDist).sort((a, b) => b[1] - a[1])
    : [];

  // Top-K most informative features (from backend, sourced from global SHAP
  // when available, alphabetical fallback otherwise). Always 3 names that
  // are guaranteed to exist in row.inputData.
  const topFeatures = result?.topFeatures ?? [];

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /**
   * Fetch the explanations for `row` using `method`, merging into the cache.
   * No-op when the cache already has every method requested.
   */
  const fetchExplanations = useCallback(
    async (row: PredictionRow, method: ExplanationMethod): Promise<void> => {
      if (!id || !result) return;

      const entry = getRowExplanations(row);
      const needed = _missingMethods(entry, method);
      if (needed === null) return;

      setLoadingRows((prev) => new Set(prev).add(row.rowIndex));
      try {
        const explained = await predictionService.predictManualWithSavedModelExplain(
          id,
          result.modelId,
          [row.inputData],
          needed,
        );
        const respRow = explained.rows[0];
        if (!respRow) return;

        const update: ExplanationCacheEntry = {};
        if (respRow.shap && respRow.shap.length > 0) update.shap = respRow.shap;
        if (respRow.lime && respRow.lime.length > 0) update.lime = respRow.lime;

        if (!update.shap && !update.lime) {
          const label = needed === 'shap' ? 'SHAP' : needed === 'lime' ? 'LIME' : 'SHAP/LIME';
          toast({ title: `${label} indisponible pour ce modèle`, variant: 'destructive' });
          return;
        }

        setExplanationCache((prev) => ({
          ...prev,
          [row.rowIndex]: { ...(prev[row.rowIndex] ?? {}), ...update },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Impossible de calculer les explications.';
        console.error('[Expliquer] error:', err);
        toast({ title: 'Erreur explication', description: msg, variant: 'destructive' });
      } finally {
        setLoadingRows((prev) => { const s = new Set(prev); s.delete(row.rowIndex); return s; });
      }
    },
    [id, result, getRowExplanations, toast],
  );

  const handleExplainRow = useCallback(async (row: PredictionRow) => {
    if (!id || !result || loadingRows.has(row.rowIndex)) return;
    setOpenModalRow(row);
    await fetchExplanations(row, explainMethod);
  }, [id, result, loadingRows, fetchExplanations, explainMethod]);

  const handleMethodChange = useCallback(async (m: ExplanationMethod) => {
    setExplainMethod(m);
    if (openModalRow) {
      await fetchExplanations(openModalRow, m);
    }
  }, [openModalRow, fetchExplanations]);

  /**
   * Compute DiCE counterfactuals for a row and store in the unified cache.
   * Always re-fetches: the user may have changed lock state since the last
   * call, so a fresh suggestion is needed each time Auto-suggérer is clicked.
   */
  const handleCounterfactualRow = useCallback(
    async (row: PredictionRow, featuresToVary: string[]): Promise<void> => {
      if (!id || !result) return;

      setLoadingCfRows((prev) => new Set(prev).add(row.rowIndex));
      try {
        const cfResult = await predictionService.computeCounterfactual(
          id,
          result.modelId,
          row.inputData,
          featuresToVary,
        );
        setExplanationCache((prev) => ({
          ...prev,
          [row.rowIndex]: { ...(prev[row.rowIndex] ?? {}), counterfactual: cfResult },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Impossible de calculer le contrefactuel.';
        console.error('[Contrefactuel] error:', err);
        toast({ title: 'Erreur contrefactuel', description: msg, variant: 'destructive' });
      } finally {
        setLoadingCfRows((prev) => {
          const s = new Set(prev);
          s.delete(row.rowIndex);
          return s;
        });
      }
    },
    [id, result, explanationCache, toast],
  );

  /**
   * Live-prediction runner used by the interactive slider panel.
   * Returns {prediction, score} for a row built from row.inputData merged with overrides.
   */
  const cfLiveRunner = useCallback(
    async (overrides: Record<string, unknown>): Promise<{ prediction: unknown; score: number | null }> => {
      if (!id || !result) return { prediction: null, score: null };
      const resp = await predictionService.predictManualWithSavedModel(id, result.modelId, [overrides]);
      const r = resp.rows[0];
      return {
        prediction: r?.prediction ?? null,
        score: r?.score ?? null,
      };
    },
    [id, result],
  );

  // Fetch feature ranges once per model when the CF modal opens.
  useEffect(() => {
    if (!id || !result || !openCfModalRow) return;
    if (Object.keys(featureRanges).length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const ranges = await predictionService.getFeatureRanges(id, result.modelId);
        if (!cancelled) setFeatureRanges(ranges);
      } catch (err) {
        console.warn('[CF] failed to load feature ranges:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [id, result, openCfModalRow, featureRanges]);

  const handleExportCsv = useCallback(async () => {
    if (!id || !result) return;
    setIsExporting(true);
    try {
      const { blob, filename } = await predictionService.exportResultsCsv(
        id,
        result.modelId,
        result.modelType,
        result.rows,
      );
      _triggerDownload(blob, filename ?? `predictions_${result.modelType}.csv`);
      toast({ title: 'Export CSV réussi' });
    } catch (err) {
      toast({ title: 'Erreur export', description: err instanceof Error ? err.message : 'Impossible d\'exporter.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }, [id, result, toast]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Chargement des résultats…</p>
        </div>
      </AppLayout>
    );
  }

  if (parseError) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-5 pt-16" data-testid="prediction-parse-error">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Erreur de chargement</h2>
            <p className="text-sm text-muted-foreground">
              Les résultats de prédiction sont corrompus ou illisibles. Relancez une prédiction.
            </p>
          </div>
          <Button onClick={() => navigate(`/projects/${id}/predict`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Nouvelle prédiction
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!result) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-5 pt-16" data-testid="prediction-empty">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Target className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Aucun résultat disponible</h2>
            <p className="text-sm text-muted-foreground">
              Retournez à la page de prédiction et lancez une analyse.
            </p>
          </div>
          <Button onClick={() => navigate(`/projects/${id}/predict`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 w-full">

        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 self-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/projects/${id}/predict`)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Nouvelle prédiction
          </Button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Résultats de prédiction</h1>
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground">
                  {result.modelType}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] tabular-nums">
                  {totalRows} ligne{totalRows > 1 ? 's' : ''}
                </span>
                {result.thresholdUsed !== 0.5 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <Target className="h-3 w-3" />
                    Seuil calibré : {result.thresholdUsed.toFixed(2)}
                  </span>
                )}
                {hasAnyExplanation && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/50 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                    <Sparkles className="h-3 w-3" />
                    Explicabilité activée
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting} className="shrink-0">
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* Drift warnings */}
        {result.driftWarnings && result.driftWarnings.length > 0 && (
          <div className="rounded-xl border border-l-4 border-l-amber-500 border-border bg-card shadow-sm p-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              Dérive de données détectée
              <span className="ml-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {result.driftWarnings.length} avertissement{result.driftWarnings.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="space-y-1.5 pl-9">
              {result.driftWarnings.map((w, i) => (
                <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none mt-0.5 ${
                    w.severity === 'critical'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {w.severity === 'critical' ? 'CRITIQUE' : 'AVERT.'}
                  </span>
                  <span><span className="font-mono font-semibold text-foreground">{w.column}</span> · {w.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Uncertain predictions alert */}
        {isClassification && uncertainRows.length > 0 && (
          <div className="rounded-xl border border-l-4 border-l-red-500 border-border bg-card shadow-sm p-4 flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {uncertainRows.length} prédiction{uncertainRows.length > 1 ? 's' : ''} incertaine{uncertainRows.length > 1 ? 's' : ''}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Score entre 40 % et 60 %
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Vérification clinique recommandée. Lignes concernées :{' '}
                <span className="font-mono text-foreground">
                  {uncertainRows.map((r) => r.rowIndex + 1).slice(0, 8).join(', ')}
                  {uncertainRows.length > 8 ? ` … (+${uncertainRows.length - 8})` : ''}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Total lignes"
            value={String(totalRows)}
            tone="neutral"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
          />
          {isClassification ? (
            classEntries.slice(0, 2).map(([label, count], i) => {
              const lower = String(label).toLowerCase();
              const isPos = lower === '1' || lower === 'true' || lower === 'yes' || lower === 'positive' || lower === 'oui';
              return (
                <KpiCard
                  key={label}
                  title={`Classe "${label}"`}
                  value={String(count)}
                  sub={`${((count / totalRows) * 100).toFixed(1)} % du total`}
                  tone={i === 0 ? (isPos ? 'danger' : 'success') : (isPos ? 'danger' : 'success')}
                  icon={isPos ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                />
              );
            })
          ) : (
            <>
              <KpiCard
                title="Moyenne"
                value={result.summary.mean?.toFixed(3) ?? '—'}
                tone="primary"
                icon={<Activity className="h-3.5 w-3.5" />}
              />
              <KpiCard
                title="Min / Max"
                value={`${result.summary.min?.toFixed(2) ?? '—'} / ${result.summary.max?.toFixed(2) ?? '—'}`}
                tone="neutral"
              />
            </>
          )}
          {isClassification && (
            <KpiCard
              title="Prédictions incertaines"
              value={String(uncertainRows.length)}
              sub={uncertainRows.length > 0 ? 'Score entre 40 % et 60 %' : 'Aucune incertitude'}
              tone={uncertainRows.length > 0 ? 'warning' : 'success'}
              icon={uncertainRows.length > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
            />
          )}
        </div>

        {/* Charts */}
        {isClassification && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Class distribution */}
            {classEntries.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    Distribution des prédictions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classEntries.map(([label, count]) => ({ label, count }))}
                        margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <RechartsTooltip
                          formatter={(v: number) => [v, 'Effectif']}
                          contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={64}>
                          {classEntries.map(([label], i) => {
                            const lower = String(label).toLowerCase();
                            const isPos = lower === '1' || lower === 'true' || lower === 'yes' || lower === 'positive' || lower === 'oui';
                            return (
                              <Cell key={`dist-${i}`} fill={isPos ? '#ef4444' : '#10b981'} />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score zones */}
            {zoneCounts.some((z) => z.count > 0) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Activity className="h-4 w-4" />
                    </div>
                    Répartition par niveau de score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {zoneCounts.map((zone) => {
                    const pct = totalRows > 0 ? (zone.count / totalRows) * 100 : 0;
                    return (
                      <div key={zone.level} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                            <span className="text-xs font-medium text-foreground">{zone.label}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{zone.desc}</span>
                          </div>
                          <span className="text-xs tabular-nums font-semibold shrink-0 ml-2" style={{ color: zone.color }}>
                            {zone.count}
                            <span className="ml-1 font-normal text-muted-foreground">({pct.toFixed(0)} %)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: zone.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 mt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Seuil de décision</span>
                    <span className="font-mono tabular-nums font-semibold text-foreground">
                      {((result?.thresholdUsed ?? 0.5) * 100).toFixed(0)} %
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Results table */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border bg-muted/30">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Détail des prédictions
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                  {rows.length}
                </span>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Cliquez sur <span className="font-medium text-violet-600 dark:text-violet-400">Expliquer</span> pour les contributions SHAP/LIME ·
                {' '}<span className="font-medium text-amber-600 dark:text-amber-400">Que changer ?</span> pour explorer un contrefactuel
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 backdrop-blur-sm sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-10">#</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prédiction</th>
                    {isClassification && (
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">Score</th>
                    )}
                    {topFeatures.length > 0 && (
                      <th
                        className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground min-w-[280px]"
                        title="Trois variables jugées les plus importantes par le modèle (SHAP global)"
                      >
                        Variables clés du modèle
                      </th>
                    )}
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" colSpan={2}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const uncertain = isClassification && _confLevel(row.score, result.thresholdUsed) === 'uncertain';
                    const entry = getRowExplanations(row);
                    const hasAny = Boolean(entry.shap?.length || entry.lime?.length);
                    const isLoadingRow = loadingRows.has(row.rowIndex);
                    const hasCf = Boolean(explanationCache[row.rowIndex]?.counterfactual);
                    const isLoadingCf = loadingCfRows.has(row.rowIndex);
                    return (
                      <tr
                        key={row.rowIndex}
                        className={`border-b border-border/40 transition-colors ${
                          uncertain
                            ? 'bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50/70 dark:hover:bg-red-950/20'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums font-mono">
                          {row.rowIndex + 1}
                          {uncertain && (
                            <span className="ml-1 text-red-500" title="Prédiction incertaine">⚠</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <PredictionBadge prediction={row.prediction} isClassification={isClassification} />
                        </td>
                        {isClassification && (
                          <td className="px-3 py-2.5">
                            <ScoreBar score={row.score} threshold={result.thresholdUsed} />
                          </td>
                        )}
                        {topFeatures.length > 0 && (() => {
                          const otherCount = Math.max(0, Object.keys(row.inputData).length - topFeatures.length);
                          return (
                            <td className="px-0 py-0">
                              <button
                                type="button"
                                onClick={() => setOpenDetailsRow(row)}
                                className="group flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                                title="Cliquer pour voir tous les détails de cette ligne"
                              >
                                <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                                  {topFeatures.map((col, i) => (
                                    <span key={col} className="inline-flex items-baseline gap-1">
                                      {i > 0 && <span className="text-border mx-0.5 select-none">·</span>}
                                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground" title={col}>
                                        {col.length > 14 ? col.slice(0, 13) + '…' : col}
                                      </span>
                                      <span className="font-mono tabular-nums font-semibold text-foreground">
                                        {_fmt(row.inputData[col])}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                                <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:border-primary/40 group-hover:text-primary transition-colors">
                                  {otherCount > 0 ? `+${otherCount}` : 'détails'}
                                  <ChevronRight className="h-3 w-3" />
                                </span>
                              </button>
                            </td>
                          );
                        })()}
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isLoadingRow}
                            onClick={() => void handleExplainRow(row)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none transition-colors disabled:opacity-50 ${
                              hasAny
                                ? 'border-violet-400/50 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300'
                                : 'border-border bg-card text-violet-700 hover:bg-violet-500/10 hover:border-violet-400/50 dark:text-violet-300'
                            }`}
                            title={hasAny ? 'Voir les explications' : `Calculer (${METHOD_LABELS[explainMethod]})`}
                          >
                            {isLoadingRow ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            {hasAny ? `${METHOD_LABELS[explainMethod]} ✓` : 'Expliquer'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isLoadingCf}
                            onClick={() => setOpenCfModalRow(row)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none transition-colors disabled:opacity-50 ${
                              hasCf
                                ? 'border-amber-400/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                                : 'border-border bg-card text-amber-700 hover:bg-amber-500/10 hover:border-amber-400/50 dark:text-amber-300'
                            }`}
                            title={hasCf ? 'Voir le contrefactuel' : 'Calculer le contrefactuel (DiCE)'}
                          >
                            {isLoadingCf
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Shuffle className="h-3 w-3" />
                            }
                            {hasCf ? 'CF ✓' : 'Que changer ?'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Aucune prédiction</p>
                <p className="text-xs text-muted-foreground">Lancez une nouvelle analyse depuis la page de prédiction.</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)}</span>
                  {' '}sur {rows.length}
                  <span className="ml-2 text-[10px] uppercase tracking-wide">page {page + 1}/{totalPages}</span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" /> Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Suivant <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Explanation Modal — supports SHAP, LIME, or both */}
      {openModalRow && result && id && (() => {
        const entry = getRowExplanations(openModalRow);
        return (
          <ExplanationModal
            row={openModalRow}
            shapItems={entry.shap}
            limeItems={entry.lime}
            method={explainMethod}
            onMethodChange={(m) => void handleMethodChange(m)}
            isLoading={loadingRows.has(openModalRow.rowIndex)}
            isClassification={isClassification}
            onClose={() => setOpenModalRow(null)}
            projectId={id}
            modelId={result.modelId}
            modelName={result.modelType}
            projectName={`Projet ${id}`}
          />
        );
      })()}

      {/* Row Details Modal — full feature inspection */}
      {openDetailsRow != null && result != null && (
        <RowDetailsModal
          row={openDetailsRow}
          topFeatures={topFeatures}
          isClassification={isClassification}
          threshold={result.thresholdUsed ?? 0.5}
          onClose={() => setOpenDetailsRow(null)}
        />
      )}

      {/* Counterfactual Modal — interactive slider panel with live prediction */}
      {openCfModalRow != null && result != null && (() => {
        const cfEntry = explanationCache[openCfModalRow.rowIndex]?.counterfactual;
        const isLoadingCf = loadingCfRows.has(openCfModalRow.rowIndex);
        return (
          <CounterfactualModal
            row={openCfModalRow}
            result={result}
            featureRanges={featureRanges}
            cachedResult={cfEntry}
            isLoadingAutoSuggest={isLoadingCf}
            onAutoSuggest={(featuresToVary) => handleCounterfactualRow(openCfModalRow, featuresToVary)}
            liveRunner={cfLiveRunner}
            onClose={() => setOpenCfModalRow(null)}
          />
        );
      })()}
    </AppLayout>
  );
}

export default PredictionResultsPage;
