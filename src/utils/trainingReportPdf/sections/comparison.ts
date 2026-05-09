import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ModelResult } from '@/types';
import { formatMetricValue, metricDirection } from '@/utils/metricUtils';
import { C, CW, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { cvForModel, isBounded } from '../enrichment';
import { bar, dot, ensureY, fill, finalY, hrule, section, txtc } from '../drawing';
import { modelName, num4, pct, safeN, sec } from '../formatters';
import { quality, qualityColor, qualityLabel } from '../quality';

export function renderComparison(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { session, best, isReg, enrichmentFor } = ctx;

  y = ensureY(doc, y, 25);
  y = section(doc, '2.', 'Comparaison des performances', y);

  // ── Table ─────────────────────────────────────────────────────────────────
  const tHead = isReg
    ? ['Model', 'R² (test)', 'RMSE', 'MAE', 'Train Score', 'Time']
    : ['Model', 'Accuracy', 'Recall', 'Precision', 'F1-Score', 'ROC AUC', 'Time'];

  const tBody: string[][] = session.results.map((r) => {
    const isBest = r.id === best?.id;
    const label = (isBest ? '* ' : '') + modelName(r.modelType);
    if (isReg) {
      return [
        label,
        num4(r.metrics?.r2 ?? r.testScore),
        num4(r.metrics?.rmse),
        num4(r.metrics?.mae),
        r.trainScore != null ? num4(r.trainScore) : '—',
        sec(r.trainingTime),
      ];
    }
    const cv = cvForModel(r, enrichmentFor(r.id).detail);
    return [
      label,
      pct(cv.accuracy ?? r.testScore),
      pct(cv.recallMain),
      pct(cv.precisionMain),
      pct(cv.f1Main),
      pct(cv.rocAuc),
      sec(r.trainingTime),
    ];
  });

  autoTable(doc, {
    head: [tHead],
    body: tBody,
    startY: y,
    margin: { left: M, right: M },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      overflow: 'linebreak',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: C.slate,
      halign: 'center',
      overflow: 'linebreak',
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 42, overflow: 'linebreak' },
    },
    alternateRowStyles: { fillColor: C.bg },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const r = session.results[data.row.index];
      if (r?.id === best?.id) {
        data.cell.styles.fillColor = C.amberBg;
        data.cell.styles.textColor = C.amber;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    tableLineColor: C.border,
    tableLineWidth: 0.15,
  });

  y = finalY(doc, y) + 4;

  // ── Légende ───────────────────────────────────────────────────────────────
  const evalNote = (model: ModelResult): string => {
    if (model.evaluationSource?.isIndependentTest) {
      const n = model.evaluationSource.nSamples;
      return `Évaluation finale sur test holdout séparé${n ? ` (${n} lignes)` : ''}.`;
    }
    return `Score = ${model.evaluationSource?.label ?? 'validation croisée'} — pas de jeu de test indépendant.`;
  };

  if (best) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    txtc(doc, C.muted);
    doc.text(
      `* Best model.  Recall = Sensitivity.  Precision = Positive Predictive Value (PPV).  ${evalNote(best)}`,
      M,
      y,
    );
    y += 8;
  }

  // ── Ranking visualization ─────────────────────────────────────────────────
  const sessionPrimaryMetric =
    session.results.find((r) => r.primaryMetric?.name)?.primaryMetric?.name ?? 'accuracy';

  const sortedResults = [...session.results].sort((a, b) => {
    const direction = metricDirection(sessionPrimaryMetric);
    const nullVal = direction === 'lower_is_better' ? Infinity : -Infinity;
    const aScore = a.testScore ?? nullVal;
    const bScore = b.testScore ?? nullVal;
    return direction === 'lower_is_better' ? aScore - bScore : bScore - aScore;
  });

  // Only models with a real, finite testScore can be ranked.
  const rankedModels = sortedResults.filter(
    (r) => r.testScore !== null && isFinite(r.testScore as number),
  );
  const hasRanking = rankedModels.length > 0;

  const rankLabel = (model: ModelResult, rank: number): string => {
    if (model.testScore === null || !isFinite(model.testScore as number)) return '—';
    return `#${rank + 1}`;
  };

  if (hasRanking) {
    const barNeeded = 8 + rankedModels.length * 9 + 6;
    y = ensureY(doc, y, barNeeded);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    txtc(doc, C.navy);
    const vizLabel = `${best?.primaryMetric?.displayName ?? best?.primaryMetric?.name ?? 'Score'} — ${best?.evaluationSource?.label ?? 'évaluation'}`;
    doc.text(`Performance ranking : ${vizLabel}`, M, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    txtc(doc, C.muted);
    doc.text('Rang', M + 2, y);
    doc.text('Model', M + 14, y);
    doc.text('Performance', M + 52, y);
    doc.text('Score', M + 118, y);
    doc.text('Level', M + 135, y);
    y += 3;
    hrule(doc, y);
    y += 3;

    const BAR_X = M + 50;
    const BAR_LEN = 65;
    const BAR_H2 = 4;

    for (let idx = 0; idx < rankedModels.length; idx++) {
      const r = rankedModels[idx];
      const isBest = r.id === best?.id;
      const score = safeN(r.testScore);

      const rMetricName = r.primaryMetric?.name;
      const rLowerIsBetter =
        (r.primaryMetric?.direction ?? metricDirection(rMetricName ?? 'accuracy')) === 'lower_is_better';
      const rBounded = isBounded(rMetricName);
      const q = rBounded ? quality(score, rLowerIsBetter) : 'na';

      if (isBest) {
        fill(doc, C.amberBg);
        doc.rect(M, y - 1, CW, BAR_H2 + 4, 'F');
      }

      doc.setFont('helvetica', isBest ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      txtc(doc, isBest ? C.amber : C.slate);
      doc.text(rankLabel(r, idx), M + 2, y + 3.5);

      doc.text((isBest ? '* ' : '  ') + modelName(r.modelType), M + 14, y + 3.5);

      if (rBounded) {
        bar(doc, BAR_X, y, BAR_LEN, BAR_H2, score, rLowerIsBetter);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      txtc(doc, rBounded ? qualityColor(q) : C.slate);
      doc.text(formatMetricValue(r.testScore, rMetricName), BAR_X + BAR_LEN + 4, y + 3.5);

      if (rBounded) {
        dot(doc, BAR_X + BAR_LEN + 23, y + 2.2, q);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        txtc(doc, qualityColor(q));
        doc.text(qualityLabel(q), BAR_X + BAR_LEN + 27, y + 3.5);
      }

      y += BAR_H2 + 5;
    }
  } else {
    y = ensureY(doc, y, 14);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 100, 0);
    doc.text(
      "Classement non disponible — aucun score d'évaluation indépendant pour cette session.",
      M,
      y + 4,
    );
    doc.setTextColor(0, 0, 0);
    y += 10;
  }
  return y + 6;
}
