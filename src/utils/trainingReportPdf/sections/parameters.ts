import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { C, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { finalY, section } from '../drawing';
import { modelName } from '../formatters';
import { splitLabel } from '../session';

export function renderParameters(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { session, isReg } = ctx;

  y = section(doc, '1.', "Paramètres de l'analyse", y);

  const configRows: string[][] = [
    ['Variable cible', session.config.targetColumn ?? 'N/A'],
    ['Type de tâche', isReg ? 'Régression' : 'Classification'],
    ['Méthode de partitionnement', splitLabel(session)],
    ['Modèles évalués', (session.config.models ?? []).map(modelName).join(' — ') || 'N/A'],
    ["Métriques d'optimisation", (session.config.metrics ?? []).join(', ') || 'N/A'],
    [
      "Recherche d'hyperparamètres",
      session.config.useGridSearch
        ? `Activée — validation croisée ${session.config.gridCvFolds} plis`
        : 'Désactivée',
    ],
    [
      'Gestion du déséquilibre',
      session.config.balancing?.strategy !== 'none'
        ? (session.config.balancing?.strategy ?? 'non spécifiée')
        : 'Aucune',
    ],
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

  return finalY(doc, y) + 10;
}
