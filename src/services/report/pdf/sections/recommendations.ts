import autoTable from 'jspdf-autotable';
import type { PdfBuilder } from '../PdfBuilder';
import type { ReportContext, RGB } from '../../types';
import { C_AMBER, C_DARK, C_GREEN, C_INK, C_RED, C_ROW_ALT, C_TH_BG } from '../../theme';

type Rec = { priority: 'high' | 'medium' | 'low'; text: string };

export function renderRecommendations(
  pdf: PdfBuilder,
  ctx: ReportContext,
  targetColumn: string | null,
): void {
  pdf.sectionTitle('09', 'Recommandations prioritaires');

  const {
    constantCols,
    suspectedIds,
    missingEntries,
    totalRows,
    zeroSuspects,
    targetAnalysis,
    outlierCols,
    numericCount,
    highCardinalityCols,
  } = ctx;

  const recs: Rec[] = [];

  if (!targetColumn) {
    recs.push({
      priority: 'high',
      text: "Définir la variable cible dans la page Database avant de lancer l'entraînement.",
    });
  }
  if (constantCols.length > 0) {
    recs.push({
      priority: 'high',
      text: `Supprimer les colonnes à variance nulle : ${constantCols.slice(0, 4).join(', ')}${constantCols.length > 4 ? '…' : ''}.`,
    });
  }
  if (suspectedIds.length > 0) {
    recs.push({
      priority: 'high',
      text: `Exclure les colonnes identifiants du training pour éviter le sur-apprentissage : ${suspectedIds.slice(0, 4).join(', ')}${suspectedIds.length > 4 ? `… (+${suspectedIds.length - 4})` : ''}.`,
    });
  }

  const critMissing = missingEntries.filter(([, c]) => (c / totalRows) * 100 >= 40);
  if (critMissing.length > 0) {
    recs.push({
      priority: 'high',
      text:
        `Supprimer ${critMissing.length} colonne${critMissing.length > 1 ? 's' : ''} avec > 40% de manquants ` +
        `(${critMissing
          .slice(0, 3)
          .map(([n]) => n)
          .join(', ')}${critMissing.length > 3 ? '…' : ''}).`,
    });
  }
  if (zeroSuspects.length > 0) {
    recs.push({
      priority: 'high',
      text:
        `Requalifier les zéros comme valeurs manquantes dans : ${zeroSuspects.slice(0, 4).join(', ')}${zeroSuspects.length > 4 ? '…' : ''}. ` +
        `Un zéro biologiquement impossible (Glucose=0, BMI=0…) est un NaN masqué. Requalifiez avant d'imputer.`,
    });
  }
  if (targetAnalysis?.imbalanceRatio != null && targetAnalysis.imbalanceRatio > 3) {
    recs.push({
      priority: targetAnalysis.imbalanceRatio > 10 ? 'high' : 'medium',
      text:
        `Appliquer une stratégie de rééquilibrage — ratio ${targetAnalysis.imbalanceRatio.toFixed(1)}:1 sur la variable cible. ` +
        `Options : SMOTE (données synthétiques), class_weight="balanced", random undersampling. ` +
        `Utiliser F1, PR-AUC ou Balanced Accuracy comme métrique principale.`,
    });
  }

  const modMissing = missingEntries.filter(([, c]) => {
    const p = (c / totalRows) * 100;
    return p >= 5 && p < 40;
  });
  if (modMissing.length > 0) {
    recs.push({
      priority: 'medium',
      text:
        `Imputer ${modMissing.length} colonne${modMissing.length > 1 ? 's' : ''} avec des valeurs manquantes (5–40%) : ` +
        `médiane pour les colonnes numériques, mode pour les catégorielles, ou KNN si les corrélations sont fortes.`,
    });
  }
  if (outlierCols.length > 0) {
    recs.push({
      priority: 'medium',
      text:
        `Traiter les outliers dans : ${outlierCols
          .slice(0, 4)
          .map((c) => c.name)
          .join(', ')}${outlierCols.length > 4 ? `… (+${outlierCols.length - 4})` : ''}. ` +
        `Options : winsorisation (capping), transformation log, ou suppression si erreur de saisie avérée.`,
    });
  }
  if (numericCount > 0) {
    recs.push({
      priority: 'low',
      text: "Standardiser (StandardScaler) ou normaliser (MinMaxScaler) les variables numériques pour les modèles sensibles à l'échelle (SVM, KNN, régression logistique).",
    });
  }
  if (highCardinalityCols.length > 0) {
    recs.push({
      priority: 'low',
      text: `Encoder les colonnes à haute cardinalité par target encoding ou regroupement : ${highCardinalityCols.slice(0, 3).join(', ')}${highCardinalityCols.length > 3 ? '…' : ''}.`,
    });
  }
  if (targetAnalysis?.taskType.includes('Classification')) {
    recs.push({
      priority: 'low',
      text: 'Utiliser un split stratifié pour préserver les proportions de classes en train/test.',
    });
  }

  if (recs.length === 0) {
    recs.push({
      priority: 'low',
      text: "Données de bonne qualité — structurellement prêtes pour l'entraînement. Vérifiez néanmoins la cohérence métier des valeurs avant de lancer.",
    });
  }

  recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  const priorityLabel: Record<string, string> = {
    high: 'Priorité haute',
    medium: 'Priorité moyenne',
    low: 'Priorité basse',
  };
  const priorityColor: Record<string, RGB> = {
    high: C_RED,
    medium: C_AMBER,
    low: C_GREEN,
  };

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [['#', 'Priorité', 'Recommandation']],
    body: recs.map((r, i) => [String(i + 1), priorityLabel[r.priority], r.text]),
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 9, cellPadding: 3.5, textColor: C_INK },
    headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 40, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
    didParseCell: (hook) => {
      if (hook.column.index === 1 && hook.section === 'body') {
        const r = recs[hook.row.index];
        if (r) hook.cell.styles.textColor = priorityColor[r.priority];
      }
    },
  });
  pdf.y = pdf.getLastY() + 10;
}
