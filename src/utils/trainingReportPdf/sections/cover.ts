import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMetricValue } from '@/utils/metricUtils';
import { C, CW, M, W } from '../constants';
import type { TrainingReportContext } from '../context';
import { drawc, fill, finalY, txtc } from '../drawing';
import { modelName } from '../formatters';
import { duration } from '../session';

/**
 * Page de couverture sobre : titre centré + sous-titre + tableau récapitulatif.
 * Inspirée du modèle de compte rendu : aucun bandeau plein-cadre, peu de couleurs.
 */
export function renderCover(doc: jsPDF, ctx: TrainingReportContext): number {
  const { session, best, isReg, genDate } = ctx;

  // ── Bloc-titre centré ────────────────────────────────────────────────────
  let y = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  txtc(doc, C.muted);
  doc.text('MEDIQ', W / 2, y, { align: 'center' });

  y += 10;
  doc.setFontSize(20);
  txtc(doc, C.navy);
  doc.text(`Compte rendu d'entraînement — Session #${session.id}`, W / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  txtc(doc, C.muted);
  doc.text(
    isReg ? 'Analyse comparative de modèles de régression' : 'Analyse comparative de modèles de classification',
    W / 2,
    y,
    { align: 'center' },
  );

  // Trait fin de séparation
  y += 6;
  drawc(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.1);
  y += 8;

  // ── Tableau récapitulatif "Description de la session" ────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  txtc(doc, C.navy);
  doc.text('Description de la session', M, y);
  y += 4;

  const rows: string[][] = [
    ['Projet', `#${session.projectId}`],
    ['Date du rapport', genDate],
    ['Durée totale', duration(session)],
    ['Type de tâche', isReg ? 'Régression' : 'Classification'],
    ['Variable cible', session.config.targetColumn ?? 'N/A'],
    ['Nombre de modèles évalués', String(session.results.length)],
  ];

  if (best) {
    const metricLabel = best.primaryMetric?.displayName ?? best.primaryMetric?.name ?? 'Score';
    const metricVal = formatMetricValue(best.testScore, best.primaryMetric?.name);
    rows.push(['Modèle recommandé', modelName(best.modelType)]);
    rows.push([`${metricLabel} (${best.testLabel ?? 'test'})`, metricVal]);
  }

  autoTable(doc, {
    body: rows,
    startY: y,
    margin: { left: M, right: M },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: C.border,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.slate, cellWidth: 62, fillColor: C.navyLight },
      1: { textColor: C.slate },
    },
    theme: 'plain',
  });

  y = finalY(doc, y) + 4;

  // Note de méthode si pas de modèle gagnant
  if (!best) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    txtc(doc, C.muted);
    fill(doc, C.navyLight);
    doc.rect(M, y, CW, 9, 'F');
    doc.text(
      "Aucun score d'évaluation indépendant — pas de modèle recommandé identifié.",
      M + 3,
      y + 6,
    );
    y += 11;
  }

  return y + 4;
}
