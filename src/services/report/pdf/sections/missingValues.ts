import autoTable from 'jspdf-autotable';
import type { DatasetProfileOut } from '../../../databaseService';
import type { PdfBuilder } from '../PdfBuilder';
import type { ReportContext, RGB } from '../../types';
import { C_AMBER, C_DARK, C_GREEN, C_INK, C_RED, C_ROW_ALT, C_TH_BG } from '../../theme';
import { kindLabel } from '../../format';

export function renderMissingValues(
  pdf: PdfBuilder,
  ctx: ReportContext,
  profile: DatasetProfileOut,
): void {
  const { missingEntries, totalRows, zeroSuspects } = ctx;

  if (missingEntries.length === 0) {
    pdf.sectionTitle('05', 'Valeurs manquantes');
    if (zeroSuspects.length > 0) {
      pdf.para(
        `Aucune valeur manquante (NaN) n'a été détectée. Cependant, ${zeroSuspects.length} colonne${zeroSuspects.length > 1 ? 's contiennent' : ' contient'} des zéros suspects ` +
          `qui peuvent masquer des valeurs manquantes d'un point de vue métier (${zeroSuspects.slice(0, 3).join(', ')}${zeroSuspects.length > 3 ? '…' : ''}).`,
      );
    } else {
      pdf.para(
        'Aucune valeur manquante (NaN) détectée dans ce dataset. La qualité des données est optimale sur cet aspect.',
      );
    }
    return;
  }

  pdf.sectionTitle('05', 'Valeurs manquantes par colonne');

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [['Colonne', 'Type', 'Valeurs nulles', '%', 'Niveau', 'Action suggérée']],
    body: missingEntries.map(([col, count]) => {
      const pct = totalRows ? (count / totalRows) * 100 : 0;
      const colProfile = profile.profiles.find((p) => p.name === col);
      const colKind = colProfile ? kindLabel(colProfile.kind) : '—';
      let level: string;
      let action: string;
      if (pct >= 40) {
        level = 'Critique';
        action = 'Supprimer la colonne';
      } else if (pct >= 15) {
        level = 'Élevé';
        action = 'Imputation KNN / MICE';
      } else if (pct >= 5) {
        level = 'Modéré';
        action = 'Imputation médiane / mode';
      } else {
        level = 'Faible';
        action = 'Imputation simple';
      }
      return [col, colKind, count.toLocaleString(), `${pct.toFixed(1)}%`, level, action];
    }),
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: C_INK },
    headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
    didParseCell: (hook) => {
      if (hook.column.index === 4 && hook.section === 'body') {
        const v = hook.cell.raw as string;
        if (v === 'Critique') hook.cell.styles.textColor = C_RED;
        else if (v === 'Élevé') hook.cell.styles.textColor = [180, 100, 0] as RGB;
        else if (v === 'Modéré') hook.cell.styles.textColor = C_AMBER;
        else hook.cell.styles.textColor = C_GREEN;
      }
    },
  });
  pdf.y = pdf.getLastY() + 6;

  const critCount = missingEntries.filter(([, c]) => (c / totalRows) * 100 >= 40).length;
  const highCount = missingEntries.filter(([, c]) => {
    const p = (c / totalRows) * 100;
    return p >= 15 && p < 40;
  }).length;

  if (critCount > 0) {
    pdf.highlight(
      `${critCount} colonne${critCount > 1 ? 's ont' : ' a'} plus de 40% de valeurs manquantes — ` +
        `leur suppression est recommandée (l'imputation introduirait un biais majeur).`,
      'critical',
    );
  } else if (highCount > 0) {
    pdf.highlight(
      `${highCount} colonne${highCount > 1 ? 's ont' : ' a'} entre 15% et 40% de valeurs manquantes — ` +
        `une imputation avancée (KNN, MICE) est recommandée avant l'entraînement.`,
      'warning',
    );
  }
}
