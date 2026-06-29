import autoTable from 'jspdf-autotable';
import type { PdfBuilder } from '../PdfBuilder';
import type { MLReadiness, ReportContext, RGB } from '../../types';
import { C_AMBER, C_DARK, C_GREEN, C_INK, C_RED, C_ROW_ALT, C_TH_BG } from '../../theme';

export function renderConclusion(
  pdf: PdfBuilder,
  ctx: ReportContext,
  targetColumn: string | null,
): void {
  pdf.sectionTitle('10', 'Conclusion & Verdict');

  const { completeness, suspectedIds, constantCols, zeroSuspects, targetAnalysis, mlReadiness } = ctx;

  const sentences: string[] = [];

  if (
    completeness >= 95 &&
    suspectedIds.length === 0 &&
    constantCols.length === 0 &&
    zeroSuspects.length === 0
  ) {
    sentences.push(
      `Ce dataset présente une qualité structurelle solide : complétude de ${completeness}%, ` +
        `aucun identifiant parasite, aucune colonne constante ni zéro suspect détecté.`,
    );
  } else {
    const issues: string[] = [];
    if (completeness < 95) issues.push(`complétude de ${completeness}%`);
    if (suspectedIds.length > 0) issues.push(`${suspectedIds.length} identifiant(s) potentiel(s)`);
    if (constantCols.length > 0) issues.push(`${constantCols.length} colonne(s) constante(s)`);
    if (zeroSuspects.length > 0) issues.push(`${zeroSuspects.length} colonne(s) avec zéros suspects`);
    sentences.push(
      `Ce dataset requiert un prétraitement ciblé avant l'entraînement, notamment en raison de : ${issues.join(', ')}.`,
    );
  }

  if (targetColumn && targetAnalysis) {
    const imbalNote =
      targetAnalysis.imbalanceRatio != null && targetAnalysis.imbalanceRatio > 3
        ? ` Le déséquilibre de classes (ratio ${targetAnalysis.imbalanceRatio.toFixed(1)}:1) devra être traité.`
        : '';
    sentences.push(
      `La tâche de ${targetAnalysis.taskType} sur « ${targetColumn} » est prête à être configurée.${imbalNote}`,
    );
  }

  sentences.push(
    `Après les prétraitements recommandés, ce dataset sera exploitable pour un entraînement supervisé via la page Entraînement de MedIQ.`,
  );

  pdf.para(sentences.join(' '));

  pdf.ensureSpace(20);
  pdf.subHeading('Verdict ML');

  const verdictRows: [string, string][] = [];
  const verdictLabel: Record<MLReadiness['level'], string> = {
    ready: "Prêt pour l'entraînement",
    ready_with_prep: 'Prêt avec prétraitements recommandés',
    not_ready: 'Non prêt sans nettoyage complémentaire',
  };
  verdictRows.push(['Statut global', verdictLabel[mlReadiness.level]]);

  if (mlReadiness.blockers.length > 0) {
    verdictRows.push(['Bloquants', mlReadiness.blockers.join('\n')]);
  }
  if (mlReadiness.warnings.length > 0) {
    verdictRows.push(['Points à traiter', mlReadiness.warnings.join('\n')]);
  }

  const verdictStatusColor: Record<MLReadiness['level'], RGB> = {
    ready: C_GREEN,
    ready_with_prep: C_AMBER,
    not_ready: C_RED,
  };

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [],
    body: verdictRows,
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 9.5, cellPadding: 4, textColor: C_INK },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: C_TH_BG, textColor: C_DARK },
      1: { textColor: C_INK },
    },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
    didParseCell: (hook) => {
      if (hook.column.index === 1 && hook.section === 'body' && hook.row.index === 0) {
        hook.cell.styles.textColor = verdictStatusColor[mlReadiness.level];
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fontSize = 10;
      }
    },
  });
  pdf.y = pdf.getLastY() + 10;
}
