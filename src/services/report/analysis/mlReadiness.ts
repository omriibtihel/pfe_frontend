import type { ColumnProfile, MLReadiness } from '../types';

export function computeMLReadiness(opts: {
  completeness: number;
  targetColumn: string | null;
  imbalanceRatio: number | null;
  suspectedIds: string[];
  constantCols: string[];
  heavyMissingCols: string[];
  outlierCols: ColumnProfile[];
  zeroSuspects: string[];
  parasiteCols?: string[];
}): MLReadiness {
  const {
    completeness,
    targetColumn,
    imbalanceRatio,
    suspectedIds,
    constantCols,
    heavyMissingCols,
    outlierCols,
    zeroSuspects,
    parasiteCols = [],
  } = opts;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!targetColumn) blockers.push('Aucune variable cible définie');
  if (constantCols.length)
    blockers.push(`${constantCols.length} colonne(s) constante(s) — aucune information discriminante`);
  if (completeness < 70) blockers.push(`Complétude critique : ${completeness}%`);

  if (suspectedIds.length) warnings.push(`${suspectedIds.length} identifiant(s) potentiel(s) à exclure`);
  if (heavyMissingCols.length)
    warnings.push(`${heavyMissingCols.length} colonne(s) avec > 15% de manquants`);
  if (zeroSuspects.length)
    warnings.push(`${zeroSuspects.length} colonne(s) avec zéros suspects (manquants codés ?)`);
  if (imbalanceRatio != null && imbalanceRatio > 3)
    warnings.push(`Déséquilibre de classes : ratio ${imbalanceRatio.toFixed(1)}:1`);
  if (outlierCols.length) warnings.push(`${outlierCols.length} colonne(s) avec outliers (IQR×3)`);
  if (parasiteCols.length)
    warnings.push(`${parasiteCols.length} colonne(s) avec valeurs parasites non-numériques`);
  if (completeness < 95 && completeness >= 70) warnings.push(`Complétude imparfaite : ${completeness}%`);

  if (blockers.length) return { level: 'not_ready', blockers, warnings };
  if (warnings.length) return { level: 'ready_with_prep', blockers: [], warnings };
  return { level: 'ready', blockers: [], warnings: [] };
}
