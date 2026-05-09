import type { ColumnProfile } from '../types';

/**
 * Columns whose name or extreme unique ratio suggests they are identifiers.
 * unique_pct is on the 0–100 scale (backend convention).
 */
export function detectSuspectedIds(profiles: ColumnProfile[]): string[] {
  return profiles
    .filter((p) => {
      const nl = p.name.toLowerCase();
      const hasIdName = /\bid\b|_id$|^id_|^uuid|^index$|^idx$|^rowid$/.test(nl);
      const highUnique = p.unique_pct > 90 && p.kind !== 'numeric';
      return hasIdName || highUnique;
    })
    .map((p) => p.name);
}

/** Columns with a single distinct value — zero predictive power. */
export function detectConstant(profiles: ColumnProfile[]): string[] {
  return profiles.filter((p) => p.unique <= 1).map((p) => p.name);
}

/**
 * Categorical columns where more than half of values are unique.
 * unique_pct is on the 0–100 scale.
 */
export function detectHighCardinality(profiles: ColumnProfile[]): string[] {
  return profiles
    .filter((p) => (p.kind === 'categorical' || p.kind === 'text') && p.unique_pct > 50)
    .map((p) => p.name);
}

/**
 * Numeric columns whose minimum is 0 but whose first quartile is positive.
 * This pattern often indicates zeros used to code missing values (common in
 * medical datasets: Glucose=0, BMI=0, BloodPressure=0…).
 */
export function detectZeroSuspects(profiles: ColumnProfile[]): string[] {
  return profiles
    .filter((p) => {
      if (p.kind !== 'numeric' || !p.numeric) return false;
      const { min, p25 } = p.numeric;
      return min != null && p25 != null && min === 0 && p25 > 0;
    })
    .map((p) => p.name);
}

/** Numeric columns with extreme values vs IQR (×3) at either end. */
export function detectOutlierCols(profiles: ColumnProfile[]): ColumnProfile[] {
  return profiles.filter((p) => {
    if (p.kind !== 'numeric' || !p.numeric) return false;
    const { p25, p75, min, max } = p.numeric;
    if (p25 == null || p75 == null || min == null || max == null) return false;
    const iqr = p75 - p25;
    return iqr > 0 && (max - p75 > 3 * iqr || p25 - min > 3 * iqr);
  });
}
