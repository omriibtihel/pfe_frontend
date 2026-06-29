import autoTable from 'jspdf-autotable';
import type { DatasetOut } from '../../../databaseService';
import type { PdfBuilder } from '../PdfBuilder';
import type { MLReadiness, ReportContext } from '../../types';
import { C_DARK, C_INK, C_ROW_ALT, C_TH_BG } from '../../theme';
import { fmtIntPdf } from '@/utils/pdfText';

export function renderGeneralInfo(
  pdf: PdfBuilder,
  ctx: ReportContext,
  dataset: DatasetOut,
  targetColumn: string | null,
): void {
  pdf.sectionTitle('02', 'Informations générales');

  const mlLevelLabel: Record<MLReadiness['level'], string> = {
    ready: 'Prêt',
    ready_with_prep: 'Prêt avec prétraitements',
    not_ready: 'Non prêt sans nettoyage',
  };

  const { totalRows, totalCols, completeness, zeroSuspects, targetAnalysis, mlReadiness } = ctx;

  autoTable(pdf.doc, {
    startY: pdf.y,
    head: [],
    body: [
      ['Fichier', dataset.original_name],
      ['Dimensions', `${fmtIntPdf(totalRows)} lignes × ${totalCols} colonnes`],
      ['Taille', dataset.size_bytes ? `${(dataset.size_bytes / 1024).toFixed(1)} Ko` : '—'],
      ['Format', dataset.content_type ?? '—'],
      ['Importé le', new Date(dataset.created_at).toLocaleDateString('fr-FR')],
      ['Variable cible', targetColumn ?? 'Non définie'],
      ['Tâche détectée', targetAnalysis?.taskType ?? '—'],
      ['Complétude globale', `${completeness}%`],
      ['Zéros suspects', zeroSuspects.length > 0 ? `${zeroSuspects.length} colonne(s)` : 'Aucun'],
      ['Préparation ML', mlLevelLabel[mlReadiness.level]],
    ] as [string, string][],
    margin: { left: pdf.M, right: pdf.M },
    styles: { fontSize: 9.5, cellPadding: 3.5, textColor: C_INK },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 52, fillColor: C_TH_BG, textColor: C_DARK },
      1: { textColor: C_INK },
    },
    alternateRowStyles: { fillColor: C_ROW_ALT },
    tableWidth: pdf.CW,
  });
  pdf.y = pdf.getLastY() + 10;
}
