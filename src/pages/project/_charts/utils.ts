/** Truncate a string to n characters, appending "…" if needed */
export function shortLabel(s: string, n = 18): string {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Format a number to d decimal places, returns "—" for null/undefined/NaN */
export const fmtN = (v: number | null | undefined, d = 2): string =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);
