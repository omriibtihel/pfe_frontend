export type ColKind = 'numeric' | 'categorical' | 'text' | 'datetime' | 'unknown';

export type ColProfile = {
  name: string;
  kind: ColKind;
  dtype: string;
  missing: number;
  missingPct: number;
  unique: number;
  uniquePct: number;
  numeric?: {
    mean: number | null;
    std: number | null;
    min: number | null;
    p25: number | null;
    p50: number | null;
    p75: number | null;
    max: number | null;
  } | null;
  topValues?: Array<{ value: string; count: number }>;
  parasites?: {
    count: number;
    distinct: string[];
    convertible_ratio: number;
  } | null;
};

export function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(d);
}

export function pctLabel(count: number, total: number): string {
  if (!total) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

export const KIND_COLORS: Record<ColKind, string> = {
  numeric: 'hsl(221, 83%, 53%)',
  categorical: 'hsl(262, 83%, 58%)',
  text: 'hsl(174, 84%, 32%)',
  datetime: 'hsl(38, 92%, 50%)',
  unknown: 'hsl(0,0%,60%)',
};

export function kindLabel(k: ColKind): string {
  const map: Record<ColKind, string> = {
    numeric: 'Numérique',
    categorical: 'Catégorielle',
    text: 'Texte',
    datetime: 'Date/Heure',
    unknown: 'Inconnu',
  };
  return map[k];
}
