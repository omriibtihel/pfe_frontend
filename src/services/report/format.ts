export function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(d);
}

export function kindLabel(k: string): string {
  const map: Record<string, string> = {
    numeric: 'Numérique',
    categorical: 'Catégorielle',
    text: 'Texte',
    datetime: 'Date/Heure',
    unknown: 'Inconnu',
  };
  return map[k] ?? k;
}
