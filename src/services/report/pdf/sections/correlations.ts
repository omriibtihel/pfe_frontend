import autoTable from 'jspdf-autotable';
import type { CorrelationOut } from '../../../databaseService';
import type { PdfBuilder } from '../PdfBuilder';
import { C_DARK, C_INK, C_ROW_ALT, C_TH_BG } from '../../theme';

export function renderCorrelations(pdf: PdfBuilder, correlationData: CorrelationOut): void {
  pdf.sectionTitle('08', 'Corrélations (Pearson)');

  const { columns: cols, matrix } = correlationData;
  const pairs: { a: string; b: string; corr: number }[] = [];
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const v = matrix?.[i]?.[j];
      if (Number.isFinite(v)) pairs.push({ a: cols[i], b: cols[j], corr: v });
    }
  }

  const top8pos = [...pairs].sort((a, b) => b.corr - a.corr).slice(0, 8);
  const top8neg = [...pairs].sort((a, b) => a.corr - b.corr).slice(0, 8);

  pdf.note(`${cols.length} colonnes numériques analysées.`);
  pdf.subHeading('Corrélations positives les plus fortes');

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [['Colonne A', 'Colonne B', 'r (Pearson)']],
    body: top8pos.map((p) => [p.a, p.b, `+${p.corr.toFixed(4)}`]),
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 9, cellPadding: 3, textColor: C_INK },
    headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
  });
  pdf.y = pdf.getLastY() + 6;

  pdf.subHeading('Corrélations négatives les plus fortes');

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [['Colonne A', 'Colonne B', 'r (Pearson)']],
    body: top8neg.map((p) => [p.a, p.b, p.corr.toFixed(4)]),
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 9, cellPadding: 3, textColor: C_INK },
    headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
  });
  pdf.y = pdf.getLastY() + 4;

  pdf.note("Corrélation n'implique pas causalité. À interpréter en tenant compte du contexte métier.");
}
