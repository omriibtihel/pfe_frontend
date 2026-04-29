import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CurvesData, ExplainabilityData, ModelResult, TrainingSession } from '@/types';
import type { ModelResultDetail } from '@/types/training/results';
import { trainingService } from '@/services/trainingService';
import { buildClassificationView, type ClassificationView } from '@/components/training/results/trainingResultsHelpers';

// ── Per-model enrichment fetched alongside the lightweight session.results ──
// session.results is ModelResult[] (lightweight). Detail fields (hyperparams,
// CV summary, feature importance, curves) live on separate endpoints. We fetch
// them up-front and pass them down via a Map keyed by model id.
type ModelEnrichment = {
  detail: ModelResultDetail | null;
  explainability: ExplainabilityData | null;
  curves: CurvesData | null;
};

async function fetchModelEnrichments(
  projectId: string,
  sessionId: string,
  modelIds: string[],
): Promise<Map<string, ModelEnrichment>> {
  const map = new Map<string, ModelEnrichment>();
  await Promise.all(
    modelIds.map(async (id) => {
      const [detailRes, explRes, curvesRes] = await Promise.allSettled([
        trainingService.getModelDetails(projectId, sessionId, id),
        trainingService.getModelExplainability(projectId, sessionId, id),
        trainingService.getModelCurves(projectId, sessionId, id),
      ]);
      if (detailRes.status === 'rejected') {
        console.warn(`PDF: failed to fetch details for model ${id}`, detailRes.reason);
      }
      if (explRes.status === 'rejected') {
        console.warn(`PDF: failed to fetch explainability for model ${id}`, explRes.reason);
      }
      if (curvesRes.status === 'rejected') {
        console.warn(`PDF: failed to fetch curves for model ${id}`, curvesRes.reason);
      }
      map.set(id, {
        detail: detailRes.status === 'fulfilled' ? detailRes.value : null,
        explainability: explRes.status === 'fulfilled' ? explRes.value : null,
        curves: curvesRes.status === 'fulfilled' ? curvesRes.value : null,
      });
    }),
  );
  return map;
}

// Builds a ClassificationView from the lightweight MetricsSummary on ModelResult.
// Used as a fallback when the detail endpoint failed or has not been fetched.
// Fields not available in MetricsSummary (precisionMain, recallMain, specificity,
// balancedAccuracy) are returned as null.
function buildClassificationViewFromSummary(model: ModelResult): ClassificationView {
  return {
    classificationType: 'unknown',
    positiveLabel: null,
    accuracy: model.metrics?.accuracy ?? null,
    rocAuc: model.metrics?.rocAuc ?? null,
    prAuc: null,
    precisionMain: null,
    recallMain: null,
    f1Main: model.metrics?.f1 ?? null,
    balancedAccuracy: null,
    specificity: null,
    averages: [],
    perClass: [],
    confusion: { labels: [], matrix: [] },
    warnings: [],
  };
}

function cvForModel(
  model: ModelResult,
  detail: ModelResultDetail | null | undefined,
): ClassificationView {
  if (detail?.metricsDetailed) {
    return buildClassificationView(detail);
  }
  return buildClassificationViewFromSummary(model);
}

import { buildCvStabilityRows } from './cvStability';
import { W, M, CW, C, type RGB } from './constants';
import { quality, qualityColor, qualityLabel } from './quality';
import { safeN, pct, num4, sec, modelName, metricLabel } from './formatters';
import { fill, drawc, txtc, ensureY, bar, dot, section, hrule, drawMiniCurve, finalY, footers } from './drawing';
import { bestModel, duration, splitLabel } from './session';
import { isBetter, metricDirection, formatMetricValue, isVarianceExplained } from '@/utils/metricUtils';

// Metrics whose values live in [0, 1] and are safely comparable on a fixed
// visual scale (bar() / quality()). Unbounded metrics (RMSE, MAE, MSE) must
// not be passed to the bar/quality renderers — their raw values would map to
// arbitrary fill ratios and arbitrary "poor/excellent" labels.
const _BOUNDED_METRICS = new Set([
  "accuracy", "f1", "roc_auc", "pr_auc", "r2",
  "precision", "recall", "specificity", "balanced_accuracy",
  "log_loss", "brier_score",
]);

const isBounded = (name: string | null | undefined): boolean =>
  _BOUNDED_METRICS.has((name ?? "").toLowerCase());

