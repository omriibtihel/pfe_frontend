import type jsPDF from 'jspdf';
import { formatMetricValue, isVarianceExplained } from '@/utils/metricUtils';
import { C, CW, M, W, type RGB } from '../constants';
import type { TrainingReportContext } from '../context';
import { cvForModel, isBounded } from '../enrichment';
import { bar, dot, drawc, fill, txtc } from '../drawing';
import { modelName, num4, pct, safeN } from '../formatters';
import { quality, qualityColor, qualityLabel } from '../quality';
import { duration } from '../session';

/**
 * Header band + executive summary box. Sets `y` to where the next section
 * should start.
 */
export function renderCover(doc: jsPDF, ctx: TrainingReportContext): number {
  drawHeader(doc, ctx);
  let y = 52;
  y = drawExecutiveSummary(doc, ctx, y);
  return y + 3;
}

function drawHeader(doc: jsPDF, ctx: TrainingReportContext): void {
  const { session, genDate } = ctx;

  // Header background — navy band
  fill(doc, C.navy);
  doc.rect(0, 0, W, 46, 'F');
  fill(doc, [20, 40, 90] as RGB);
  doc.rect(0, 14, W, 28, 'F');
  fill(doc, C.navy);
  doc.rect(0, 0, W, 14, 'F');
  fill(doc, C.teal);
  doc.rect(0, 44, W, 3, 'F');

  // Logo & branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  txtc(doc, C.teal);
  doc.text('MEDIQ', M, 10);
  drawc(doc, C.teal);
  doc.setLineWidth(0.5);
  doc.line(M, 11.5, M + 35, 11.5);
  doc.setLineWidth(0.1);

  // Document type label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  txtc(doc, [147, 197, 253] as RGB);
  doc.text("RAPPORT D'ANALYSE", M, 21);

  // Main title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  txtc(doc, C.white);
  doc.text('Apprentissage automatique', M, 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  txtc(doc, C.navyLight);
  doc.text('Aide a la decision clinique — analyse comparative de modeles', M, 39);

  // Metadata — right aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  txtc(doc, C.navyLight);
  doc.text(`Session #${session.id}  •  Projet #${session.projectId}`, W - M, 11, { align: 'right' });
  doc.text(genDate, W - M, 20, { align: 'right' });
  doc.text(`Duree : ${duration(session)}`, W - M, 29, { align: 'right' });
}

function drawExecutiveSummary(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { best, bestEnrichment, isReg } = ctx;

  if (!best) {
    // Train-only or fully-failed session: no best model identified.
    fill(doc, C.amberBg);
    drawc(doc, C.amber);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 22, 2, 2, 'FD');
    doc.setLineWidth(0.1);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    txtc(doc, C.slate);
    doc.text(
      "Aucun score d'évaluation disponible pour cette session — pas de meilleur modèle identifié.",
      M + 4,
      y + 13,
    );
    return y + 27;
  }

  const bestCV = isReg ? null : cvForModel(best, bestEnrichment?.detail);
  const mainScore = safeN(best.testScore);

  // Direction-aware metric framing — never assume "higher = better".
  const metricName = best.primaryMetric?.name;
  const metricDir = best.primaryMetric?.direction ?? 'higher_is_better';
  const metricLabel = best.primaryMetric?.displayName ?? metricName ?? 'Score';
  const metricValStr = formatMetricValue(best.testScore, metricName);
  const dirNote = metricDir === 'lower_is_better' ? '(plus bas = meilleur)' : '(plus haut = meilleur)';

  // bar()/quality() only make sense for bounded [0,1] metrics.
  const mainBounded = isBounded(metricName);
  const mainLowerIsBetter = metricDir === 'lower_is_better';
  const mainQ = mainBounded ? quality(mainScore, mainLowerIsBetter) : 'na';

  // Boîte ambre
  fill(doc, C.amberBg);
  drawc(doc, C.amber);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, 48, 2, 2, 'FD');
  doc.setLineWidth(0.1);

  // Bandeau "RÉSUMÉ EXÉCUTIF"
  fill(doc, C.amber);
  doc.roundedRect(M, y, 58, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  txtc(doc, C.white);
  doc.text('RÉSUMÉ EXÉCUTIF', M + 4, y + 5.5);

  // Modèle recommandé
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  txtc(doc, C.muted);
  doc.text('Modèle recommandé pour le déploiement :', M + 4, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  txtc(doc, C.navy);
  doc.text(modelName(best.modelType).toUpperCase(), M + 4, y + 26);

  // Score principal + barre
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  txtc(doc, C.muted);
  const scoreLabel = `${metricLabel} (${best.testLabel ?? 'test'}) ${dirNote}`;
  doc.text(scoreLabel, M + 4, y + 33);
  if (mainBounded) {
    bar(doc, M + 4, y + 35, 55, 4, mainScore, mainLowerIsBetter);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  txtc(doc, mainBounded ? qualityColor(mainQ) : C.navy);
  doc.text(metricValStr, M + 61, y + 39);

  // Métriques clés (droite de la boîte)
  const keyMetrics = isReg
    ? [
        { label: 'RMSE', v: safeN(best.metrics?.rmse), lower: true },
        { label: 'MAE', v: safeN(best.metrics?.mae), lower: true },
        { label: 'Train Score', v: safeN(best.trainScore) },
      ]
    : [
        { label: 'Recall', v: bestCV?.recallMain ?? null },
        { label: 'Precision', v: bestCV?.precisionMain ?? null },
        { label: 'F1-Score', v: bestCV?.f1Main ?? null },
        { label: 'ROC AUC', v: bestCV?.rocAuc ?? null },
      ];

  const kColW = (CW - 80) / keyMetrics.length;
  let kx = M + 80;
  for (const km of keyMetrics) {
    const kq = quality(km.v, km.lower ?? false);
    dot(doc, kx + 3, y + 15, kq);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    txtc(doc, qualityColor(kq));
    doc.text(isReg ? num4(km.v) : pct(km.v), kx + 7, y + 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    txtc(doc, C.muted);
    doc.text(km.label, kx + 7, y + 24);
    bar(doc, kx + 7, y + 26, kColW - 10, 3, km.v, km.lower ?? false);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    txtc(doc, qualityColor(kq));
    doc.text(qualityLabel(kq), kx + 7, y + 33);
    kx += kColW;
  }

  // Note de recommandation
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  txtc(doc, C.slate);
  const noteQ = qualityLabel(mainQ).toLowerCase();
  let note: string;
  if (isReg && isVarianceExplained(metricName)) {
    note = `Ce modèle présente une performance ${noteQ} et explique ${pct(mainScore)} de la variance de la variable cible.`;
  } else if (isReg) {
    note = `Ce modèle présente une performance ${noteQ}. ${metricLabel} : ${metricValStr} ${dirNote}.`;
  } else {
    note = `Ce modèle présente une performance ${noteQ}. Il est adapté à une utilisation en assistance à la décision clinique.`;
  }
  doc.text(note, M + 4, y + 44);

  return y + 53;
}
