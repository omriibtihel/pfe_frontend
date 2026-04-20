import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TrainingSession } from '@/types';
import { buildClassificationView } from '@/components/training/results/trainingResultsHelpers';

import { W, M, CW, C, type RGB } from './constants';
import { quality, qualityColor, qualityLabel } from './quality';
import { safeN, pct, num4, sec, modelName, metricLabel } from './formatters';
import { fill, drawc, txtc, ensureY, bar, dot, section, hrule, drawMiniCurve, finalY, footers } from './drawing';
import { bestModel, duration, splitLabel } from './session';

// ── EXPORT PRINCIPAL ──────────────────────────────────────────────────────────
export function generateTrainingReportPdf(session: TrainingSession): void {
  if (!session.results?.length) {
    throw new Error('Aucun résultat disponible pour générer le rapport PDF.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const best = bestModel(session);
  const isReg = session.config.taskType === 'regression';
  const genDate = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  1. BANDEAU D'EN-TÊTE                                       ║
  // ╚══════════════════════════════════════════════════════════════╝

  // Header background — navy band
  fill(doc, C.navy);
  doc.rect(0, 0, W, 46, 'F');
  // Inner lighter stripe for depth
  fill(doc, [20, 40, 90] as RGB);
  doc.rect(0, 14, W, 28, 'F');
  fill(doc, C.navy);
  doc.rect(0, 0, W, 14, 'F');
  // Bottom accent line
  fill(doc, C.teal);
  doc.rect(0, 44, W, 3, 'F');

  // Logo & branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  txtc(doc, C.teal);
  doc.text('MEDICALVISION', M, 10);
  drawc(doc, C.teal);
  doc.setLineWidth(0.5);
  doc.line(M, 11.5, M + 35, 11.5);
  doc.setLineWidth(0.1);

  // Document type label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  txtc(doc, [147, 197, 253] as RGB);
  doc.text('RAPPORT D\'ANALYSE', M, 21);

  // Main title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  txtc(doc, C.white);
  doc.text('Apprentissage automatique', M, 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  txtc(doc, C.navyLight);
  doc.text('Aide a la decision clinique \u2014 analyse comparative de modeles', M, 39);

  // Metadata — right aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  txtc(doc, C.navyLight);
  doc.text(`Session #${session.id}  \u2022  Projet #${session.projectId}`, W - M, 11, { align: 'right' });
  doc.text(genDate, W - M, 20, { align: 'right' });
  doc.text(`Duree : ${duration(session)}`, W - M, 29, { align: 'right' });

  let y = 52;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  2. RÉSUMÉ EXÉCUTIF                                         ║
  // ╚══════════════════════════════════════════════════════════════╝

  if (best) {
    const bestCV = isReg ? null : buildClassificationView(best);
    const mainScore = safeN(best.testScore);
    const mainQ = quality(mainScore);

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
    const scoreLabel = isReg ? 'R² (test)' : 'Accuracy (test)';
    doc.text(scoreLabel, M + 4, y + 33);
    bar(doc, M + 4, y + 35, 55, 4, mainScore);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    txtc(doc, qualityColor(mainQ));
    doc.text(isReg ? num4(mainScore) : pct(mainScore), M + 61, y + 39);

    // Métriques clés (droite de la boîte)
    const keyMetrics = isReg
      ? [
          { label: 'RMSE',        v: safeN(best.metrics?.rmse),  lower: true },
          { label: 'MAE',         v: safeN(best.metrics?.mae),   lower: true },
          { label: 'Train Score', v: safeN(best.trainScore) },
        ]
      : [
          { label: 'Recall',      v: bestCV?.recallMain ?? null },
          { label: 'Precision',   v: bestCV?.precisionMain ?? null },
          { label: 'F1-Score',    v: bestCV?.f1Main ?? null },
          { label: 'ROC AUC',     v: bestCV?.rocAuc ?? null },
        ];

    const kColW = (CW - 80) / keyMetrics.length;
    let kx = M + 80;
    for (const km of keyMetrics) {
      const kq = quality(km.v, km.lower ?? false);
      dot(doc, kx + 3, y + 15, kq);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      txtc(doc, qualityColor(kq));
      doc.text(isReg ? (km.lower ? num4(km.v) : num4(km.v)) : pct(km.v), kx + 7, y + 19);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      txtc(doc, C.muted);
      doc.text(km.label, kx + 7, y + 24);
      // mini bar
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
    const note = isReg
      ? `Ce modèle présente une performance ${noteQ} et explique ${pct(mainScore)} de la variance de la variable cible.`
      : `Ce modèle présente une performance ${noteQ}. Il est adapté à une utilisation en assistance à la décision clinique.`;
    doc.text(note, M + 4, y + 44);

    y += 53;
  }

  y += 3;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  3. PARAMÈTRES DE L'ANALYSE                                 ║
  // ╚══════════════════════════════════════════════════════════════╝

  y = section(doc, '1.', "Paramètres de l'analyse", y);

  const configRows: string[][] = [
    ['Variable cible',               session.config.targetColumn ?? 'N/A'],
    ['Type de tâche',                isReg ? 'Régression' : 'Classification'],
    ['Méthode de partitionnement',   splitLabel(session)],
    ['Modèles évalués',              (session.config.models ?? []).map(modelName).join(' — ') || 'N/A'],
    ['Métriques d\'optimisation',    (session.config.metrics ?? []).join(', ') || 'N/A'],
    ['Recherche d\'hyperparamètres', session.config.useGridSearch
      ? `Activée — validation croisée ${session.config.gridCvFolds} plis`
      : 'Désactivée'],
    ['Gestion du déséquilibre',      session.config.balancing?.strategy !== 'none'
      ? (session.config.balancing?.strategy ?? 'non spécifiée')
      : 'Aucune'],
  ];

  const prep = session.config.preprocessing?.defaults;
  if (prep) {
    configRows.push([
      'Prétraitement automatique',
      [
        `Imputation num. : ${prep.numericImputation}`,
        `Normalisation : ${prep.numericScaling}`,
        `Imputation cat. : ${prep.categoricalImputation}`,
        `Encodage cat. : ${prep.categoricalEncoding}`,
      ].join('\n'),
    ]);
  }

  autoTable(doc, {
    body: configRows,
    startY: y,
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 3.2, overflow: 'linebreak', valign: 'middle' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: C.bg, cellWidth: 62, textColor: C.muted },
      1: { textColor: C.slate },
    },
    theme: 'plain',
    tableLineColor: C.border,
    tableLineWidth: 0.15,
  });

  y = finalY(doc, y) + 10;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  4. COMPARAISON DES MODÈLES — TABLEAU                       ║
  // ╚══════════════════════════════════════════════════════════════╝

  y = ensureY(doc, y, 25);
  y = section(doc, '2.', 'Comparaison des performances', y);

  const tHead = isReg
    ? ['Model', 'R² (test)', 'RMSE', 'MAE', 'Train Score', 'Time']
    : ['Model', 'Accuracy', 'Recall', 'Precision', 'F1-Score', 'ROC AUC', 'Time'];

  const tBody: string[][] = session.results.map((r) => {
    const isBest = r.id === best?.id;
    const label = (isBest ? '* ' : '') + modelName(r.modelType);
    if (isReg) {
      return [label, num4(r.metrics?.r2 ?? r.testScore), num4(r.metrics?.rmse),
              num4(r.metrics?.mae), pct(r.trainScore), sec(r.trainingTime)];
    }
    const cv = buildClassificationView(r);
    return [label, pct(cv.accuracy ?? r.testScore), pct(cv.recallMain),
            pct(cv.precisionMain), pct(cv.f1Main), pct(cv.rocAuc), sec(r.trainingTime)];
  });

  autoTable(doc, {
    head: [tHead],
    body: tBody,
    startY: y,
    margin: { left: M, right: M },
    headStyles: {
      fillColor: C.navy, textColor: C.white, fontStyle: 'bold',
      fontSize: 7.5, halign: 'center', overflow: 'linebreak', cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, textColor: C.slate, halign: 'center', overflow: 'linebreak', cellPadding: 3 },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 42, overflow: 'linebreak' } },
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

  // Légende
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  txtc(doc, C.muted);
  doc.text(
    '* Best model.  Recall = Sensitivity.  Precision = Positive Predictive Value (PPV).  All metrics computed on the held-out test set.',
    M, y,
  );
  y += 8;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  5. VISUALISATION — BARRES DE PERFORMANCE                   ║
  // ╚══════════════════════════════════════════════════════════════╝

  // Trier par score décroissant
  const sortedResults = [...session.results].sort((a, b) =>
    (safeN(b.testScore) ?? -Infinity) - (safeN(a.testScore) ?? -Infinity),
  );

  const barNeeded = 8 + sortedResults.length * 9 + 6;
  y = ensureY(doc, y, barNeeded);

  // Titre de la visualisation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  txtc(doc, C.navy);
  const vizLabel = isReg ? 'R² — test set' : 'Accuracy — test set';
  doc.text(`Performance ranking : ${vizLabel}`, M, y);
  y += 5;

  // Ligne d'en-tête de la visualisation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  txtc(doc, C.muted);
  doc.text('Model', M + 2, y);
  doc.text('Performance', M + 52, y);
  doc.text('Score', M + 118, y);
  doc.text('Level', M + 135, y);
  y += 3;
  hrule(doc, y);
  y += 3;

  const BAR_X  = M + 50;
  const BAR_LEN = 65;
  const BAR_H2  = 4;

  for (const r of sortedResults) {
    const isBest = r.id === best?.id;
    const score  = safeN(r.testScore);
    const q      = quality(score);

    // Fond de ligne
    if (isBest) {
      fill(doc, C.amberBg);
      doc.rect(M, y - 1, CW, BAR_H2 + 4, 'F');
    }

    // Nom du modèle
    doc.setFont('helvetica', isBest ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    txtc(doc, isBest ? C.amber : C.slate);
    doc.text((isBest ? '* ' : '  ') + modelName(r.modelType), M + 2, y + 3.5);

    // Barre
    bar(doc, BAR_X, y, BAR_LEN, BAR_H2, score);

    // Score
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    txtc(doc, qualityColor(q));
    doc.text(isReg ? num4(score) : pct(score), BAR_X + BAR_LEN + 4, y + 3.5);

    // Niveau (badge)
    dot(doc, BAR_X + BAR_LEN + 23, y + 2.2, q);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    txtc(doc, qualityColor(q));
    doc.text(qualityLabel(q), BAR_X + BAR_LEN + 27, y + 3.5);

    y += BAR_H2 + 5;
  }

  y += 6;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  6. ANALYSE DÉTAILLÉE PAR MODÈLE                            ║
  // ╚══════════════════════════════════════════════════════════════╝

  y = ensureY(doc, y, 25);
  y = section(doc, '3.', 'Analyse détaillée par modèle', y);
  y += 2;

  for (const r of session.results) {
    const isBest = r.id === best?.id;
    const cv = isReg ? null : buildClassificationView(r);

    y = ensureY(doc, y, 45);

    // ── En-tête du modèle ───────────────────────────────────────
    const CARD_H = 13;
    // Fond + bordure
    fill(doc, isBest ? C.amberBg : C.bg);
    drawc(doc, isBest ? C.amber : C.border);
    doc.setLineWidth(isBest ? 0.35 : 0.15);
    doc.rect(M, y, CW, CARD_H, 'FD');
    doc.setLineWidth(0.1);

    // Barre latérale colorée
    fill(doc, isBest ? C.amber : C.navy);
    doc.rect(M, y, 4.5, CARD_H, 'F');

    // Nom du modèle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    txtc(doc, isBest ? C.amber : C.navy);
    const mLabel = modelName(r.modelType).toUpperCase();
    doc.text(mLabel, M + 8, y + 8.5);

    // Badge "RECOMMANDE" (pill) pour le meilleur modèle
    if (isBest) {
      const badgeX = M + 9 + doc.getTextWidth(mLabel) + 4;
      fill(doc, C.amber);
      doc.roundedRect(badgeX, y + 3.5, 32, 6, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      txtc(doc, C.white);
      doc.text('RECOMMANDE', badgeX + 16, y + 8, { align: 'center' });
    }

    // Statut + durée (droite)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    txtc(doc, C.muted);
    const statusTxt = r.status === 'completed' ? 'Termine' : (r.status ?? '');
    doc.text(`${statusTxt}  \u2014  ${sec(r.trainingTime)}`, W - M, y + 8.5, { align: 'right' });

    y += CARD_H + 3;

    // ── Grille de métriques ─────────────────────────────────────
    type MetricEntry = { label: string; val: string; raw: number | null; lower?: boolean };
    const mList: MetricEntry[] = isReg
      ? [
          { label: 'R² (test)',    val: num4(r.testScore),       raw: safeN(r.testScore) },
          { label: 'Train Score',  val: pct(r.trainScore),        raw: safeN(r.trainScore) },
          { label: 'RMSE',         val: num4(r.metrics?.rmse),    raw: safeN(r.metrics?.rmse),  lower: true },
          { label: 'MAE',          val: num4(r.metrics?.mae),     raw: safeN(r.metrics?.mae),   lower: true },
          { label: 'MSE',          val: num4(r.metrics?.mse),     raw: safeN(r.metrics?.mse),   lower: true },
        ]
      : [
          { label: 'Accuracy',          val: pct(cv?.accuracy),         raw: cv?.accuracy ?? null },
          { label: 'Recall',            val: pct(cv?.recallMain),        raw: cv?.recallMain ?? null },
          { label: 'Precision',         val: pct(cv?.precisionMain),     raw: cv?.precisionMain ?? null },
          { label: 'F1-Score',          val: pct(cv?.f1Main),            raw: cv?.f1Main ?? null },
          { label: 'ROC AUC',           val: pct(cv?.rocAuc),            raw: cv?.rocAuc ?? null },
          { label: 'Specificity',       val: pct(cv?.specificity),       raw: cv?.specificity ?? null },
          { label: 'Balanced Accuracy', val: pct(cv?.balancedAccuracy),  raw: cv?.balancedAccuracy ?? null },
          { label: 'Train Score',       val: pct(r.trainScore),          raw: safeN(r.trainScore) },
        ].filter(m => m.raw != null);

    // Affichage 4 colonnes — cartes metriques
    const NCOLS = 4;
    const CELL_W = CW / NCOLS;
    const CELL_H = 18;
    let col = 0;
    let rowY = y;

    for (const m of mList) {
      const cx = M + col * CELL_W;
      const q = quality(m.raw, m.lower ?? false);

      // Fond de cellule avec bordure
      fill(doc, col % 2 === 0 ? C.bg : C.white);
      drawc(doc, C.border);
      doc.setLineWidth(0.15);
      doc.rect(cx, rowY, CELL_W, CELL_H, 'FD');
      doc.setLineWidth(0.1);

      // Bandeau superieur colore (indique la qualite)
      fill(doc, qualityColor(q));
      doc.rect(cx, rowY, CELL_W, 1.5, 'F');

      // Point de qualite
      dot(doc, cx + 5, rowY + 7, q);

      // Valeur
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      txtc(doc, qualityColor(q));
      doc.text(m.val, cx + 10, rowY + 9.5);

      // Barre de progression
      bar(doc, cx + 10, rowY + 11, CELL_W - 15, 2.5, m.raw, m.lower ?? false);

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      txtc(doc, C.muted);
      const lLines = doc.splitTextToSize(m.label, CELL_W - 12);
      doc.text(lLines, cx + 10, rowY + 16);

      col++;
      if (col >= NCOLS) { col = 0; rowY += CELL_H + 1; }
    }
    if (col > 0) rowY += CELL_H + 1;
    y = rowY + 3;

    // Bordure sous la grille
    hrule(doc, y);
    y += 5;

    // ── Hyperparamètres ─────────────────────────────────────────
    const hp = (r.hyperparams?.best ?? r.hyperparams?.effective) as Record<string, unknown> | null | undefined;
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

    // ── Validation croisée ───────────────────────────────────────
    if (r.isCV && r.cvSummary) {
      y = ensureY(doc, y, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      const kf = r.kFoldsUsed ?? session.config.kFolds;
      doc.text(
        `Validation croisée : ${kf} plis (${r.cvSummary.n_folds_ok} réussis)` +
        (r.hasHoldoutTest ? '  —  jeu de test holdout séparé' : ''),
        M, y,
      );
      y += 5;

      const cvRows = Object.entries(r.cvSummary.mean ?? {})
        .filter(([, v]) => v != null)
        .map(([k, mv]) => {
          const sv = (r.cvSummary!.std ?? {})[k];
          const mf = isReg ? num4(mv) : pct(mv);
          const sf = sv != null ? (isReg ? num4(sv) : pct(sv)) : '—';
          return [metricLabel(k), `${mf}  ±  ${sf}`];
        });

      if (cvRows.length) {
        autoTable(doc, {
          body: cvRows,
          startY: y,
          margin: { left: M, right: M + CW * 0.55 },
          styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 44 },
            1: { textColor: C.slate },
          },
          theme: 'plain',
          tableLineColor: C.border,
          tableLineWidth: 0.1,
        });
        y = finalY(doc, y) + 4;
      }
    }

    // ── Variables les plus influentes ────────────────────────────
    const fi = Array.isArray(r.featureImportance)
      ? r.featureImportance
          .filter(f => f?.feature && Number.isFinite(Number(f.importance)))
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

    // ── Courbes ROC / PR ─────────────────────────────────────────
    const { curves } = r;
    if (!isReg && curves && (curves.roc?.length || curves.pr?.length)) {
      const CHART_W = 76;
      const CHART_H = 58;
      y = ensureY(doc, y, CHART_H + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      txtc(doc, C.navy);
      doc.text('Courbes de performance', M, y);
      y += 5;

      const rocAuc = safeN(r.metrics?.roc_auc);
      const prAuc  = safeN(r.metrics?.pr_auc);

      if (curves.roc?.length) {
        const aucTxt = rocAuc != null ? `AUC = ${pct(rocAuc)}` : '';
        drawMiniCurve(
          doc, curves.roc as [number, number][],
          M, y, CHART_W, CHART_H,
          'Courbe ROC (Sensibilité / 1−Spécificité)', aucTxt, true,
        );
      }
      if (curves.pr?.length) {
        const aucTxt = prAuc != null ? `AUC-PR = ${pct(prAuc)}` : '';
        const prX = curves.roc?.length ? M + CHART_W + 6 : M;
        drawMiniCurve(
          doc, curves.pr as [number, number][],
          prX, y, CHART_W, CHART_H,
          'Courbe Précision-Rappel', aucTxt, false,
        );
      }
      y += CHART_H + 5;
    }

    y += 4;
    hrule(doc, y);
    y += 7;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  7. INTERPRÉTATION CLINIQUE DES MÉTRIQUES                   ║
  // ╚══════════════════════════════════════════════════════════════╝

  y = ensureY(doc, y, 60);
  y = section(doc, '4.', 'Metrics — Clinical Interpretation Guide', y);

  const glossaryRows: string[][] = isReg
    ? [
        ['R²\n(R-squared)',
         'Proportion of variance in the target variable explained by the model. An R² of 0.90 means 90 % of variability is captured. Recommended threshold: ≥ 0.80.'],
        ['RMSE\n(Root Mean Squared Error)',
         'Square root of the mean squared error. Expressed in the same unit as the target variable. Heavily penalizes large errors. A high RMSE may indicate poor estimation of extreme values.'],
        ['MAE\n(Mean Absolute Error)',
         "Mean absolute error. More robust to outliers than RMSE. Directly interpretable in the target variable's unit. Used to evaluate the typical prediction error."],
        ['Train Score vs Test Score',
         'A gap > 15 % between train and test score indicates overfitting: the model memorizes training data without generalizing to unseen cases.'],
      ]
    : [
        ['Accuracy',
         'Proportion of correctly classified cases. Misleading when class imbalance is present: a naive model predicting only the majority class can achieve high accuracy without learning anything.'],
        ['Recall\n(Sensitivity)',
         'Proportion of true positive cases correctly detected. In medicine, low recall means sick patients are missed (false negatives). Critical metric for severe conditions where missing a case is costly.'],
        ['Precision\n(PPV — Positive Predictive Value)',
         'Among all positive predictions, the proportion that are true positives. Low precision leads to many false alarms and increases clinician workload unnecessarily.'],
        ['F1-Score',
         'Harmonic mean of Recall and Precision. Balanced indicator suited for imbalanced datasets. Recommended threshold for clinical use: ≥ 0.80.'],
        ['ROC AUC\n(Area Under the ROC Curve)',
         'Overall ability to discriminate positives from negatives, independent of the decision threshold. AUC = 0.5 → random classifier. AUC = 1.0 → perfect discrimination. Recommended threshold for clinical use: ≥ 0.80.'],
        ['Specificity',
         'Proportion of true negative cases correctly identified. Low specificity generates false positives that may lead to unnecessary follow-up exams or treatments.'],
        ['Balanced Accuracy',
         'Average of Recall and Specificity. More reliable than standard Accuracy when classes are imbalanced. Target value: ≥ 0.75.'],
      ];

  autoTable(doc, {
    body: glossaryRows,
    startY: y,
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak', valign: 'top', lineColor: C.border, lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.navy, cellWidth: 52, fillColor: C.navyLight },
      1: { textColor: C.slate },
    },
    alternateRowStyles: { fillColor: C.bg },
    theme: 'plain',
  });

  y = finalY(doc, y) + 10;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  8. AVERTISSEMENTS ET LIMITES                               ║
  // ╚══════════════════════════════════════════════════════════════╝

  const warnings: string[] = [];

  // Détection sur-apprentissage
  for (const r of session.results) {
    const tr = safeN(r.trainScore);
    const te = safeN(r.testScore);
    if (tr != null && te != null && (tr - te) > 0.15) {
      warnings.push(
        `${modelName(r.modelType)} : écart notable entre score entraînement (${isReg ? num4(tr) : pct(tr)}) et score test (${isReg ? num4(te) : pct(te)}) — risque de sur-apprentissage.`,
      );
    }
  }

  // Avertissements généraux obligatoires
  warnings.push(
    "Ce rapport est généré automatiquement. Les performances présentées sont mesurées sur un jeu de test interne et ne garantissent pas les résultats en conditions réelles.",
    "Tout déploiement en environnement clinique nécessite une validation prospective sur des données indépendantes, une revue par des experts du domaine et une évaluation éthique.",
    "La fiabilité des métriques dépend de la taille et de la représentativité du jeu de données. Un faible effectif peut entraîner des estimations instables.",
  );

  if (warnings.length > 0) {
    y = ensureY(doc, y, 30);
    y = section(doc, '5.', 'Avertissements et limites', y);

    for (const w of warnings.slice(0, 8)) {
      const wLines = doc.splitTextToSize(w, CW - 22);
      const wH = Math.max(11, wLines.length * 4.5 + 9);
      y = ensureY(doc, y, wH + 3);
      // Background
      fill(doc, C.orangeBg);
      drawc(doc, C.orange);
      doc.setLineWidth(0.2);
      doc.roundedRect(M, y, CW, wH, 1.5, 1.5, 'FD');
      doc.setLineWidth(0.1);
      // Left accent bar
      fill(doc, C.orange);
      doc.roundedRect(M, y, 4, wH, 1.5, 1.5, 'F');
      doc.rect(M + 1.5, y, 2.5, wH, 'F');
      // Icon circle
      fill(doc, C.orange);
      doc.circle(M + 12, y + wH / 2, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      txtc(doc, C.white);
      doc.text('!', M + 12, y + wH / 2 + 2.5, { align: 'center' });
      // Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      txtc(doc, C.slate);
      doc.text(wLines, M + 21, y + 6.5);
      y += wH + 3;
    }
  }

  // ── Pieds de page ────────────────────────────────────────────────────────
  footers(doc, genDate);

  doc.save(`rapport_session_${session.id}.pdf`);
}
