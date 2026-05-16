import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { C, CW, M, W } from '../constants';
import type { TrainingReportContext } from '../context';
import { buildCvStabilityRows } from '../cvStability';
import { cvForModel } from '../enrichment';
import { ensureY, finalY, section, txtc } from '../drawing';
import { modelName, num4, pct, sec } from '../formatters';

/**
 * Section 3 — fiche par modèle, mise en page sobre :
 *   - sous-titre "Modèle : <nom>" + temps
 *   - tableau des métriques (sans barres ni pastilles)
 *   - hyperparamètres (texte compact)
 *   - tableau de stabilité validation croisée
 *   - top features (tableau)
 */
export function renderDetailedAnalysis(
  doc: jsPDF,
  ctx: TrainingReportContext,
  y: number,
): number {
  const { session, best, isReg, enrichmentFor } = ctx;

  y = ensureY(doc, y, 25);
  y = section(doc, '3.', 'Analyse détaillée par modèle', y);

  for (const r of session.results) {
    const isBest = r.id === best?.id;
    const enrichment = enrichmentFor(r.id);
    const detail = enrichment.detail;
    const cv = isReg ? null : cvForModel(r, detail);
    // Métriques CV-moyenne directement depuis r.metrics (même source que la
    // table UI). cv reste utilisé pour la spécificité / balanced accuracy /
    // precisionMain quand le détail est disponible.
    const m = r.metrics;

    y = ensureY(doc, y, 35);

    // ── En-tête de fiche : "Modèle : <nom>" avec un trait de séparation ───
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    txtc(doc, C.navy);
    const title = `${modelName(r.modelType)}${isBest ? '  —  recommandé' : ''}`;
    doc.text(title, M, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    txtc(doc, C.muted);
    doc.text(`Temps : ${sec(r.trainingTime)}`, W - M, y, { align: 'right' });
    y += 4;

    // ── Tableau de métriques ────────────────────────────────────────────
    const metricRows: string[][] = isReg
      ? [
          [`${r.primaryMetric?.displayName ?? r.primaryMetric?.name ?? 'Score'} (${r.testLabel ?? 'test'})`, num4(r.testScore)],
          ['Train Score', r.trainScore != null ? num4(r.trainScore) : '—'],
          ['RMSE', num4(r.metrics?.rmse)],
          ['MAE', num4(r.metrics?.mae)],
          ['MSE', num4(r.metrics?.mse)],
        ]
      : (
          [
            ['AUC-ROC', pct(m?.rocAuc)],
            ['PR-AUC', pct(m?.prAuc)],
            ['F1-Score', pct(m?.f1)],
            ['Recall (Sensibilité)', pct(m?.recall)],
            ['Precision (VPP)', pct(m?.precision)],
            ['Accuracy', pct(m?.accuracy)],
            ['Spécificité', pct(cv?.specificity ?? m?.specificity)],
            ['Balanced Accuracy', pct(cv?.balancedAccuracy ?? m?.balancedAccuracy)],
            ['Train Score', pct(r.trainScore)],
          ] as string[][]
        ).filter((row) => row[1] !== 'N/A');

    autoTable(doc, {
      head: [['Métrique', 'Valeur']],
      body: metricRows,
      startY: y,
      margin: { left: M, right: M + CW * 0.45 },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.6,
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: C.border,
        lineWidth: 0.12,
      },
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: C.slate, cellWidth: 52, fillColor: C.navyLight },
        1: { textColor: C.slate, halign: 'right' },
      },
      theme: 'plain',
    });

    const metricEndY = finalY(doc, y);

    // ── Hyperparamètres (colonne de droite) ─────────────────────────────
    const hpBlock = (detail?.hyperparams ?? null) as
      | { best?: Record<string, unknown>; effective?: Record<string, unknown> }
      | null;
    const hp = (hpBlock?.best ?? hpBlock?.effective) as Record<string, unknown> | null | undefined;

    if (hp && Object.keys(hp).length > 0) {
      const hpStartX = M + CW * 0.6;
      const hpWidth = CW * 0.4;
      let hpY = y;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      txtc(doc, C.navy);
      doc.text('Hyperparamètres retenus', hpStartX, hpY);
      hpY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      txtc(doc, C.slate);

      for (const [k, v] of Object.entries(hp)) {
        const line = `${k} = ${String(v ?? 'N/A')}`;
        const lines = doc.splitTextToSize(line, hpWidth);
        doc.text(lines, hpStartX, hpY);
        hpY += lines.length * 4;
        if (hpY > metricEndY + 30) break;
      }
    }

    y = metricEndY + 5;

    // ── Validation croisée ──────────────────────────────────────────────
    const cvInfo = detail?.analysis?.crossValidation ?? null;
    const cvSummary = cvInfo?.cvSummary ?? null;

    if (r.isCV && cvSummary) {
      const kf = cvInfo?.kFoldsUsed ?? session.config.kFolds;
      const cvRows = buildCvStabilityRows(cvSummary, isReg);

      if (cvRows.length) {
        y = ensureY(doc, y, 24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        txtc(doc, C.navy);
        doc.text(
          `Stabilité en validation croisée — ${kf} plis (${cvSummary.n_folds_ok} réussis)` +
            (r.hasHoldoutTest ? ' · jeu de test holdout indépendant' : ''),
          M,
          y,
        );
        y += 3;

        autoTable(doc, {
          head: [['Métrique', 'Moyenne ± Écart-type', 'Min', 'Max']],
          body: cvRows,
          startY: y,
          margin: { left: M, right: M },
          styles: {
            fontSize: 8.5,
            cellPadding: 2.6,
            overflow: 'linebreak',
            halign: 'center',
            lineColor: C.border,
            lineWidth: 0.12,
          },
          headStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
          },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: C.slate, halign: 'left', fillColor: C.navyLight, cellWidth: 50 },
            1: { textColor: C.slate },
            2: { textColor: C.slate },
            3: { textColor: C.slate },
          },
          theme: 'plain',
        });
        y = finalY(doc, y) + 4;
      }
    }

    // ── Top features ────────────────────────────────────────────────────
    const featureImportance = enrichment.explainability?.featureImportance ?? [];
    const fi = Array.isArray(featureImportance)
      ? featureImportance
          .filter((f) => f?.feature && Number.isFinite(Number(f.importance)))
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 6)
      : [];

    if (fi.length > 0) {
      y = ensureY(doc, y, 14 + fi.length * 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      txtc(doc, C.navy);
      doc.text(`Variables les plus influentes (top ${fi.length})`, M, y);
      y += 3;

      autoTable(doc, {
        head: [['Rang', 'Variable', 'Importance']],
        body: fi.map((f, i) => [`${i + 1}`, f.feature, num4(f.importance)]),
        startY: y,
        margin: { left: M, right: M + CW * 0.25 },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.4,
          overflow: 'linebreak',
          lineColor: C.border,
          lineWidth: 0.12,
        },
        headStyles: {
          fillColor: C.navy,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
        },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center', textColor: C.muted },
          1: { textColor: C.slate, fontStyle: 'bold' },
          2: { textColor: C.slate, halign: 'right', cellWidth: 30 },
        },
        theme: 'plain',
      });
      y = finalY(doc, y) + 4;
    }

    // ── Séparateur entre fiches ────────────────────────────────────────
    y += 3;
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    doc.setLineWidth(0.1);
    y += 5;
  }

  return y;
}