// ── EXPORT PRINCIPAL ──────────────────────────────────────────────────────────
export async function generateTrainingReportPdf(
  session: TrainingSession,
  projectId: string,
): Promise<void> {
  if (!session.results?.length) {
    throw new Error('Aucun résultat disponible pour générer le rapport PDF.');
  }

  // Fetch per-model detail/explainability/curves up-front. session.results
  // is the lightweight list response and does not carry hyperparams, CV
  // summary, feature importance, or curves — these come from separate
  // endpoints. Failures are isolated per model via Promise.allSettled.
  const enrichments = await fetchModelEnrichments(
    projectId,
    session.id,
    session.results.map((r) => r.id),
  );
  const enrichmentFor = (id: string): ModelEnrichment =>
    enrichments.get(id) ?? { detail: null, explainability: null, curves: null };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const best = bestModel(session);
  const bestEnrichment = best ? enrichmentFor(best.id) : null;
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
    const bestCV = isReg ? null : cvForModel(best, bestEnrichment?.detail);
    const mainScore = safeN(best.testScore);

    // Direction-aware metric framing — never assume "higher = better".
    const metricName   = best.primaryMetric?.name;
    const metricDir    = best.primaryMetric?.direction ?? "higher_is_better";
    const metricLabel  = best.primaryMetric?.displayName ?? metricName ?? "Score";
    const metricValStr = formatMetricValue(best.testScore, metricName);
    const dirNote = metricDir === "lower_is_better"
      ? "(plus bas = meilleur)"
      : "(plus haut = meilleur)";

    // bar()/quality() only make sense for bounded [0,1] metrics. Unbounded
    // metrics (RMSE/MAE/MSE) skip the visual fill and use a neutral quality.
    const mainBounded = isBounded(metricName);
    const mainLowerIsBetter = metricDir === "lower_is_better";
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
    const scoreLabel = `${metricLabel} (${best.testLabel ?? "test"}) ${dirNote}`;
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
    let note: string;
    if (isReg && isVarianceExplained(metricName)) {
      // R² uniquement : peut être interprété comme part de variance expliquée.
      note = `Ce modèle présente une performance ${noteQ} et explique ${pct(mainScore)} de la variance de la variable cible.`;
    } else if (isReg) {
      // Autres métriques de régression (RMSE/MAE/MSE) : pas de framing "variance".
      note = `Ce modèle présente une performance ${noteQ}. ${metricLabel} : ${metricValStr} ${dirNote}.`;
    } else {
      note = `Ce modèle présente une performance ${noteQ}. Il est adapté à une utilisation en assistance à la décision clinique.`;
    }
    doc.text(note, M + 4, y + 44);

    y += 53;
  } else {
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
    y += 27;
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
              num4(r.metrics?.mae), r.trainScore != null ? num4(r.trainScore) : '—', sec(r.trainingTime)];
    }
    const cv = cvForModel(r, enrichmentFor(r.id).detail);
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
  const evalNote = (model: ModelResult): string => {
    if (model.evaluationSource?.isIndependentTest) {
      const n = model.evaluationSource.nSamples;
      return `Évaluation finale sur test holdout séparé${n ? ` (${n} lignes)` : ""}.`;
    }
    return `Score = ${model.evaluationSource?.label ?? "validation croisée"} — pas de jeu de test indépendant.`;
  };

  if (best) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    txtc(doc, C.muted);
    doc.text(
      `* Best model.  Recall = Sensitivity.  Precision = Positive Predictive Value (PPV).  ${evalNote(best)}`,
      M, y,
    );
    y += 8;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  5. VISUALISATION — BARRES DE PERFORMANCE                   ║
  // ╚══════════════════════════════════════════════════════════════╝

  // Session-level primary metric — single source of truth for sort direction.
  // Consistent with selectBestModel in metricUtils.ts: pick the first model
  // that declares a primary metric, fall back to "accuracy".
  const sessionPrimaryMetric =
    session.results.find((r) => r.primaryMetric?.name)?.primaryMetric?.name ?? "accuracy";

  // Trier par score (sens dépendant de la métrique)
  const sortedResults = [...session.results].sort((a, b) => {
    const direction = metricDirection(sessionPrimaryMetric);
    const nullVal = direction === "lower_is_better" ? Infinity : -Infinity;
    const aScore = a.testScore ?? nullVal;
    const bScore = b.testScore ?? nullVal;
    return direction === "lower_is_better" ? aScore - bScore : bScore - aScore;
  });

  // Only models with a real, finite testScore can be ranked — null/NaN scores
  // padded with ±Infinity above are excluded from the ranking display.
  const rankedModels = sortedResults.filter(
    (r) => r.testScore !== null && isFinite(r.testScore as number),
  );
  const hasRanking = rankedModels.length > 0;

  const rankLabel = (model: ModelResult, rank: number): string => {
    if (model.testScore === null || !isFinite(model.testScore as number)) {
      return "—";
    }
    return `#${rank + 1}`;
  };

  if (hasRanking) {
    const barNeeded = 8 + rankedModels.length * 9 + 6;
    y = ensureY(doc, y, barNeeded);

    // Titre de la visualisation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    txtc(doc, C.navy);
    const vizLabel = `${best?.primaryMetric?.displayName ?? best?.primaryMetric?.name ?? "Score"} — ${best?.evaluationSource?.label ?? "évaluation"}`;
    doc.text(`Performance ranking : ${vizLabel}`, M, y);
    y += 5;

    // Ligne d'en-tête de la visualisation
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

    const BAR_X  = M + 50;
    const BAR_LEN = 65;
    const BAR_H2  = 4;

    for (let idx = 0; idx < rankedModels.length; idx++) {
      const r = rankedModels[idx];
      const isBest = r.id === best?.id;
      const score  = safeN(r.testScore);

      // Direction-aware framing per row.
      const rMetricName = r.primaryMetric?.name;
      const rLowerIsBetter =
        (r.primaryMetric?.direction ?? metricDirection(rMetricName ?? "accuracy")) === "lower_is_better";
      const rBounded = isBounded(rMetricName);
      const q = rBounded ? quality(score, rLowerIsBetter) : 'na';

      // Fond de ligne
      if (isBest) {
        fill(doc, C.amberBg);
        doc.rect(M, y - 1, CW, BAR_H2 + 4, 'F');
      }

      // Rang
      doc.setFont('helvetica', isBest ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      txtc(doc, isBest ? C.amber : C.slate);
      doc.text(rankLabel(r, idx), M + 2, y + 3.5);

      // Nom du modèle
      doc.text((isBest ? '* ' : '  ') + modelName(r.modelType), M + 14, y + 3.5);

      // Barre — uniquement pour les métriques bornées [0,1].
      if (rBounded) {
        bar(doc, BAR_X, y, BAR_LEN, BAR_H2, score, rLowerIsBetter);
      }

      // Score
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      txtc(doc, rBounded ? qualityColor(q) : C.slate);
      doc.text(formatMetricValue(r.testScore, rMetricName), BAR_X + BAR_LEN + 4, y + 3.5);

      // Niveau (badge) — sauté pour les métriques non bornées (label trompeur).
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

  y += 6;

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  6. ANALYSE DÉTAILLÉE PAR MODÈLE                            ║
  // ╚══════════════════════════════════════════════════════════════╝

  y = ensureY(doc, y, 25);
  y = section(doc, '3.', 'Analyse détaillée par modèle', y);
  y += 2;

  for (const r of session.results) {
    const isBest = r.id === best?.id;
    const enrichment = enrichmentFor(r.id);
    const detail = enrichment.detail;
    const cv = isReg ? null : cvForModel(r, detail);

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
    // Models in session.results have already completed by definition \u2014 there
    // is no per-model status on the lightweight ModelResult, so we render
    // the training time only.
    doc.text(sec(r.trainingTime), W - M, y + 8.5, { align: 'right' });

    y += CARD_H + 3;

    // ── Grille de métriques ─────────────────────────────────────
    type MetricEntry = { label: string; val: string; raw: number | null; lower?: boolean };
    const mList: MetricEntry[] = isReg
      ? [
          { label: `${r.primaryMetric?.displayName ?? r.primaryMetric?.name ?? "Score"} (${r.testLabel ?? "test"})`,    val: num4(r.testScore),       raw: safeN(r.testScore) },
          { label: 'Train Score',  val: r.trainScore != null ? num4(r.trainScore) : '—', raw: safeN(r.trainScore) },
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

    // ── Validation croisée ───────────────────────────────────────
    // cvInfo comes from ModelResultDetail.analysis.crossValidation (never from
    // the lightweight ModelResult — that field does not exist there).
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
        M, y,
      );
      y += 5;

      // buildCvStabilityRows is a pure function (see cvStability.ts) so the
      // extraction logic can be unit-tested without constructing a jsPDF doc.
      const cvRows = buildCvStabilityRows(cvSummary, isReg);

      if (cvRows.length) {
        autoTable(doc, {
          head: [['Métrique', 'Moyenne  ±  Écart-type', 'Min', 'Max']],
          body: cvRows,
          startY: y,
          margin: { left: M, right: M + CW * 0.35 },
          styles: { fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak', halign: 'center' },
          headStyles: {
            fillColor: C.navy, textColor: C.white, fontSize: 7,
            fontStyle: 'bold', halign: 'center',
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
      // Render point estimates from the lightweight ModelResult so the CV
      // section is never silently blank.
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
          ['R²', r.metrics?.r2], ['RMSE', r.metrics?.rmse],
          ['MAE', r.metrics?.mae], ['MSE', r.metrics?.mse],
        ];
        for (const [label, v] of regPairs) {
          if (v != null) fbRows.push([label, num4(v)]);
        }
      } else {
        const clsPairs: [string, number | null | undefined][] = [
          ['Accuracy', r.metrics?.accuracy], ['ROC AUC', r.metrics?.rocAuc],
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

    // ── Variables les plus influentes ────────────────────────────
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

    // ── Courbes ROC / PR ─────────────────────────────────────────
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
      const prAuc  = safeN((r.metrics as Record<string, unknown>)?.['pr_auc'] as number | null);

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
    const tr = r.trainScore;
    const te = r.testScore;
    if (tr !== null && te !== null) {
      const direction = metricDirection(r.primaryMetric?.name ?? 'accuracy');
      const overfitThreshold = 0.15;
      const gap = direction === 'lower_is_better'
        ? te - tr   // test error >> train error = overfit
        : tr - te;  // train score >> test score = overfit
      if (gap > overfitThreshold) {
        warnings.push(
          `${modelName(r.modelType)} : écart notable entre score entraînement (${isReg ? num4(tr) : pct(tr)}) et score test (${isReg ? num4(te) : pct(te)}) — risque de sur-apprentissage.`,
        );
      }
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
