import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { C, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { ensureY, finalY, section } from '../drawing';

export function renderMetricsGuide(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { isReg } = ctx;

  y = ensureY(doc, y, 60);
  y = section(doc, '4.', "Guide d'interprétation des métriques", y);

  const glossaryRows: string[][] = isReg
    ? [
        [
          'R² (R-carré)',
          "Part de la variance de la cible expliquée par le modèle. Un R² de 0.90 signifie que 90 % de la variabilité est capturée. Seuil recommandé : ≥ 0.80.",
        ],
        [
          'RMSE\n(Root Mean Squared Error)',
          "Racine carrée de l'erreur quadratique moyenne. Exprimée dans l'unité de la cible. Pénalise fortement les grandes erreurs. Un RMSE élevé peut signaler une mauvaise estimation des valeurs extrêmes.",
        ],
        [
          'MAE\n(Mean Absolute Error)',
          "Erreur absolue moyenne. Plus robuste aux valeurs aberrantes que RMSE. Directement interprétable dans l'unité de la cible.",
        ],
        [
          'Train Score vs Test Score',
          "Un écart > 15 % entre score d'entraînement et score test indique du sur-apprentissage : le modèle mémorise les données d'entraînement sans généraliser.",
        ],
      ]
    : [
        [
          'Accuracy',
          "Proportion de cas correctement classés. Trompeuse en cas de déséquilibre des classes : un modèle prédisant uniquement la classe majoritaire peut atteindre une bonne accuracy sans rien apprendre.",
        ],
        [
          'Recall (Sensibilité)',
          "Proportion de cas positifs correctement détectés. En médecine, un Recall faible signifie que des patients atteints sont manqués (faux négatifs). Métrique critique pour les pathologies graves.",
        ],
        [
          'Precision (VPP)',
          "Parmi toutes les prédictions positives, proportion qui sont effectivement positives. Une Precision faible génère de nombreuses fausses alertes et alourdit la charge clinique.",
        ],
        [
          'F1-Score',
          "Moyenne harmonique du Recall et de la Precision. Indicateur équilibré, adapté aux jeux de données déséquilibrés. Seuil recommandé en clinique : ≥ 0.80.",
        ],
        [
          'ROC AUC',
          "Capacité globale à distinguer les positifs des négatifs, indépendamment du seuil de décision. AUC = 0.5 → aléatoire ; AUC = 1.0 → discrimination parfaite. Seuil recommandé : ≥ 0.80.",
        ],
        [
          'Spécificité',
          "Proportion de cas négatifs correctement identifiés. Une spécificité faible génère des faux positifs pouvant entraîner des examens ou traitements inutiles.",
        ],
        [
          'Balanced Accuracy',
          "Moyenne de Recall et Spécificité. Plus fiable que l'Accuracy standard en présence de classes déséquilibrées. Objectif : ≥ 0.75.",
        ],
      ];

  autoTable(doc, {
    head: [['Métrique', 'Définition']],
    body: glossaryRows,
    startY: y,
    margin: { left: M, right: M },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      overflow: 'linebreak',
      valign: 'top',
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
      0: { fontStyle: 'bold', textColor: C.navy, cellWidth: 52, fillColor: C.navyLight },
      1: { textColor: C.slate },
    },
    theme: 'plain',
  });

  return finalY(doc, y) + 6;
}
