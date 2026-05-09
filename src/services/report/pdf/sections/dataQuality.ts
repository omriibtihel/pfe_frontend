import autoTable from 'jspdf-autotable';
import type { PdfBuilder } from '../PdfBuilder';
import type { ReportContext, RGB } from '../../types';
import {
  C_AMBER,
  C_DARK,
  C_GREEN,
  C_INK,
  C_MUTED,
  C_RED,
  C_ROW_ALT,
  C_TH_BG,
} from '../../theme';

export function renderDataQuality(pdf: PdfBuilder, ctx: ReportContext): void {
  pdf.sectionTitle('03', 'Qualité des données');

  const {
    numericCount,
    catCount,
    totalCols,
    completeness,
    missingEntries,
    heavyMissingCols,
    zeroSuspects,
    outlierCols,
    suspectedIds,
    constantCols,
    parasiteCols,
  } = ctx;

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [['Indicateur', 'Valeur', 'Interprétation']],
    body: [
      [
        'Colonnes numériques',
        String(numericCount),
        numericCount === 0 ? 'Aucune variable quantitative' : 'Prêtes pour les algorithmes numériques',
      ],
      [
        'Colonnes catégorielles',
        String(catCount),
        catCount === 0 ? 'Aucune variable qualitative' : 'Encodage nécessaire avant entraînement',
      ],
      ['Autres colonnes', String(totalCols - numericCount - catCount), 'Datetime, texte libre, type inconnu'],
      [
        'Complétude globale',
        `${completeness}%`,
        completeness >= 95
          ? 'Excellente'
          : completeness >= 85
            ? 'Satisfaisante'
            : completeness >= 70
              ? 'Attention requise'
              : 'Critique — imputation nécessaire',
      ],
      [
        'Colonnes avec valeurs manquantes',
        `${missingEntries.length} / ${totalCols}`,
        missingEntries.length === 0
          ? 'Aucun manquant (NaN)'
          : `Dont ${heavyMissingCols.length} colonne${heavyMissingCols.length > 1 ? 's' : ''} > 15%`,
      ],
      [
        'Zéros suspects (manquants codés ?)',
        String(zeroSuspects.length),
        zeroSuspects.length === 0
          ? 'Aucun — min > 0 pour toutes les colonnes numériques'
          : `${zeroSuspects.slice(0, 3).join(', ')}${zeroSuspects.length > 3 ? '…' : ''} — vérifier contexte métier`,
      ],
      [
        "Colonnes suspectes d'outliers",
        String(outlierCols.length),
        outlierCols.length === 0
          ? 'Aucun outlier flagrant (IQR×3)'
          : 'Impact fort : LR, SVM, KNN ; faible : arbres',
      ],
      [
        'Identifiants potentiels',
        String(suspectedIds.length),
        suspectedIds.length === 0
          ? 'Aucun détecté'
          : `À exclure : ${suspectedIds.slice(0, 3).join(', ')}${suspectedIds.length > 3 ? '…' : ''}`,
      ],
      [
        'Colonnes constantes',
        String(constantCols.length),
        constantCols.length === 0 ? 'Aucune' : 'À supprimer — aucune information discriminante',
      ],
      [
        'Valeurs parasites (non-numériques)',
        String(parasiteCols.length),
        parasiteCols.length === 0
          ? 'Aucune valeur suspecte détectée'
          : `${parasiteCols
              .slice(0, 3)
              .map((p) => p.name)
              .join(', ')}${parasiteCols.length > 3 ? '…' : ''} — remplacer par NaN`,
      ],
    ] as [string, string, string][],
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: C_INK },
    headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 68, textColor: C_DARK },
      1: { cellWidth: 22 },
      2: { textColor: C_MUTED },
    },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
    didParseCell: (hook) => {
      if (hook.column.index === 1 && hook.section === 'body') {
        if (hook.row.index === 3) {
          hook.cell.styles.textColor =
            completeness >= 95 ? C_GREEN : completeness >= 85 ? C_AMBER : C_RED;
          hook.cell.styles.fontStyle = 'bold';
        } else if (hook.row.index === 5 && zeroSuspects.length > 0) {
          hook.cell.styles.textColor = C_AMBER;
          hook.cell.styles.fontStyle = 'bold';
        } else if (hook.row.index === 8 && constantCols.length > 0) {
          hook.cell.styles.textColor = C_RED;
          hook.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
  pdf.y = pdf.getLastY() + 6;

  if (parasiteCols.length > 0) {
    pdf.subHeading('Qualité des données — Valeurs suspectes détectées');
    pdf.highlight(
      `${parasiteCols.length} colonne${parasiteCols.length > 1 ? 's contiennent' : ' contient'} des valeurs non-numériques qui devraient être remplacées par NaN avant l'entraînement.`,
      'warning',
    );
    autoTable(pdf.doc, {
      startY: pdf.y,
      head: [['Colonne', 'Occurrences', 'Valeurs suspectes', '% numérique']],
      body: parasiteCols.map((p) => [
        p.name,
        String(p.parasites!.count),
        p.parasites!.distinct
          .slice(0, 5)
          .map((v) => `"${v}"`)
          .join(', '),
        `${(p.parasites!.convertible_ratio * 100).toFixed(0)}%`,
      ]) as [string, string, string, string][],
      margin: { left: pdf.M, right: pdf.M },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_INK },
      headStyles: { fillColor: [255, 237, 213] as RGB, textColor: [154, 52, 18] as RGB, fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 25, halign: 'center' },
        2: { textColor: C_AMBER },
        3: { cellWidth: 25, halign: 'center' },
      },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: pdf.CW,
    });
    pdf.y = pdf.getLastY() + 10;
  } else {
    pdf.y += 4;
  }
}
