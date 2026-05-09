import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { C, CW, M, W } from '../constants';
import type { TrainingReportContext } from '../context';
import { buildCvStabilityRows } from '../cvStability';
import { cvForModel } from '../enrichment';
import {
  bar,
  dot,
  drawMiniCurve,
  drawc,
  ensureY,
  fill,
  finalY,
  hrule,
  section,
  txtc,
} from '../drawing';
import { modelName, num4, pct, safeN, sec } from '../formatters';
import { quality, qualityColor } from '../quality';

/**
 * Section 3 — per-model detailed cards: header, metric grid, hyperparams,
 * CV table, top features, ROC/PR curves.
 */
export function renderDetailedAnalysis(
  doc: jsPDF,
  ctx: TrainingReportContext,
  y: number,
): number {
  const { session, best, isReg, enrichmentFor } = ctx;

  y = ensureY(doc, y, 25);
  y = section(doc, '3.', 'Analyse détaillée par modèle', y);
  y += 2;

  for (const r of session.results) {
    const isBest = r.id === best?.id;
    const enrichment = enrichmentFor(r.id);
    const detail = enrichment.detail;
    const cv = isReg ? null : cvForModel(r, detail);

    y = ensureY(doc, y, 45);

    // ── Card header ──────────────────────────────────────────────
    const CARD_H = 13;
    fill(doc, isBest ? C.amberBg : C.bg);
    drawc(doc, isBest ? C.amber : C.border);
    doc.setLineWidth(isBest ? 0.35 : 0.15);
    doc.rect(M, y, CW, CARD_H, 'FD');
    doc.setLineWidth(0.1);

    fill(doc, isBest ? C.amber : C.navy);
    doc.rect(M, y, 4.5, CARD_H, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    txtc(doc, isBest ? C.amber : C.navy);
    const mLabel = modelName(r.modelType).toUpperCase();
    doc.text(mLabel, M + 8, y + 8.5);

    if (isBest) {
      const badgeX = M + 9 + doc.getTextWidth(mLabel) + 4;
      fill(doc, C.amber);
      doc.roundedRect(badgeX, y + 3.5, 32, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      txtc(doc, C.white);
      doc.text('RECOMMANDE', badgeX + 16, y + 8, { align: 'center' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    txtc(doc, C.muted);
    doc.text(sec(r.trainingTime), W - M, y + 8.5, { align: 'right' });

    y += CARD_H + 3;

    // ── Metric grid ──────────────────────────────────────────────
    type MetricEntry = { label: string; val: string; raw: number | null; lower?: boolean };
    const mList: MetricEntry[] = isReg
      ? [
          {
            label: `${r.primaryMetric?.displayName ?? r.primaryMetric?.name ?? 'Score'} (${r.testLabel ?? 'test'})`,
            val: num4(r.testScore),
            raw: safeN(r.testScore),
          },
          {
            label: 'Train Score',
            val: r.trainScore != null ? num4(r.trainScore) : '—',
            raw: safeN(r.trainScore),
          },
          { label: 'RMSE', val: num4(r.metrics?.rmse), raw: safeN(r.metrics?.rmse), lower: true },
          { label: 'MAE', val: num4(r.metrics?.mae), raw: safeN(r.metrics?.mae), lower: true },
          { label: 'MSE', val: num4(r.metrics?.mse), raw: safeN(r.metrics?.mse), lower: true },
        ]
      : (
          [
            { label: 'Accuracy', val: pct(cv?.accuracy), raw: cv?.accuracy ?? null },
            { label: 'Recall', val: pct(cv?.recallMain), raw: cv?.recallMain ?? null },
            { label: 'Precision', val: pct(cv?.precisionMain), raw: cv?.precisionMain ?? null },
            { label: 'F1-Score', val: pct(cv?.f1Main), raw: cv?.f1Main ?? null },
            { label: 'ROC AUC', val: pct(cv?.rocAuc), raw: cv?.rocAuc ?? null },
            { label: 'Specificity', val: pct(cv?.specificity), raw: cv?.specificity ?? null },
            {
              label: 'Balanced Accuracy',
              val: pct(cv?.balancedAccuracy),
              raw: cv?.balancedAccuracy ?? null,
            },
            { label: 'Train Score', val: pct(r.trainScore), raw: safeN(r.trainScore) },
          ] as MetricEntry[]
        ).filter((m) => m.raw != null);

    const NCOLS = 4;
    const CELL_W = CW / NCOLS;
    const CELL_H = 18;
    let col = 0;
    let rowY = y;

    for (const m of mList) {
      const cx = M + col * CELL_W;
      const q = quality(m.raw, m.lower ?? false);

      fill(doc, col % 2 === 0 ? C.bg : C.white);
      drawc(doc, C.border);
      doc.setLineWidth(0.15);
      doc.rect(cx, rowY, CELL_W, CELL_H, 'FD');
      doc.setLineWidth(0.1);

      fill(doc, qualityColor(q));
      doc.rect(cx, rowY, CELL_W, 1.5, 'F');

      dot(doc, cx + 5, rowY + 7, q);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      txtc(doc, qualityColor(q));
      doc.text(m.val, cx + 10, rowY + 9.5);

      bar(doc, cx + 10, rowY + 11, CELL_W - 15, 2.5, m.raw, m.lower ?? false);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      txtc(doc, C.muted);
      const lLines = doc.splitTextToSize(m.label, CELL_W - 12);
      doc.text(lLines, cx + 10, rowY + 16);

      col++;
      if (col >= NCOLS) {
        col = 0;
        rowY += CELL_H + 1;
      }
    }
    if (col > 0) rowY += CELL_H + 1;
    y = rowY + 3;

    hrule(doc, y);
    y += 5;

    // ── Hyperparams ──────────────────────────────────────────────
    const hpBlock = (detail?.hyperparams ?? null) as
      | { best?: Record<string, unknown>; effective?: Record<string, unknown> }
      | null;
    const hp = (hpBlock?.best ?? hpBlock?.effective) as Record<string, unknown> | null | undefined;
    if (hp && Object.keys(hp).length > 0) {
      y = ensureY(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      doc.text('Hyperparamètres :', M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      txtc(doc, C.slate);
      const hpStr = Object.entries(hp)
        .map(([k, v]) => `${k} = ${String(v ?? 'N/A')}`)
        .join('   •   ');
      const hpLines = doc.splitTextToSize(hpStr, CW - 42);
      doc.text(hpLines, M + 42, y);
      y += hpLines.length * 4.5 + 3;
    }

    // ── Cross-validation ─────────────────────────────────────────
    const cvInfo = detail?.analysis?.crossValidation ?? null;
    const cvSummary = cvInfo?.cvSummary ?? null;
    if (r.isCV && cvSummary) {
      y = ensureY(doc, y, 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      const kf = cvInfo?.kFoldsUsed ?? session.config.kFolds;
      doc.text(
        `Validation croisée : ${kf} plis (${cvSummary.n_folds_ok} réussis)` +
          (r.hasHoldoutTest ? '  —  jeu de test holdout séparé' : ''),
        M,
        y,
      );
      y += 5;

      const cvRows = buildCvStabilityRows(cvSummary, isReg);

      if (cvRows.length) {
        autoTable(doc, {
          head: [['Métrique', 'Moyenne  ±  Écart-type', 'Min', 'Max']],
          body: cvRows,
          startY: y,
          margin: { left: M, right: M + CW * 0.35 },
          styles: { fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak', halign: 'center' },
          headStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center',
          },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 38, halign: 'left' },
            1: { textColor: C.slate },
            2: { textColor: C.slate },
            3: { textColor: C.slate },
          },
          theme: 'plain',
          tableLineColor: C.border,
          tableLineWidth: 0.1,
        });
        y = finalY(doc, y) + 4;
      }
    } else if (r.isCV) {
      // Fallback: detail endpoint failed or not yet available.
      y = ensureY(doc, y, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      const fallbackNote = r.testIsCvMean
        ? 'Validation croisée — score rapporté = moyenne des plis (détail non disponible) :'
        : `Validation croisée — ${r.testLabel ?? 'évaluation'} (détail non disponible) :`;
      doc.text(fallbackNote, M, y);
      y += 5;

      const fbRows: string[][] = [];
      if (isReg) {
        const regPairs: [string, number | null | undefined][] = [
          ['R²', r.metrics?.r2],
          ['RMSE', r.metrics?.rmse],
          ['MAE', r.metrics?.mae],
          ['MSE', r.metrics?.mse],
        ];
        for (const [label, v] of regPairs) {
          if (v != null) fbRows.push([label, num4(v)]);
        }
      } else {
        const clsPairs: [string, number | null | undefined][] = [
          ['Accuracy', r.metrics?.accuracy],
          ['ROC AUC', r.metrics?.rocAuc],
          ['F1-Score', r.metrics?.f1],
        ];
        for (const [label, v] of clsPairs) {
          if (v != null) fbRows.push([label, pct(v)]);
        }
      }

      if (fbRows.length) {
        autoTable(doc, {
          body: fbRows,
          startY: y,
          margin: { left: M, right: M + CW * 0.6 },
          styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 38 },
            1: { textColor: C.slate },
          },
          theme: 'plain',
          tableLineColor: C.border,
          tableLineWidth: 0.1,
        });
        y = finalY(doc, y) + 4;
      }
    }

    // ── Top influential features ─────────────────────────────────
    const featureImportance = enrichment.explainability?.featureImportance ?? [];
    const fi = Array.isArray(featureImportance)
      ? featureImportance
          .filter((f) => f?.feature && Number.isFinite(Number(f.importance)))
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 6)
      : [];

    if (fi.length > 0) {
      y = ensureY(doc, y, 12 + fi.length * 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      doc.text(`Variables les plus influentes (top ${fi.length}) :`, M, y);
      y += 5;

      const maxImp = fi[0]?.importance ?? 1;
      for (let i = 0; i < fi.length; i++) {
        const f = fi[i];
        const ratio = maxImp > 0 ? f.importance / maxImp : 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        txtc(doc, C.navy);
        doc.text(`${i + 1}.`, M + 2, y + 3);

        doc.setFont('helvetica', 'normal');
        txtc(doc, C.slate);
        doc.text(f.feature, M + 9, y + 3);

        bar(doc, M + 62, y, 50, 3.5, ratio);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        txtc(doc, C.navyMid);
        doc.text(num4(f.importance), M + 115, y + 3);

        y += 6;
      }
      y += 2;
    }

    // ── ROC / PR curves ──────────────────────────────────────────
    const curves = enrichment.curves;
    if (!isReg && curves && (curves.roc?.length || curves.pr?.length)) {
      const CHART_W = 76;
      const CHART_H = 58;
      y = ensureY(doc, y, CHART_H + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      doc.text('Courbes de performance', M, y);
      y += 5;

      const rocAuc = safeN(r.metrics?.rocAuc);
      const prAuc = safeN((r.metrics as Record<string, unknown>)?.['pr_auc'] as number | null);

      if (curves.roc?.length) {
        const aucTxt = rocAuc != null ? `AUC = ${pct(rocAuc)}` : '';
        drawMiniCurve(
          doc,
          curves.roc as [number, number][],
          M,
          y,
          CHART_W,
          CHART_H,
          'Courbe ROC (Sensibilité / 1−Spécificité)',
          aucTxt,
          true,
        );
      }
      if (curves.pr?.length) {
        const aucTxt = prAuc != null ? `AUC-PR = ${pct(prAuc)}` : '';
        const prX = curves.roc?.length ? M + CHART_W + 6 : M;
        drawMiniCurve(
          doc,
          curves.pr as [number, number][],
          prX,
          y,
          CHART_W,
          CHART_H,
          'Courbe Précision-Rappel',
          aucTxt,
          false,
        );
      }
      y += CHART_H + 5;
    }

    y += 4;
    hrule(doc, y);
    y += 7;
  }

  return y;
}
