import type { PdfBuilder } from '../PdfBuilder';
import type { MLReadiness, ReportContext } from '../../types';
import { fmtIntPdf } from '@/utils/pdfText';

export function renderExecutiveSummary(
  pdf: PdfBuilder,
  ctx: ReportContext,
  targetColumn: string | null,
): void {
  pdf.sectionTitle('01', 'Résumé exécutif');

  const {
    totalRows,
    totalCols,
    numericCount,
    catCount,
    completeness,
    zeroSuspects,
    missingEntries,
    targetAnalysis,
    suspectedIds,
    constantCols,
    outlierCols,
    mlReadiness,
  } = ctx;

  const sentences: string[] = [];

  sentences.push(
    `Ce dataset contient ${fmtIntPdf(totalRows)} observations et ${totalCols} variables ` +
      `(${numericCount} numérique${numericCount > 1 ? 's' : ''}, ` +
      `${catCount} catégorielle${catCount > 1 ? 's' : ''}).`,
  );

  if (completeness >= 98 && zeroSuspects.length === 0) {
    sentences.push(
      `Les données sont techniquement propres : complétude de ${completeness}%, aucune valeur manquante ni zéro suspect détecté.`,
    );
  } else if (completeness >= 98 && zeroSuspects.length > 0) {
    sentences.push(
      `La complétude est de ${completeness}% (aucun NaN), mais ${zeroSuspects.length} colonne${zeroSuspects.length > 1 ? 's contiennent' : ' contient'} ` +
        `des zéros potentiellement invalides d'un point de vue métier ` +
        `(${zeroSuspects.slice(0, 3).join(', ')}${zeroSuspects.length > 3 ? '…' : ''}).`,
    );
  } else if (completeness >= 85) {
    sentences.push(
      `La complétude globale est de ${completeness}% — ` +
        `${missingEntries.length} colonne${missingEntries.length > 1 ? 's présentent' : ' présente'} des valeurs manquantes qui nécessitent un traitement.`,
    );
  } else {
    sentences.push(
      `La qualité des données est préoccupante : complétude de ${completeness}% seulement, ` +
        `${missingEntries.length} colonnes présentent des lacunes significatives.`,
    );
  }

  if (targetColumn && targetAnalysis) {
    if (targetAnalysis.imbalanceRatio != null && targetAnalysis.imbalanceRatio > 3) {
      sentences.push(
        `La variable cible « ${targetColumn} » correspond à une tâche de ${targetAnalysis.taskType} ` +
          `avec un déséquilibre notable (ratio ${targetAnalysis.imbalanceRatio.toFixed(1)}:1) — un rééquilibrage est recommandé.`,
      );
    } else {
      sentences.push(
        `La variable cible « ${targetColumn} » correspond à une tâche de ${targetAnalysis.taskType}.`,
      );
    }
  } else if (!targetColumn) {
    sentences.push(
      `Aucune variable cible n'est définie — à configurer dans la page Database avant l'entraînement.`,
    );
  }

  const issues: string[] = [];
  if (suspectedIds.length > 0) issues.push(`${suspectedIds.length} identifiant(s) potentiel(s)`);
  if (constantCols.length > 0) issues.push(`${constantCols.length} colonne(s) constante(s)`);
  if (outlierCols.length > 0) issues.push(`${outlierCols.length} colonne(s) avec outliers`);
  if (zeroSuspects.length > 0) issues.push(`${zeroSuspects.length} colonne(s) avec zéros suspects`);
  if (issues.length > 0) sentences.push(`Points d'attention : ${issues.join(', ')}.`);

  const verdictText: Record<MLReadiness['level'], string> = {
    ready: "Le dataset est prêt pour l'entraînement.",
    ready_with_prep: "Le dataset n'est pas encore prêt sans étape de préparation préalable.",
    not_ready: 'Le dataset nécessite un nettoyage significatif avant tout entraînement fiable.',
  };
  sentences.push(verdictText[mlReadiness.level]);

  pdf.para(sentences.join(' '));

  if (mlReadiness.level === 'not_ready') {
    pdf.highlight(`Bloquants : ${mlReadiness.blockers.join(' — ')}`, 'critical');
  } else if (mlReadiness.level === 'ready_with_prep' && mlReadiness.warnings.length > 0) {
    pdf.highlight(
      `Points à traiter avant entraînement : ${mlReadiness.warnings.slice(0, 3).join(' — ')}${mlReadiness.warnings.length > 3 ? '…' : ''}`,
      'warning',
    );
  }
}
