import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ModelResult } from '@/types';
import { metricDirection } from '@/utils/metricUtils';
import { C, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { ensureY, finalY, section, txtc } from '../drawing';
import { modelName, num4, pct, sec } from '../formatters';

/**
 * Section 2 — Comparaison des performances.
 * Tableau unique : 1 ligne par modèle, en-tête bleu marine, pas de couleurs sur les cellules.
 * Le meilleur modèle est marqué d'un astérisque uniquement.
 */
export function renderComparison(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { session, best, isReg } = ctx;

  y = ensureY(doc, y, 25);
  y = section(doc, '2.', 'Comparaison des performances', y);

  // ── Tri par score primaire (descendant si higher_is_better, ascendant sinon)
  const primaryMetric =
    session.results.find((r) => r.primaryMetric?.name)?.primaryMetric?.name ?? 'accuracy';
  const direction = metricDirection(primaryMetric);
  const nullVal = direction === 'lower_is_better' ? Infinity : -Infinity;

  const sorted = [...session.results].sort((a, b) => {
    const aS = a.testScore ?? nullVal;
    const bS = b.testScore ?? nullVal;
    return direction === 'lower_is_better' ? aS - bS : bS - aS;
  });

  // ── Entêtes & corps du tableau ────────────────────────────────────────────
  // Pour la classification on lit les métriques directement depuis r.metrics
  // (moyenne des plis en CV) — exactement comme la table UI, pour garantir
  // que les valeurs affichées ici correspondent à celles de la session.
  const tHead = isReg
    ? ['Rang', 'Modèle', 'R² (test)', 'RMSE', 'MAE', 'Train', 'Temps']
    : ['Rang', 'Modèle', 'AUC-ROC', 'PR-AUC', 'F1', 'Recall', 'Precision', 'Temps'];

  const tBody: string[][] = sorted.map((r, idx) => {
    const isBest = r.id === best?.id;
    const rank = r.testScore !== null && isFinite(r.testScore as number) ? `${idx + 1}` : '—';
    const label = (isBest ? '* ' : '') + modelName(r.modelType);
    if (isReg) {
      return [
        rank,
        label,
        num4(r.metrics?.r2 ?? r.testScore),
        num4(r.metrics?.rmse),
        num4(r.metrics?.mae),
        r.trainScore != null ? num4(r.trainScore) : '—',
        sec(r.trainingTime),
      ];
    }
    return [
      rank,
      label,
      pct(r.metrics?.rocAuc),
      pct(r.metrics?.prAuc),
      pct(r.metrics?.f1),
      pct(r.metrics?.recall),
      pct(r.metrics?.precision),
      sec(r.trainingTime),
    ];
  });

  autoTable(doc, {
    head: [tHead],
    body: tBody,
    startY: y,
    margin: { left: M, right: M },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'middle',
      halign: 'center',
      lineColor: C.border,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: 'bold', textColor: C.muted },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 46, textColor: C.slate },
    },
    alternateRowStyles: { fillColor: C.bg },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const r = sorted[data.row.index];
      // Pour le meilleur modèle, on garde simplement le texte en gras sans surlignage
      if (r?.id === best?.id) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = C.navy;
      }
    },
    theme: 'plain',
  });

  y = finalY(doc, y) + 4;

  // ── Note de bas de tableau ───────────────────────────────────────────────
  const evalNote = (model: ModelResult): string => {
    if (model.evaluationSource?.isIndependentTest) {
      const n = model.evaluationSource.nSamples;
      return `Évaluation sur jeu de test indépendant${n ? ` (${n} lignes)` : ''}.`;
    }
    return `Score = ${model.evaluationSource?.label ?? 'validation croisée (moyenne des plis)'}.`;
  };

  if (best) {
    const noteLines = [
      `* Modèle recommandé. Recall = Sensibilité. Precision = Valeur Prédictive Positive (VPP).`,
      evalNote(best),
    ];
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    txtc(doc, C.muted);
    for (const line of noteLines) {
      doc.text(line, M, y);
      y += 4;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    txtc(doc, C.muted);
    doc.text(
      "Classement non disponible — aucun score d'évaluation indépendant pour cette session.",
      M,
      y,
    );
    y += 4;
  }

  // ── Mention de la métrique de tri ────────────────────────────────────────
  const primaryDisplay =
    session.results.find((r) => r.primaryMetric?.name)?.primaryMetric?.displayName ?? primaryMetric;
  const dirLabel = direction === 'lower_is_better' ? 'plus bas = meilleur' : 'plus haut = meilleur';
  doc.text(`Tri par ${primaryDisplay} (${dirLabel}).`, M, y);

  return y + 6;
}
