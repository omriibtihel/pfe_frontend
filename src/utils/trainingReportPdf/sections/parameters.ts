import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { C, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { finalY, section } from '../drawing';
import { modelName } from '../formatters';
import { splitLabel } from '../session';

export function renderParameters(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { session } = ctx;

  y = section(doc, '1.', "Stratégie d'évaluation", y);

  const configRows: string[][] = [
    ['Méthode de partitionnement', splitLabel(session)],
    ['Modèles évalués', (session.config.models ?? []).map(modelName).join(' — ') || 'N/A'],
    ["Métriques d'optimisation", (session.config.metrics ?? []).join(', ') || 'N/A'],
    [
      "Recherche d'hyperparamètres",
      session.config.useGridSearch
        ? `GridSearchCV — validation croisée ${session.config.gridCvFolds} plis`
        : 'Désactivée',
    ],
    [
      'Gestion du déséquilibre',
      session.config.balancing?.strategy && session.config.balancing.strategy !== 'none'
        ? session.config.balancing.strategy
        : 'Aucune',
    ],
  ];

  const prep = session.config.preprocessing?.defaults;
  if (prep) {
    configRows.push(
      ['Imputation numérique', prep.numericImputation],
      ['Normalisation', prep.numericScaling],
      ['Imputation catégorielle', prep.categoricalImputation],
      ['Encodage catégoriel', prep.categoricalEncoding],
    );
  }

  autoTable(doc, {
    head: [['Paramètre', 'Valeur retenue']],
    body: configRows,
    startY: y,
    margin: { left: M, right: M },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: C.border,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.slate, cellWidth: 62, fillColor: C.navyLight },
      1: { textColor: C.slate },
    },
    theme: 'plain',
  });

  return finalY(doc, y) + 6;
}
