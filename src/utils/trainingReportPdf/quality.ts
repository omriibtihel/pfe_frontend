import type { Quality, RGB } from './constants';
import { C } from './constants';

// ── Qualité métrique ──────────────────────────────────────────────────────────
export function quality(v: number | null, lowerIsBetter = false): Quality {
  if (v == null || !Number.isFinite(v)) return 'na';
  const n = lowerIsBetter ? 1 - Math.min(1, Math.abs(v)) : v;
  if (n >= 0.85) return 'excellent';
  if (n >= 0.70) return 'good';
  if (n >= 0.50) return 'moderate';
  return 'poor';
}

export function qualityColor(q: Quality): RGB {
  if (q === 'excellent' || q === 'good') return C.green;
  if (q === 'moderate') return C.orange;
  if (q === 'poor') return C.red;
  return C.muted;
}

export function qualityLabel(q: Quality): string {
  const map: Record<Quality, string> = {
    excellent: 'Excellent', good: 'Good', moderate: 'Moderate', poor: 'Poor', na: 'N/A',
  };
  return map[q];
}
