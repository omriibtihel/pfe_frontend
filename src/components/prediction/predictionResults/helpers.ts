import type { FeatureRange, PredictionRow } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

export function _fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence levels (score vs threshold)
// ─────────────────────────────────────────────────────────────────────────────

export type ConfLevel = 'high' | 'medium' | 'low' | 'uncertain';

export function _confLevel(score: number | null, threshold = 0.5): ConfLevel {
  if (score === null) return 'medium';
  const d = Math.abs(score - threshold);
  if (d < 0.1) return 'uncertain';
  if (d < 0.2) return 'low';
  if (d < 0.35) return 'medium';
  return 'high';
}

export function _confTooltip(level: string, threshold: number): string {
  const t = (threshold * 100).toFixed(0);
  switch (level) {
    case 'high':
      return `Le score est loin du seuil de décision (${t}%). Le modèle prédit avec une forte séparation entre les classes.`;
    case 'medium':
      return `Le score est à distance modérée du seuil (${t}%). La prédiction est probable mais mérite attention.`;
    case 'low':
      return `Le score est proche du seuil de décision (${t}%). La prédiction pourrait changer avec de légères variations des données. Vérification recommandée.`;
    case 'uncertain':
      return `Le score est très proche du seuil de décision (${t}%). Le modèle ne discrimine pas clairement entre les classes. Un avis clinique est indispensable.`;
    default:
      return '';
  }
}

export const CONF_BADGE: Record<string, { badge: string; bar: string; label: string }> = {
  high: {
    badge:
      'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    bar: '#10b981',
    label: 'Net',
  },
  medium: {
    badge: 'border-blue-400/40 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    bar: '#3b82f6',
    label: 'Modéré',
  },
  low: {
    badge: 'border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    bar: '#f59e0b',
    label: 'Limite',
  },
  uncertain: {
    badge: 'border-red-400/50 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
    bar: '#ef4444',
    label: 'Ambigu',
  },
};

/** Count predictions per confidence zone, respecting the real threshold. */
export function _buildZoneCounts(rows: PredictionRow[], threshold: number) {
  const counts = { uncertain: 0, low: 0, medium: 0, high: 0 };
  for (const r of rows) {
    if (r.score === null) continue;
    counts[_confLevel(r.score, threshold)]++;
  }
  return [
    { level: 'uncertain', label: 'Ambigu', count: counts.uncertain, color: '#ef4444', desc: 'Avis clinique requis' },
    { level: 'low', label: 'Limite', count: counts.low, color: '#f59e0b', desc: 'Vérification recommandée' },
    { level: 'medium', label: 'Modéré', count: counts.medium, color: '#3b82f6', desc: 'Résultat probable' },
    { level: 'high', label: 'Net', count: counts.high, color: '#10b981', desc: 'Forte séparation' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// File download helper
// ─────────────────────────────────────────────────────────────────────────────

export function _triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Counterfactual / slider helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature names that are almost always immutable in a medical context
 * (demographics, identifiers). Used as the default lock state.
 */
export const _DEMOGRAPHIC_RE = /\b(sex|sexe|genre|gender|age|âge|race|ethnicit|birth|naissance|nation|id)\b/i;

export function _defaultLocked(featureName: string, value: unknown): boolean {
  if (_DEMOGRAPHIC_RE.test(featureName)) return true;
  if (typeof value !== 'number' && !(typeof value === 'string' && value !== '' && !isNaN(Number(value)))) {
    return true; // non-numeric → can't slider → locked
  }
  return false;
}

export function _toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

/** Compute slider [min, max] from training stats with a small clinical margin. */
export function _sliderBounds(
  range: FeatureRange | undefined,
  currentValue: number,
  originalValue: number,
): [number, number] {
  if (range && range.type === 'numeric' && range.min != null && range.max != null) {
    const spread = Math.max(range.max - range.min, Math.abs(range.mean ?? 0) * 0.5, 1);
    const margin = spread * 0.2;
    return [range.min - margin, range.max + margin];
  }
  const center = originalValue;
  const radius = Math.max(Math.abs(center) * 1.5, Math.abs(currentValue - originalValue) * 2, 1);
  return [center - radius, center + radius];
}

/** Round step size: 1 % of the range, rounded to a clean number of decimals. */
export function _sliderStep(min: number, max: number): number {
  const raw = (max - min) / 100;
  if (raw <= 0) return 1;
  return Math.pow(10, Math.floor(Math.log10(raw)));
}

export function _fmtNum(v: number, step: number): string {
  if (step >= 1) return Math.round(v).toString();
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}
