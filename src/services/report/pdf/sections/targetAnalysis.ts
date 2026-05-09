import autoTable from 'jspdf-autotable';
import type { PdfBuilder } from '../PdfBuilder';
import type { ReportContext } from '../../types';
import { C_ACCENT, C_AMBER, C_DARK, C_GREEN, C_INK, C_RED, C_ROW_ALT, C_TH_BG } from '../../theme';
import { fmt, kindLabel } from '../../format';

export function renderTargetAnalysis(
  pdf: PdfBuilder,
  ctx: ReportContext,
  targetColumn: string | null,
): void {
  pdf.sectionTitle('07', 'Analyse de la variable cible');

  if (!targetColumn) {
    pdf.highlight(
      "Aucune variable cible définie. Configurez-la dans la page Database avant de lancer l'entraînement.",
      'warning',
    );
    return;
  }

  const { targetAnalysis } = ctx;
  if (!targetAnalysis) {
    pdf.highlight(
      `La variable cible « ${targetColumn} » n'a pas pu être analysée (profil introuvable dans le dataset).`,
      'warning',
    );
    return;
  }

  const {
    profile: tp,
    taskType,
    effectiveUnique,
    classDistribution,
    imbalanceRatio,
    dominantClass,
    minorityClass,
    inferredFromMean,
  } = targetAnalysis;

  const nUnique = effectiveUnique ?? tp.unique;

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [],
    body: [
      ['Variable cible', targetColumn],
      ['Type de tâche', taskType],
      ['Type de colonne', kindLabel(tp.kind)],
      ['Valeurs uniques', nUnique != null ? String(nUnique) : '—'],
      [
        'Valeurs manquantes',
        tp.missing > 0 ? `${tp.missing.toLocaleString()} (${tp.missing_pct.toFixed(1)}%)` : 'Aucune',
      ],
    ] as [string, string][],
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 9.5, cellPadding: 3.5, textColor: C_INK },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: C_TH_BG, textColor: C_DARK },
      1: { textColor: C_INK },
    },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
  });
  pdf.y = pdf.getLastY() + 6;

  if (classDistribution.length > 0) {
    pdf.subHeading('Distribution des classes');

    if (inferredFromMean) {
      pdf.note(
        `Effectifs estimés à partir de la moyenne de la colonne (${(tp.numeric!.mean! * 100).toFixed(1)}% de valeurs positives). ` +
          `Les proportions sont approximatives.`,
      );
    }

    const totalLabeled = classDistribution.reduce((s, c) => s + c.count, 0);
    const maxCount = Math.max(...classDistribution.map((c) => c.count));
    const minCount = Math.min(...classDistribution.map((c) => c.count));
    const isBinary = classDistribution.length === 2;

    autoTable(pdf.doc, {
      startY: pdf.y,
      head: [['Classe', 'Effectif', 'Proportion', 'Représentation']],
      body: classDistribution.slice(0, 20).map(({ value, count }) => {
        const pct = totalLabeled > 0 ? (count / totalLabeled) * 100 : 0;
        let level: string;
        if (isBinary) {
          level = count === maxCount ? 'Majoritaire' : 'Minoritaire';
        } else if (count === maxCount) {
          level = 'Majoritaire';
        } else if (count === minCount && pct < 10) {
          level = 'Très minoritaire';
        } else if (pct >= 20) {
          level = 'Représentée';
        } else if (pct >= 10) {
          level = 'Minoritaire';
        } else {
          level = 'Très minoritaire';
        }
        return [value, count.toLocaleString(), `${pct.toFixed(1)}%`, level];
      }),
      margin: { left: pdf.M, right: pdf.M },
      styles: { fontSize: 9, cellPadding: 3.5, textColor: C_INK },
      headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: pdf.CW,
      didParseCell: (hook) => {
        if (hook.column.index === 3 && hook.section === 'body') {
          const v = hook.cell.raw as string;
          if (v === 'Majoritaire') hook.cell.styles.textColor = C_ACCENT;
          else if (v === 'Très minoritaire') hook.cell.styles.textColor = C_RED;
          else if (v === 'Minoritaire') hook.cell.styles.textColor = C_AMBER;
          else hook.cell.styles.textColor = C_GREEN;
        }
      },
    });
    pdf.y = pdf.getLastY() + 6;

    if (imbalanceRatio != null) {
      if (imbalanceRatio > 10) {
        pdf.highlight(
          `Déséquilibre sévère : ratio ${imbalanceRatio.toFixed(1)}:1 ` +
            `(classe dominante « ${dominantClass} » vs minoritaire « ${minorityClass} »). ` +
            `Actions recommandées : SMOTE, SMOTE+Tomek, class_weight. ` +
            `Métriques adaptées : F1, Recall, PR-AUC, Balanced Accuracy.`,
          'critical',
        );
      } else if (imbalanceRatio > 3) {
        pdf.highlight(
          `Déséquilibre modéré : ratio ${imbalanceRatio.toFixed(1)}:1. ` +
            `Envisagez SMOTE ou class_weight pour améliorer la sensibilité sur la classe minoritaire. ` +
            `Privilégiez F1-score ou ROC-AUC à l'accuracy pour l'évaluation.`,
          'warning',
        );
      } else {
        pdf.note(
          `Distribution équilibrée : ratio ${imbalanceRatio.toFixed(1)}:1. Un split stratifié est recommandé pour préserver les proportions en train/test.`,
        );
      }
    }
  } else if (taskType === 'Régression' && tp.numeric) {
    const skew =
      tp.numeric.mean != null && tp.numeric.p50 != null ? tp.numeric.mean - tp.numeric.p50 : null;
    const skewNote =
      skew != null && Math.abs(skew) > 0.05 * (tp.numeric.std ?? 1)
        ? ` La distribution est asymétrique (moyenne ${fmt(tp.numeric.mean)} vs médiane ${fmt(tp.numeric.p50)}).`
        : '';
    pdf.para(
      `Variable cible de régression — ` +
        `min ${fmt(tp.numeric.min)}, médiane ${fmt(tp.numeric.p50)}, ` +
        `max ${fmt(tp.numeric.max)}, écart-type ${fmt(tp.numeric.std)}.` +
        skewNote +
        ` Vérifiez la distribution pour décider d'une éventuelle transformation (log, Box-Cox) avant l'entraînement.`,
    );
  }
}
