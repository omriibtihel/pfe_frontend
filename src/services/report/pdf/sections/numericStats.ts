import autoTable from 'jspdf-autotable';
import type { PdfBuilder } from '../PdfBuilder';
import type { ReportContext } from '../../types';
import { C_AMBER, C_DARK, C_INK, C_MUTED, C_ROW_ALT, C_TH_BG } from '../../theme';
import { fmt } from '../../format';

export function renderNumericStats(pdf: PdfBuilder, ctx: ReportContext): void {
  const { numericProfiles, outlierCols, zeroSuspects } = ctx;
  if (numericProfiles.length === 0) return;

  pdf.sectionTitle('06', 'Statistiques descriptives — colonnes numériques');

  const outlierColNames = new Set(outlierCols.map((c) => c.name));
  const zeroSuspectSet = new Set(zeroSuspects);

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [['Colonne', 'Min', 'P25', 'Médiane', 'Moyenne', 'P75', 'Max', 'Std', 'Notes']],
    body: numericProfiles.map((p) => {
      const flags: string[] = [];
      if (outlierColNames.has(p.name)) flags.push('Outliers');
      if (zeroSuspectSet.has(p.name)) flags.push('Zéros ?');
      return [
        p.name,
        fmt(p.numeric?.min),
        fmt(p.numeric?.p25),
        fmt(p.numeric?.p50),
        fmt(p.numeric?.mean),
        fmt(p.numeric?.p75),
        fmt(p.numeric?.max),
        fmt(p.numeric?.std),
        flags.length > 0 ? flags.join(', ') : '—',
      ];
    }),
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: C_INK },
    headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      8: { cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
    didParseCell: (hook) => {
      if (hook.column.index === 8 && hook.section === 'body') {
        const v = hook.cell.raw as string;
        hook.cell.styles.textColor = v !== '—' ? C_AMBER : C_MUTED;
        if (v !== '—') hook.cell.styles.fontStyle = 'bold';
      }
    },
  });
  pdf.y = pdf.getLastY() + 6;

  if (outlierCols.length > 0) {
    pdf.para(
      `${outlierCols.length} colonne${outlierCols.length > 1 ? 's présentent' : ' présente'} des valeurs extrêmes (IQR×3) : ` +
        `${outlierCols
          .slice(0, 4)
          .map((c) => c.name)
          .join(', ')}${outlierCols.length > 4 ? `… (+${outlierCols.length - 4})` : ''}. ` +
        `L'impact varie selon le modèle — fort pour la régression linéaire, SVM et KNN ; limité pour les arbres de décision et forêts aléatoires. ` +
        `Vérifiez s'il s'agit d'erreurs de saisie avant de capper ou de supprimer ces valeurs.`,
    );
  }
  if (zeroSuspects.length > 0) {
    pdf.highlight(
      `${zeroSuspects.length} colonne${zeroSuspects.length > 1 ? 's ont' : ' a'} un minimum de 0 avec une médiane strictement positive : ` +
        `${zeroSuspects.slice(0, 4).join(', ')}${zeroSuspects.length > 4 ? '…' : ''}. ` +
        `Ces zéros peuvent être des valeurs manquantes mal codées. Requalifiez-les en NaN avant imputation.`,
      'warning',
    );
  }
  if (outlierCols.length === 0 && zeroSuspects.length === 0) {
    pdf.note(
      'Aucun outlier flagrant (IQR×3) ni zéro suspect détecté. Les distributions numériques semblent cohérentes.',
    );
  }
}
