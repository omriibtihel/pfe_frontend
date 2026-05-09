import type { ColumnProfile, TargetAnalysis } from '../types';

/**
 * Determine the ML task type and class distribution for the target column.
 *
 * Key design decisions:
 *  - A numeric column with ≤ 15 distinct values (and unique_pct < 2 %) is treated
 *    as a classification target, not regression.  This handles 0/1 columns like
 *    `Outcome` in the diabetes dataset which pandas marks as int64/float64.
 *  - For binary numeric targets, the class distribution is inferred from the
 *    column mean when no explicit top_values are available.
 */
export function analyzeTarget(
  targetColumn: string,
  profiles: ColumnProfile[],
  totalRows: number,
): TargetAnalysis | null {
  const tp = profiles.find((p) => p.name === targetColumn);
  if (!tp) return null;

  let taskType: string = '—';
  let effectiveUnique: number | undefined = tp.unique != null ? tp.unique : undefined;
  let classDistribution: Array<{ value: string; count: number }> = [];
  let imbalanceRatio: number | null = null;
  let dominantClass: string | null = null;
  let minorityClass: string | null = null;
  let inferredFromMean = false;

  // Categorical/text: always classification
  if (tp.kind === 'categorical' || tp.kind === 'text') {
    const topValues = tp.categorical?.top_values ?? [];
    const nUnique = tp.unique ?? tp.categorical?.unique ?? 0;
    effectiveUnique = nUnique;
    taskType = nUnique === 2 ? 'Classification binaire' : `Classification multi-classes (${nUnique} classes)`;
    classDistribution = [...topValues].sort((a, b) => b.count - a.count);

    // Numeric: check if it looks like a discrete label column.
  } else if (tp.kind === 'numeric') {
    const num = tp.numeric;

    effectiveUnique =
      tp.unique != null
        ? tp.unique
        : num?.min === 0 && num?.max === 1
          ? 2 // binary {0,1}
          : num?.min != null &&
              num?.max != null &&
              Number.isInteger(num.min) &&
              Number.isInteger(num.max) &&
              num.max - num.min <= 14
            ? num.max - num.min + 1
            : undefined;

    const effectiveUniquePct: number =
      tp.unique_pct != null
        ? tp.unique_pct
        : effectiveUnique != null
          ? (effectiveUnique / totalRows) * 100
          : 100;

    const looksDiscrete = effectiveUnique != null && effectiveUnique <= 15 && effectiveUniquePct < 2;

    if (looksDiscrete && effectiveUnique != null) {
      if (effectiveUnique === 2) {
        taskType = 'Classification binaire (valeurs numériques 0/1)';
        const topValues = tp.categorical?.top_values ?? [];
        if (topValues.length >= 2) {
          classDistribution = [...topValues].sort((a, b) => b.count - a.count);
        } else if (num?.mean != null) {
          const pOne = Math.max(0, Math.min(1, num.mean));
          const countOne = Math.round(pOne * totalRows);
          const countZero = totalRows - countOne;
          if (countOne >= countZero) {
            classDistribution = [
              { value: '1', count: countOne },
              { value: '0', count: countZero },
            ];
          } else {
            classDistribution = [
              { value: '0', count: countZero },
              { value: '1', count: countOne },
            ];
          }
          inferredFromMean = true;
        }
      } else {
        taskType = `Classification discrète (${effectiveUnique} valeurs)`;
        const topValues = tp.categorical?.top_values ?? [];
        classDistribution = [...topValues].sort((a, b) => b.count - a.count);
      }
    } else {
      taskType = 'Régression';
    }
  }

  // Compute imbalance metrics from the distribution
  if (classDistribution.length >= 2) {
    const majority = classDistribution[0].count;
    const minority = classDistribution[classDistribution.length - 1].count;
    imbalanceRatio = minority > 0 ? majority / minority : null;
    dominantClass = classDistribution[0].value;
    minorityClass = classDistribution[classDistribution.length - 1].value;
  }

  return {
    profile: tp,
    taskType,
    effectiveUnique,
    classDistribution,
    imbalanceRatio,
    dominantClass,
    minorityClass,
    inferredFromMean,
  };
}
