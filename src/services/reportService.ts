/**
 * reportService.ts
 * Pure function — receives already-loaded data, generates and downloads a PDF.
 * No UI, no React, no side effects other than the download.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DatasetOut, DatasetOverviewOut, DatasetProfileOut, CorrelationOut } from './databaseService';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ReportSections = {
  generalInfo: boolean;
  summary: boolean;
  typeDistribution: boolean;
  missingValues: boolean;
  numericStats: boolean;
  correlations: boolean;
  observations: boolean;
};

export const DEFAULT_SECTIONS: ReportSections = {
  generalInfo: true,
  summary: true,
  typeDistribution: true,
  missingValues: true,
  numericStats: true,
  correlations: false,
  observations: true,
};

export type ReportInput = {
  dataset: DatasetOut;
  overview: DatasetOverviewOut;
  profile: DatasetProfileOut;
  targetColumn: string | null;
  correlationData?: CorrelationOut | null;
  sections: ReportSections;
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(d);
}

function kindLabel(k: string): string {
  const map: Record<string, string> = {
    numeric: 'Numérique',
    categorical: 'Catégorielle',
    text: 'Texte',
    datetime: 'Date/Heure',
    unknown: 'Inconnu',
  };
  return map[k] ?? k;
}

type RGB = [number, number, number];
const C_PRIMARY: RGB    = [37, 99, 235];
const C_RED: RGB        = [220, 38, 38];
const C_MUTED: RGB      = [100, 116, 139];
const C_DARK: RGB       = [15, 23, 42];
const C_LIGHT_BG: RGB   = [241, 245, 249];
const C_WHITE: RGB      = [255, 255, 255];

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function generateDatasetReport(input: ReportInput): void {
  const { dataset, overview, profile, targetColumn, correlationData, sections } = input;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const M   = 18; // margin
  const CW  = pw - 2 * M; // content width
  let y     = M;

  // ── Pre-computed aggregates ─────────────────────────────────────────────────
  const totalRows       = overview.shape.rows;
  const totalCols       = overview.shape.cols;
  const totalNulls      = Object.values(overview.missing).reduce((a, b) => a + b, 0);
  const completeness    = totalRows * totalCols > 0
    ? Math.round((1 - totalNulls / (totalRows * totalCols)) * 100)
    : 100;
  const numericProfiles = profile.profiles.filter(p => p.kind === 'numeric' && p.numeric);
  const numericCount    = numericProfiles.length;
  const catCount        = profile.profiles.filter(p => p.kind === 'categorical' || p.kind === 'text').length;
  const missingEntries  = Object.entries(overview.missing).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);

  // IQR-based outlier detection (mirrors DataExplorationPage logic)
  const outlierCols = profile.profiles.filter(p => {
    if (p.kind !== 'numeric' || !p.numeric) return false;
    const { p25, p75, min, max } = p.numeric;
    if (p25 == null || p75 == null || min == null || max == null) return false;
    const iqr = p75 - p25;
    return iqr > 0 && ((max - p75 > 3 * iqr) || (p25 - min > 3 * iqr));
  });

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const drawRunningHeader = () => {
    doc.setFillColor(...C_LIGHT_BG);
    doc.rect(0, 0, pw, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text('MedicalVision — Rapport d\'analyse', M, 7);
    doc.text(dataset.original_name, pw - M, 7, { align: 'right' });
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > ph - M - 8) {
      doc.addPage();
      y = M + 4;
      drawRunningHeader();
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(18);
    y += 4;
    doc.setFillColor(...C_PRIMARY);
    doc.roundedRect(M, y, 3, 8, 1, 1, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_DARK);
    doc.text(title, M + 7, y + 6);
    y += 14;
  };

  const getLastY = (): number => (doc as any).lastAutoTable?.finalY ?? y;

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  doc.setFillColor(...C_PRIMARY);
  doc.rect(0, 0, pw, 48, 'F');

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C_WHITE);
  doc.text('Rapport d\'analyse', M, 22);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(dataset.original_name, M, 34);

  doc.setFontSize(9);
  doc.setTextColor(...C_LIGHT_BG);
  const now = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text('Généré le ' + now, M, 43);

  y = 62;

  // quick summary badges
  const badges: [string, string][] = [
    ['Lignes', totalRows.toLocaleString()],
    ['Colonnes', String(totalCols)],
    ['Complétude', `${completeness}%`],
    ['Cible', targetColumn ?? '—'],
  ];

  let bx = M;
  for (const [label, value] of badges) {
    doc.setFillColor(...C_LIGHT_BG);
    doc.roundedRect(bx, y, 36, 18, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...C_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(label, bx + 18, y + 6, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_DARK);
    doc.text(value, bx + 18, y + 14, { align: 'center' });
    bx += 40;
  }
  y += 28;

  doc.setDrawColor(220, 228, 240);
  doc.line(M, y, pw - M, y);
  y += 8;

  // ── SECTION: General info ───────────────────────────────────────────────────
  if (sections.generalInfo) {
    sectionTitle('1. Informations générales');

    autoTable(doc, {
      startY: y,
      head: [],
      body: [
        ['Fichier',        dataset.original_name],
        ['Dimensions',     `${totalRows.toLocaleString()} lignes × ${totalCols} colonnes`],
        ['Taille',         dataset.size_bytes ? `${(dataset.size_bytes / 1024).toFixed(1)} Ko` : '—'],
        ['Format',         dataset.content_type ?? '—'],
        ['Importé le',     new Date(dataset.created_at).toLocaleDateString('fr-FR')],
        ['Variable cible', targetColumn ?? 'Non définie'],
      ] as [string, string][],
      margin: { left: M, right: M },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, fillColor: C_LIGHT_BG, textColor: C_DARK },
        1: { textColor: C_DARK },
      },
      tableWidth: CW,
    });
    y = getLastY() + 10;
  }

  // ── SECTION: Summary ────────────────────────────────────────────────────────
  if (sections.summary) {
    sectionTitle('2. Résumé de la qualité');

    autoTable(doc, {
      startY: y,
      head: [],
      body: [
        ['Colonnes numériques',              String(numericCount)],
        ['Colonnes catégorielles / texte',   String(catCount)],
        ['Autres colonnes',                   String(totalCols - numericCount - catCount)],
        ['Complétude globale',               `${completeness}%`],
        ['Total valeurs nulles',             totalNulls.toLocaleString()],
        ['Colonnes avec valeurs manquantes', `${missingEntries.length} / ${totalCols}`],
        ['Colonnes suspectes d\'outliers',   String(outlierCols.length)],
      ] as [string, string][],
      margin: { left: M, right: M },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 90, fillColor: C_LIGHT_BG, textColor: C_DARK },
        1: { textColor: C_DARK },
      },
      tableWidth: CW,
    });
    y = getLastY() + 10;
  }

  // ── SECTION: Type distribution ──────────────────────────────────────────────
  if (sections.typeDistribution) {
    sectionTitle('3. Distribution des types de colonnes');

    const kindCounts: Record<string, number> = {};
    for (const p of profile.profiles) kindCounts[p.kind] = (kindCounts[p.kind] || 0) + 1;

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Nombre de colonnes', 'Proportion']],
      body: Object.entries(kindCounts).map(([kind, count]) => [
        kindLabel(kind),
        String(count),
        `${((count / totalCols) * 100).toFixed(1)}%`,
      ]),
      margin: { left: M, right: M },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: C_PRIMARY, textColor: C_WHITE, fontStyle: 'bold' },
      tableWidth: CW,
    });
    y = getLastY() + 10;
  }

  // ── SECTION: Missing values ─────────────────────────────────────────────────
  if (sections.missingValues) {
    if (missingEntries.length > 0) {
      sectionTitle('4. Valeurs manquantes par colonne');

      autoTable(doc, {
        startY: y,
        head: [['Colonne', 'Valeurs nulles', '%', 'Qualité']],
        body: missingEntries.map(([col, count]) => {
          const pct = totalRows ? (count / totalRows) * 100 : 0;
          const q = pct === 0 ? 'Complet' : pct < 5 ? 'Bon' : pct < 15 ? 'Attention' : 'Critique';
          return [col, count.toLocaleString(), `${pct.toFixed(1)}%`, q];
        }),
        margin: { left: M, right: M },
        styles: { fontSize: 9.5, cellPadding: 3.5 },
        headStyles: { fillColor: C_PRIMARY, textColor: C_WHITE, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' } },
        tableWidth: CW,
        didParseCell: (hook) => {
          if (hook.column.index === 3 && hook.section === 'body') {
            const v = hook.cell.raw as string;
            if (v === 'Critique')  hook.cell.styles.textColor = C_RED;
            else if (v === 'Attention') hook.cell.styles.textColor = [180, 100, 0];
            else                        hook.cell.styles.textColor = [22, 163, 74];
          }
        },
      });
      y = getLastY() + 10;
    } else {
      sectionTitle('4. Valeurs manquantes');
      ensureSpace(12);
      doc.setFontSize(10);
      doc.setTextColor(22, 163, 74);
      doc.text('✓ Aucune valeur manquante détectée dans ce dataset.', M, y);
      y += 12;
    }
  }

  // ── SECTION: Numeric stats ──────────────────────────────────────────────────
  if (sections.numericStats && numericProfiles.length > 0) {
    sectionTitle('5. Statistiques descriptives — colonnes numériques');

    autoTable(doc, {
      startY: y,
      head: [['Colonne', 'Min', 'P25', 'Médiane', 'Moyenne', 'P75', 'Max', 'Std']],
      body: numericProfiles.map(p => [
        p.name,
        fmt(p.numeric?.min),
        fmt(p.numeric?.p25),
        fmt(p.numeric?.p50),
        fmt(p.numeric?.mean),
        fmt(p.numeric?.p75),
        fmt(p.numeric?.max),
        fmt(p.numeric?.std),
      ]),
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: C_PRIMARY, textColor: C_WHITE, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 } },
      tableWidth: CW,
    });
    y = getLastY() + 10;
  }

  // ── SECTION: Correlations ───────────────────────────────────────────────────
  if (sections.correlations && correlationData) {
    sectionTitle('6. Corrélations (Pearson)');

    const cols   = correlationData.columns;
    const matrix = correlationData.matrix;
    const pairs: { a: string; b: string; corr: number }[] = [];
    for (let i = 0; i < cols.length; i++)
      for (let j = i + 1; j < cols.length; j++) {
        const v = matrix?.[i]?.[j];
        if (Number.isFinite(v)) pairs.push({ a: cols[i], b: cols[j], corr: v });
      }

    const top8pos = [...pairs].sort((a, b) => b.corr - a.corr).slice(0, 8);
    const top8neg = [...pairs].sort((a, b) => a.corr - b.corr).slice(0, 8);

    doc.setFontSize(9);
    doc.setTextColor(...C_MUTED);
    doc.setFont('helvetica', 'italic');
    doc.text(`${cols.length} colonnes numériques analysées.`, M, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_DARK);
    doc.text('Top corrélations positives', M, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Colonne A', 'Colonne B', 'r (Pearson)']],
      body: top8pos.map(p => [p.a, p.b, `+${p.corr.toFixed(4)}`]),
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: C_PRIMARY, textColor: C_WHITE },
      tableWidth: CW,
    });
    y = getLastY() + 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C_DARK);
    doc.text('Top corrélations négatives', M, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Colonne A', 'Colonne B', 'r (Pearson)']],
      body: top8neg.map(p => [p.a, p.b, p.corr.toFixed(4)]),
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: C_RED, textColor: C_WHITE },
      tableWidth: CW,
    });
    y = getLastY() + 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C_MUTED);
    doc.text('Corrélation ≠ causalité. À interpréter avec le contexte métier.', M, y);
    y += 10;
  }

  // ── SECTION: Observations ───────────────────────────────────────────────────
  if (sections.observations) {
    sectionTitle('7. Observations automatiques');

    const targetProfile  = targetColumn ? profile.profiles.find(p => p.name === targetColumn) : null;
    const observations   = [
      `• Le dataset contient ${totalRows.toLocaleString()} lignes et ${totalCols} colonnes.`,
      `• ${numericCount} colonne${numericCount > 1 ? 's numériques' : ' numérique'} et ${catCount} colonne${catCount > 1 ? 's catégorielles/texte' : ' catégorielle/texte'} détectées.`,
      `• Complétude globale : ${completeness}%. ${missingEntries.length === 0 ? 'Aucune valeur manquante.' : `${missingEntries.length} colonne${missingEntries.length > 1 ? 's présentent' : ' présente'} des valeurs manquantes.`}`,
      targetColumn
        ? `• Variable cible définie : "${targetColumn}" (type : ${targetProfile ? kindLabel(targetProfile.kind) : '—'}).`
        : '• Aucune variable cible définie. Pensez à la configurer avant l\'entraînement.',
      outlierCols.length > 0
        ? `• ${outlierCols.length} colonne${outlierCols.length > 1 ? 's suspectes' : ' suspecte'} d'outliers (IQR×3) : ${outlierCols.slice(0, 5).map(c => c.name).join(', ')}${outlierCols.length > 5 ? `… (+${outlierCols.length - 5})` : ''}.`
        : '• Aucun outlier flagrant détecté (règle IQR×3).',
      completeness < 85
        ? '• ⚠ Qualité insuffisante : plus de 15% de valeurs manquantes. Un prétraitement par imputation est fortement recommandé.'
        : completeness < 95
        ? '• ⚠ Quelques valeurs manquantes. Un traitement par imputation peut améliorer les résultats des modèles.'
        : '• ✓ Bonne qualité des données. La complétude est satisfaisante pour l\'entraînement.',
    ];

    doc.setFont('helvetica', 'normal');
    for (const obs of observations) {
      const lines = doc.splitTextToSize(obs, CW);
      ensureSpace(lines.length * 5.5 + 3);
      doc.setFontSize(10);
      doc.setTextColor(...C_DARK);
      doc.text(lines, M, y);
      y += lines.length * 5.5 + 3;
    }
  }

  // ── PAGE NUMBERS ────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} / ${pageCount}`, pw - M, ph - 8, { align: 'right' });
    doc.text('MedicalVision AI Workspace', M, ph - 8);
    if (i > 1) drawRunningHeader();
  }

  // ── DOWNLOAD ────────────────────────────────────────────────────────────────
  const safeName = dataset.original_name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 40);
  doc.save(`rapport_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
