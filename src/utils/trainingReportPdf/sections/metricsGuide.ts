import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { C, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { ensureY, finalY, section } from '../drawing';

export function renderMetricsGuide(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { isReg } = ctx;

  y = ensureY(doc, y, 60);
  y = section(doc, '4.', 'Metrics — Clinical Interpretation Guide', y);

  const glossaryRows: string[][] = isReg
    ? [
        [
          'R²\n(R-squared)',
          'Proportion of variance in the target variable explained by the model. An R² of 0.90 means 90 % of variability is captured. Recommended threshold: ≥ 0.80.',
        ],
        [
          'RMSE\n(Root Mean Squared Error)',
          'Square root of the mean squared error. Expressed in the same unit as the target variable. Heavily penalizes large errors. A high RMSE may indicate poor estimation of extreme values.',
        ],
        [
          'MAE\n(Mean Absolute Error)',
          "Mean absolute error. More robust to outliers than RMSE. Directly interpretable in the target variable's unit. Used to evaluate the typical prediction error.",
        ],
        [
          'Train Score vs Test Score',
          'A gap > 15 % between train and test score indicates overfitting: the model memorizes training data without generalizing to unseen cases.',
        ],
      ]
    : [
        [
          'Accuracy',
          'Proportion of correctly classified cases. Misleading when class imbalance is present: a naive model predicting only the majority class can achieve high accuracy without learning anything.',
        ],
        [
          'Recall\n(Sensitivity)',
          'Proportion of true positive cases correctly detected. In medicine, low recall means sick patients are missed (false negatives). Critical metric for severe conditions where missing a case is costly.',
        ],
        [
          'Precision\n(PPV — Positive Predictive Value)',
          'Among all positive predictions, the proportion that are true positives. Low precision leads to many false alarms and increases clinician workload unnecessarily.',
        ],
        [
          'F1-Score',
          'Harmonic mean of Recall and Precision. Balanced indicator suited for imbalanced datasets. Recommended threshold for clinical use: ≥ 0.80.',
        ],
        [
          'ROC AUC\n(Area Under the ROC Curve)',
          'Overall ability to discriminate positives from negatives, independent of the decision threshold. AUC = 0.5 → random classifier. AUC = 1.0 → perfect discrimination. Recommended threshold for clinical use: ≥ 0.80.',
        ],
        [
          'Specificity',
          'Proportion of true negative cases correctly identified. Low specificity generates false positives that may lead to unnecessary follow-up exams or treatments.',
        ],
        [
          'Balanced Accuracy',
          'Average of Recall and Specificity. More reliable than standard Accuracy when classes are imbalanced. Target value: ≥ 0.75.',
        ],
      ];

  autoTable(doc, {
    body: glossaryRows,
    startY: y,
    margin: { left: M, right: M },
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: C.border,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.navy, cellWidth: 52, fillColor: C.navyLight },
      1: { textColor: C.slate },
    },
    alternateRowStyles: { fillColor: C.bg },
    theme: 'plain',
  });

  return finalY(doc, y) + 10;
}
