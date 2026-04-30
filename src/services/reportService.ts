/**
 * reportService.ts
 * Pure function — receives already-loaded data, generates and downloads a PDF.
 * No UI, no React, no side effects other than the download.
 *
 * SCALE NOTE:
 *   Backend sends `missing_pct` and `unique_pct` as 0–100 (percentage), not 0–1.
 *   All threshold comparisons use the 0–100 scale accordingly.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DatasetOut, DatasetOverviewOut, DatasetProfileOut, CorrelationOut } from './databaseService';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ReportSections = {
  executiveSummary: boolean;
  generalInfo: boolean;
  dataQuality: boolean;
  columnAnalysis: boolean;
  missingValues: boolean;
  numericStats: boolean;
  targetAnalysis: boolean;
  correlations: boolean;
  recommendations: boolean;
  conclusion: boolean;
};

export const DEFAULT_SECTIONS: ReportSections = {
  executiveSummary: true,
  generalInfo: true,
  dataQuality: true,
  columnAnalysis: true,
  missingValues: true,
  numericStats: true,
  targetAnalysis: true,
  correlations: false,
  recommendations: true,
  conclusion: true,
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
// Colours & formatting helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — neutral professional palette
// ─────────────────────────────────────────────────────────────────────────────

type RGB = [number, number, number];

// Text
const C_INK:     RGB = [17,  24,  39];   // body text
const C_DARK:    RGB = [30,  41,  59];   // headings, emphasis
const C_MUTED:   RGB = [100, 116, 139];  // captions, metadata, footnotes

// Structural
const C_RULE:    RGB = [226, 232, 240];  // horizontal rules & table borders
const C_ROW_ALT: RGB = [248, 250, 252];  // alternating table row
const C_TH_BG:   RGB = [241, 245, 249];  // table header background (neutral)
const C_WHITE:   RGB = [255, 255, 255];
const C_ACCENT:  RGB = [37,  99,  235];  // single accent colour (used sparingly)

// Status — text colours only
const C_RED:    RGB = [185, 28,  28];
const C_AMBER:  RGB = [161, 98,  7];
const C_GREEN:  RGB = [21,  128, 61];

// Highlight box colours (used sparingly — only for genuinely important notices)
const ALERT = {
  critical: { bg: [254, 242, 242] as RGB, bar: [185, 28, 28]  as RGB, text: [153, 27, 27]  as RGB },
  warning:  { bg: [255, 251, 235] as RGB, bar: [161, 98,  7]  as RGB, text: [120, 53, 15]  as RGB },
  info:     { bg: [239, 246, 255] as RGB, bar: [37,  99, 235] as RGB, text: [30,  58, 138] as RGB },
  success:  { bg: [240, 253, 244] as RGB, bar: [21,  128, 61] as RGB, text: [20,  83, 45]  as RGB },
};

// ─────────────────────────────────────────────────────────────────────────────
// Analysis helpers
// ─────────────────────────────────────────────────────────────────────────────

type ColumnProfile = DatasetProfileOut['profiles'][number];

/**
 * Columns whose name or extreme unique ratio suggests they are identifiers.
 * unique_pct is on the 0–100 scale (backend convention).
 */
function detectSuspectedIds(profiles: ColumnProfile[]): string[] {
  return profiles
    .filter(p => {
      const nl = p.name.toLowerCase();
      const hasIdName = /\bid\b|_id$|^id_|^uuid|^index$|^idx$|^rowid$/.test(nl);
      const highUnique = p.unique_pct > 90 && p.kind !== 'numeric';
      return hasIdName || highUnique;
    })
    .map(p => p.name);
}

/** Columns with a single distinct value — zero predictive power. */
function detectConstant(profiles: ColumnProfile[]): string[] {
  return profiles.filter(p => p.unique <= 1).map(p => p.name);
}

/**
 * Categorical columns where more than half of values are unique.
 * unique_pct is on the 0–100 scale.
 */
function detectHighCardinality(profiles: ColumnProfile[]): string[] {
  return profiles
    .filter(p => (p.kind === 'categorical' || p.kind === 'text') && p.unique_pct > 50)
    .map(p => p.name);
}

/**
 * Numeric columns whose minimum is 0 but whose first quartile is positive.
 * This pattern often indicates zeros used to code missing values (common in
 * medical datasets: Glucose=0, BMI=0, BloodPressure=0…).
 */
function detectZeroSuspects(profiles: ColumnProfile[]): string[] {
  return profiles
    .filter(p => {
      if (p.kind !== 'numeric' || !p.numeric) return false;
      const { min, p25 } = p.numeric;
      return min != null && p25 != null && min === 0 && p25 > 0;
    })
    .map(p => p.name);
}

// ── ML Readiness ─────────────────────────────────────────────────────────────

type MLReadiness = {
  level: 'ready' | 'ready_with_prep' | 'not_ready';
  blockers: string[];
  warnings: string[];
};

function computeMLReadiness(opts: {
  completeness: number;
  targetColumn: string | null;
  imbalanceRatio: number | null;
  suspectedIds: string[];
  constantCols: string[];
  heavyMissingCols: string[];
  outlierCols: ColumnProfile[];
  zeroSuspects: string[];
  parasiteCols?: string[];
}): MLReadiness {
  const { completeness, targetColumn, imbalanceRatio, suspectedIds, constantCols, heavyMissingCols, outlierCols, zeroSuspects, parasiteCols = [] } = opts;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!targetColumn)         blockers.push('Aucune variable cible définie');
  if (constantCols.length)   blockers.push(`${constantCols.length} colonne(s) constante(s) — aucune information discriminante`);
  if (completeness < 70)     blockers.push(`Complétude critique : ${completeness}%`);

  if (suspectedIds.length)   warnings.push(`${suspectedIds.length} identifiant(s) potentiel(s) à exclure`);
  if (heavyMissingCols.length) warnings.push(`${heavyMissingCols.length} colonne(s) avec > 15% de manquants`);
  if (zeroSuspects.length)   warnings.push(`${zeroSuspects.length} colonne(s) avec zéros suspects (manquants codés ?)`);
  if (imbalanceRatio != null && imbalanceRatio > 3)
    warnings.push(`Déséquilibre de classes : ratio ${imbalanceRatio.toFixed(1)}:1`);
  if (outlierCols.length)    warnings.push(`${outlierCols.length} colonne(s) avec outliers (IQR×3)`);
  if (parasiteCols.length)   warnings.push(`${parasiteCols.length} colonne(s) avec valeurs parasites non-numériques`);
  if (completeness < 95 && completeness >= 70)
    warnings.push(`Complétude imparfaite : ${completeness}%`);

  if (blockers.length) return { level: 'not_ready', blockers, warnings };
  if (warnings.length) return { level: 'ready_with_prep', blockers: [], warnings };
  return { level: 'ready', blockers: [], warnings: [] };
}

// ── Target analysis ───────────────────────────────────────────────────────────

type TargetAnalysis = {
  profile: ColumnProfile;
  taskType: string;
  effectiveUnique: number | undefined;
  classDistribution: Array<{ value: string; count: number }>;
  imbalanceRatio: number | null;
  dominantClass: string | null;
  minorityClass: string | null;
  /**
   * true when class counts for a numeric binary target were *estimated* from
   * the column mean rather than read from exact value_counts.
   */
  inferredFromMean: boolean;
};

/**
 * Determine the ML task type and class distribution for the target column.
 *
 * Key design decisions:
 *  - A numeric column with ≤ 15 distinct values (and unique_pct < 2 %) is treated
 *    as a classification target, not regression.  This handles 0/1 columns like
 *    `Outcome` in the diabetes dataset which pandas marks as int64/float64.
 *  - For binary numeric targets, the class distribution is inferred from the
 *    column mean when no explicit top_values are available.
 */
function analyzeTarget(
  targetColumn: string,
  profiles: ColumnProfile[],
  totalRows: number,
): TargetAnalysis | null {
  const tp = profiles.find(p => p.name === targetColumn);
  if (!tp) return null;

  let taskType: string = '—';
  let effectiveUnique: number | undefined = tp.unique != null ? tp.unique : undefined;
  let classDistribution: Array<{ value: string; count: number }> = [];
  let imbalanceRatio: number | null = null;
  let dominantClass: string | null = null;
  let minorityClass: string | null = null;
  let inferredFromMean = false;

  // Categorical/text: always classification
  if (tp.kind === 'categorical' || tp.kind === 'text') {
    const topValues = tp.categorical?.top_values ?? [];
    const nUnique = tp.unique ?? (tp.categorical?.unique ?? 0);
    effectiveUnique = nUnique;
    taskType = nUnique === 2
      ? 'Classification binaire'
      : `Classification multi-classes (${nUnique} classes)`;
    classDistribution = [...topValues].sort((a, b) => b.count - a.count);

  // Numeric: check if it looks like a discrete label column.
  // Primary signal: unique count + unique_pct (0-100 scale from backend).
  // Fallback when those fields are absent: infer from numeric.min/max/mean.
  } else if (tp.kind === 'numeric') {
    const num = tp.numeric;

    // Resolve effective unique count — may be undefined if backend omits the field
    effectiveUnique =
      tp.unique != null ? tp.unique
      : (num?.min === 0 && num?.max === 1) ? 2           // binary {0,1}
      : (num?.min != null && num?.max != null && Number.isInteger(num.min) && Number.isInteger(num.max) && (num.max - num.min) <= 14)
        ? (num.max - num.min + 1)   // e.g. {0,1,2} → 3
        : undefined;

    const effectiveUniquePct: number =
      tp.unique_pct != null ? tp.unique_pct
      : effectiveUnique != null ? (effectiveUnique / totalRows) * 100
      : 100;

    const looksDiscrete =
      effectiveUnique != null && effectiveUnique <= 15 && effectiveUniquePct < 2;

    if (looksDiscrete && effectiveUnique != null) {
      if (effectiveUnique === 2) {
        taskType = 'Classification binaire (valeurs numériques 0/1)';
        // Backend does not compute top_values for numeric columns.
        // Infer class counts from mean: for a {0,1} column, mean = proportion of 1.
        const topValues = tp.categorical?.top_values ?? [];
        if (topValues.length >= 2) {
          classDistribution = [...topValues].sort((a, b) => b.count - a.count);
        } else if (num?.mean != null) {
          const pOne = Math.max(0, Math.min(1, num.mean));
          const countOne  = Math.round(pOne * totalRows);
          const countZero = totalRows - countOne;
          if (countOne >= countZero) {
            classDistribution = [{ value: '1', count: countOne }, { value: '0', count: countZero }];
          } else {
            classDistribution = [{ value: '0', count: countZero }, { value: '1', count: countOne }];
          }
          inferredFromMean = true;
        }
      } else {
        taskType = `Classification discrète (${effectiveUnique} valeurs)`;
        const topValues = tp.categorical?.top_values ?? [];
        classDistribution = [...topValues].sort((a, b) => b.count - a.count);
      }
    } else {
      taskType = 'Régression';
    }
  }

  // Compute imbalance metrics from the distribution
  if (classDistribution.length >= 2) {
    const majority = classDistribution[0].count;
    const minority = classDistribution[classDistribution.length - 1].count;
    imbalanceRatio = minority > 0 ? majority / minority : null;
    dominantClass = classDistribution[0].value;
    minorityClass = classDistribution[classDistribution.length - 1].value;
  }

  return { profile: tp, taskType, effectiveUnique, classDistribution, imbalanceRatio, dominantClass, minorityClass, inferredFromMean };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function generateDatasetReport(input: ReportInput): void {
  const { dataset, overview, profile, targetColumn, correlationData, sections } = input;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  const M   = 18;
  const CW  = pw - 2 * M;
  let y     = M;

  // ── Pre-computed aggregates ─────────────────────────────────────────────────
  const totalRows    = overview.shape.rows;
  const totalCols    = overview.shape.cols;
  const totalNulls   = Object.values(overview.missing).reduce((a, b) => a + b, 0);
  const completeness = totalRows * totalCols > 0
    ? Math.round((1 - totalNulls / (totalRows * totalCols)) * 100)
    : 100;

  const numericProfiles = profile.profiles.filter(p => p.kind === 'numeric' && p.numeric);
  const numericCount    = numericProfiles.length;
  const catCount        = profile.profiles.filter(p => p.kind === 'categorical' || p.kind === 'text').length;
  const missingEntries  = Object.entries(overview.missing)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  // IQR×3 outlier detection
  const outlierCols = profile.profiles.filter(p => {
    if (p.kind !== 'numeric' || !p.numeric) return false;
    const { p25, p75, min, max } = p.numeric;
    if (p25 == null || p75 == null || min == null || max == null) return false;
    const iqr = p75 - p25;
    return iqr > 0 && (max - p75 > 3 * iqr || p25 - min > 3 * iqr);
  });

  const suspectedIds        = detectSuspectedIds(profile.profiles);
  const constantCols        = detectConstant(profile.profiles);
  const highCardinalityCols = detectHighCardinality(profile.profiles);
  const zeroSuspects        = detectZeroSuspects(profile.profiles);
  const parasiteCols        = profile.profiles.filter(p => p.parasites && p.parasites.count > 0);
  const heavyMissingCols    = missingEntries
    .filter(([, count]) => (count / totalRows) * 100 >= 15)
    .map(([col]) => col);
  const targetAnalysis      = targetColumn
    ? analyzeTarget(targetColumn, profile.profiles, totalRows)
    : null;
  const mlReadiness         = computeMLReadiness({
    completeness,
    targetColumn,
    imbalanceRatio: targetAnalysis?.imbalanceRatio ?? null,
    suspectedIds,
    constantCols,
    heavyMissingCols,
    outlierCols,
    zeroSuspects,
    parasiteCols: parasiteCols.map(p => p.name),
  });

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const drawRunningHeader = () => {
    // Dark header strip matching cover style
    doc.setFillColor(11, 22, 46);
    doc.rect(0, 0, pw, 11, 'F');
    doc.setFillColor(...C_ACCENT);
    doc.rect(0, 10.5, pw, 0.8, 'F');
    // Logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(37, 99, 235);
    doc.text('MEDIQ', M, 7.5);
    // Center: document label
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Rapport d\'analyse des donnees', pw / 2, 7.5, { align: 'center' });
    // Right: dataset name
    doc.setTextColor(203, 213, 225);
    doc.text(dataset.original_name, pw - M, 7.5, { align: 'right' });
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > ph - M - 8) {
      doc.addPage();
      y = M + 8;
      drawRunningHeader();
    }
  };

  const drawRule = (thickness = 0.3) => {
    doc.setDrawColor(...C_RULE);
    doc.setLineWidth(thickness);
    doc.line(M, y, pw - M, y);
    y += 4;
  };

  // Section title: full-width band with left accent bar + number + title
  const sectionTitle = (num: string, title: string) => {
    ensureSpace(22);
    y += 8;
    // Background band
    doc.setFillColor(239, 246, 255);
    doc.rect(M, y, CW, 11, 'F');
    // Left accent bar
    doc.setFillColor(...C_ACCENT);
    doc.rect(M, y, 3.5, 11, 'F');
    // Section number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_ACCENT);
    doc.text(num, M + 9, y + 7.5);
    // Title text
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_DARK);
    doc.text(title.toUpperCase(), M + 21, y + 7.5);
    y += 16;
  };

  // Sub-heading inside a section
  const subHeading = (text: string) => {
    ensureSpace(10);
    y += 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_DARK);
    doc.text(text, M, y);
    y += 6;
  };

  // Body paragraph
  const para = (text: string, maxWidth = CW) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    const h = lines.length * 5;
    ensureSpace(h + 3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_INK);
    doc.text(lines, M, y);
    y += h + 4;
  };

  // Small muted caption / note
  const note = (text: string, maxWidth = CW) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    const h = lines.length * 4.5;
    ensureSpace(h + 2);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C_MUTED);
    doc.text(lines, M, y);
    y += h + 3;
  };

  // Highlight box — use sparingly for genuinely important notices
  const highlight = (
    text: string,
    kind: 'critical' | 'warning' | 'info' | 'success',
    maxWidth = CW,
  ) => {
    const c = ALERT[kind];
    const icon = kind === 'success' ? 'v' : '!';
    const lines = doc.splitTextToSize(text, maxWidth - 22);
    const h = Math.max(14, lines.length * 5 + 12);
    ensureSpace(h + 4);
    // Background
    doc.setFillColor(...c.bg);
    doc.roundedRect(M, y, maxWidth, h, 2, 2, 'F');
    // Left accent bar (rounded left edge + straight right)
    doc.setFillColor(...c.bar);
    doc.roundedRect(M, y, 4, h, 2, 2, 'F');
    doc.rect(M + 1.5, y, 2.5, h, 'F');
    // Icon circle
    doc.setFillColor(...c.bar);
    doc.circle(M + 12, y + h / 2, 3.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(icon, M + 12, y + h / 2 + 2.5, { align: 'center' });
    // Message text
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c.text);
    doc.text(lines, M + 20, y + 7.5);
    y += h + 5;
  };

  const getLastY = (): number =>
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;

  // ── COVER PAGE ──────────────────────────────────────────────────────────────

  const now = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  // Main header band — dark navy
  const BAND_H = 96;
  doc.setFillColor(11, 22, 46);
  doc.rect(0, 0, pw, BAND_H, 'F');
  // Inner lighter stripe for visual depth
  doc.setFillColor(15, 33, 68);
  doc.rect(0, 52, pw, BAND_H - 52, 'F');
  // Bottom accent line
  doc.setFillColor(...C_ACCENT);
  doc.rect(0, BAND_H - 3, pw, 3, 'F');

  // Logo & branding — top left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.text('MEDIQ', M, 13);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(M, 14.8, M + 36, 14.8);
  doc.setLineWidth(0.1);

  // Generation date — top right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Généré le ${now}`, pw - M, 13, { align: 'right' });

  // Document type label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(147, 197, 253);
  doc.text('RAPPORT D\'ANALYSE', M, 27);

  // Dataset title — large bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(dataset.original_name, pw - 2 * M - 20);
  doc.text(titleLines[0], M, 39);
  if (titleLines.length > 1) {
    doc.setFontSize(14);
    doc.text(titleLines[1], M, 48);
  }

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Analyse de qualite  \u00b7  Preparation ML  \u00b7  Recommandations', M, 51);

  // ── KPI boxes row ───────────────────────────────────────────────────────────
  const KPI_TOP = 57;
  const KPI_H   = 24;
  const KPI_GAP = 3;
  const KPI_W   = (CW - KPI_GAP * 3) / 4;
  const mlBadgeLabel = mlReadiness.level === 'ready' ? 'Pret' : mlReadiness.level === 'ready_with_prep' ? 'A prep.' : 'Bloque';
  const mlBadgeColor: RGB = mlReadiness.level === 'ready'
    ? [74, 222, 128]
    : mlReadiness.level === 'ready_with_prep' ? [251, 191, 36] : [248, 113, 113];
  const completenessColor: RGB = completeness >= 95
    ? [74, 222, 128] : completeness >= 80 ? [251, 191, 36] : [248, 113, 113];
  const kpiData: Array<{ label: string; value: string; color: RGB }> = [
    { label: 'Observations',  value: totalRows.toLocaleString(), color: [255, 255, 255] },
    { label: 'Variables',     value: String(totalCols),           color: [255, 255, 255] },
    { label: 'Completude',    value: `${completeness}%`,           color: completenessColor },
    { label: 'Statut ML',     value: mlBadgeLabel,                 color: mlBadgeColor },
  ];
  for (let i = 0; i < kpiData.length; i++) {
    const kx = M + i * (KPI_W + KPI_GAP);
    doc.setFillColor(22, 42, 84);
    doc.roundedRect(kx, KPI_TOP, KPI_W, KPI_H, 2, 2, 'F');
    const vc = kpiData[i].color;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(vc[0], vc[1], vc[2]);
    doc.text(kpiData[i].value, kx + KPI_W / 2, KPI_TOP + 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(kpiData[i].label.toUpperCase(), kx + KPI_W / 2, KPI_TOP + 20.5, { align: 'center' });
  }

  y = BAND_H + 10;

  // ── SECTION 01: Résumé exécutif ─────────────────────────────────────────────
  if (sections.executiveSummary) {
    sectionTitle('01', 'Résumé exécutif');

    const sentences: string[] = [];

    sentences.push(
      `Ce dataset contient ${totalRows.toLocaleString()} observations et ${totalCols} variables ` +
      `(${numericCount} numérique${numericCount > 1 ? 's' : ''}, ` +
      `${catCount} catégorielle${catCount > 1 ? 's' : ''}).`,
    );

    if (completeness >= 98 && zeroSuspects.length === 0) {
      sentences.push(`Les données sont techniquement propres : complétude de ${completeness}%, aucune valeur manquante ni zéro suspect détecté.`);
    } else if (completeness >= 98 && zeroSuspects.length > 0) {
      sentences.push(
        `La complétude est de ${completeness}% (aucun NaN), mais ${zeroSuspects.length} colonne${zeroSuspects.length > 1 ? 's contiennent' : ' contient'} ` +
        `des zéros potentiellement invalides d'un point de vue métier ` +
        `(${zeroSuspects.slice(0, 3).join(', ')}${zeroSuspects.length > 3 ? '…' : ''}).`,
      );
    } else if (completeness >= 85) {
      sentences.push(
        `La complétude globale est de ${completeness}% — ` +
        `${missingEntries.length} colonne${missingEntries.length > 1 ? 's présentent' : ' présente'} des valeurs manquantes qui nécessitent un traitement.`,
      );
    } else {
      sentences.push(
        `La qualité des données est préoccupante : complétude de ${completeness}% seulement, ` +
        `${missingEntries.length} colonnes présentent des lacunes significatives.`,
      );
    }

    if (targetColumn && targetAnalysis) {
      if (targetAnalysis.imbalanceRatio != null && targetAnalysis.imbalanceRatio > 3) {
        sentences.push(
          `La variable cible « ${targetColumn} » correspond à une tâche de ${targetAnalysis.taskType} ` +
          `avec un déséquilibre notable (ratio ${targetAnalysis.imbalanceRatio.toFixed(1)}:1) — un rééquilibrage est recommandé.`,
        );
      } else {
        sentences.push(
          `La variable cible « ${targetColumn} » correspond à une tâche de ${targetAnalysis.taskType}.`,
        );
      }
    } else if (!targetColumn) {
      sentences.push(`Aucune variable cible n'est définie — à configurer dans la page Database avant l'entraînement.`);
    }

    const issues: string[] = [];
    if (suspectedIds.length > 0)     issues.push(`${suspectedIds.length} identifiant(s) potentiel(s)`);
    if (constantCols.length > 0)     issues.push(`${constantCols.length} colonne(s) constante(s)`);
    if (outlierCols.length > 0)      issues.push(`${outlierCols.length} colonne(s) avec outliers`);
    if (zeroSuspects.length > 0)     issues.push(`${zeroSuspects.length} colonne(s) avec zéros suspects`);
    if (issues.length > 0) sentences.push(`Points d'attention : ${issues.join(', ')}.`);

    const verdictText: Record<MLReadiness['level'], string> = {
      ready:           'Le dataset est prêt pour l\'entraînement.',
      ready_with_prep: 'Le dataset n\'est pas encore prêt sans étape de préparation préalable.',
      not_ready:       'Le dataset nécessite un nettoyage significatif avant tout entraînement fiable.',
    };
    sentences.push(verdictText[mlReadiness.level]);

    para(sentences.join(' '));

    if (mlReadiness.level === 'not_ready') {
      highlight(
        `Bloquants : ${mlReadiness.blockers.join(' — ')}`,
        'critical',
      );
    } else if (mlReadiness.level === 'ready_with_prep' && mlReadiness.warnings.length > 0) {
      highlight(
        `Points à traiter avant entraînement : ${mlReadiness.warnings.slice(0, 3).join(' — ')}${mlReadiness.warnings.length > 3 ? '…' : ''}`,
        'warning',
      );
    }
  }

  // ── SECTION 02: Informations générales ──────────────────────────────────────
  if (sections.generalInfo) {
    sectionTitle('02', 'Informations générales');

    const mlLevelLabel: Record<MLReadiness['level'], string> = {
      ready:           'Prêt',
      ready_with_prep: 'Prêt avec prétraitements',
      not_ready:       'Non prêt sans nettoyage',
    };

    autoTable(doc, {
      startY: y,
      head: [],
      body: [
        ['Fichier',             dataset.original_name],
        ['Dimensions',          `${totalRows.toLocaleString()} lignes × ${totalCols} colonnes`],
        ['Taille',              dataset.size_bytes ? `${(dataset.size_bytes / 1024).toFixed(1)} Ko` : '—'],
        ['Format',              dataset.content_type ?? '—'],
        ['Importé le',          new Date(dataset.created_at).toLocaleDateString('fr-FR')],
        ['Variable cible',      targetColumn ?? 'Non définie'],
        ['Tâche détectée',      targetAnalysis?.taskType ?? '—'],
        ['Complétude globale',  `${completeness}%`],
        ['Zéros suspects',      zeroSuspects.length > 0 ? `${zeroSuspects.length} colonne(s)` : 'Aucun'],
        ['Préparation ML',      mlLevelLabel[mlReadiness.level]],
      ] as [string, string][],
      margin: { left: M, right: M },
      styles: { fontSize: 9.5, cellPadding: 3.5, textColor: C_INK },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 52, fillColor: C_TH_BG, textColor: C_DARK },
        1: { textColor: C_INK },
      },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
    });
    y = getLastY() + 10;
  }

  // ── SECTION 03: Qualité des données ─────────────────────────────────────────
  if (sections.dataQuality) {
    sectionTitle('03', 'Qualité des données');

    autoTable(doc, {
      startY: y,
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
        [
          'Autres colonnes',
          String(totalCols - numericCount - catCount),
          'Datetime, texte libre, type inconnu',
        ],
        [
          'Complétude globale',
          `${completeness}%`,
          completeness >= 95 ? 'Excellente'
          : completeness >= 85 ? 'Satisfaisante'
          : completeness >= 70 ? 'Attention requise'
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
          'Colonnes suspectes d\'outliers',
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
            : `${parasiteCols.slice(0, 3).map(p => p.name).join(', ')}${parasiteCols.length > 3 ? '…' : ''} — remplacer par NaN`,
        ],
      ] as [string, string, string][],
      margin: { left: M, right: M },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: C_INK },
      headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 68, textColor: C_DARK },
        1: { cellWidth: 22 },
        2: { textColor: C_MUTED },
      },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
      didParseCell: (hook) => {
        if (hook.column.index === 1 && hook.section === 'body') {
          if (hook.row.index === 3) {
            hook.cell.styles.textColor = completeness >= 95 ? C_GREEN : completeness >= 85 ? C_AMBER : C_RED;
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
    y = getLastY() + 6;

    if (parasiteCols.length > 0) {
      subHeading('Qualité des données — Valeurs suspectes détectées');
      highlight(
        `${parasiteCols.length} colonne${parasiteCols.length > 1 ? 's contiennent' : ' contient'} des valeurs non-numériques qui devraient être remplacées par NaN avant l'entraînement.`,
        'warning',
      );
      autoTable(doc, {
        startY: y,
        head: [['Colonne', 'Occurrences', 'Valeurs suspectes', '% numérique']],
        body: parasiteCols.map(p => [
          p.name,
          String(p.parasites!.count),
          p.parasites!.distinct.slice(0, 5).map(v => `"${v}"`).join(', '),
          `${(p.parasites!.convertible_ratio * 100).toFixed(0)}%`,
        ]) as [string, string, string, string][],
        margin: { left: M, right: M },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: C_INK },
        headStyles: { fillColor: [255, 237, 213], textColor: [154, 52, 18], fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 25, halign: 'center' },
          2: { textColor: C_AMBER },
          3: { cellWidth: 25, halign: 'center' },
        },
        alternateRowStyles: { fillColor: C_ROW_ALT },
        tableWidth: CW,
      });
      y = getLastY() + 10;
    } else {
      y += 4;
    }
  }

  // ── SECTION 04: Analyse des colonnes ────────────────────────────────────────
  if (sections.columnAnalysis) {
    sectionTitle('04', 'Analyse des colonnes');

    type ColGroup = {
      label: string;
      kind: 'critical' | 'warning' | 'info' | 'success';
      cols: string[];
      message: string;
    };

    const groups: ColGroup[] = [];

    if (suspectedIds.length > 0) {
      groups.push({
        label: 'Identifiants potentiels',
        kind: 'critical',
        cols: suspectedIds,
        message:
          'Cardinalité très élevée ou nom caractéristique d\'identifiant. Ces colonnes ne contribuent pas à la prédiction et introduisent du sur-apprentissage.',
      });
    }
    if (constantCols.length > 0) {
      groups.push({
        label: 'Colonnes constantes — variance nulle',
        kind: 'critical',
        cols: constantCols,
        message: 'Une seule valeur distincte : aucune information discriminante. À supprimer avant tout entraînement.',
      });
    }
    if (heavyMissingCols.length > 0) {
      groups.push({
        label: 'Valeurs manquantes critiques (> 15%)',
        kind: 'warning',
        cols: heavyMissingCols,
        message: 'Plus de 15% de valeurs manquantes. Imputation avancée (KNN, MICE) recommandée, ou suppression si le taux dépasse 40%.',
      });
    }
    if (zeroSuspects.length > 0) {
      groups.push({
        label: 'Zéros suspects — manquants potentiellement codés',
        kind: 'warning',
        cols: zeroSuspects,
        message:
          'Minimum de 0 alors que les valeurs typiques (P25) sont strictement positives. ' +
          'Dans un contexte médical, cela indique souvent des valeurs manquantes codées en 0 ' +
          '(Glucose=0, BMI=0, BloodPressure=0…). Action : requalifier en NaN puis imputer.',
      });
    }
    if (highCardinalityCols.length > 0) {
      groups.push({
        label: 'Haute cardinalité — catégorielles > 50% valeurs uniques',
        kind: 'warning',
        cols: highCardinalityCols,
        message: 'Trop de valeurs distinctes pour un encodage one-hot standard. Privilégiez le target encoding ou le regroupement par fréquence.',
      });
    }

    const problematicSet = new Set([
      ...suspectedIds, ...constantCols, ...heavyMissingCols, ...zeroSuspects, ...highCardinalityCols,
    ]);
    const cleanCols = profile.profiles
      .filter(p => !problematicSet.has(p.name))
      .map(p => p.name);

    if (cleanCols.length > 0) {
      groups.push({
        label: 'Colonnes exploitables',
        kind: 'success',
        cols: cleanCols,
        message: 'Ces colonnes ne présentent pas de problème structurel détecté — elles sont prêtes à être utilisées.',
      });
    }

    for (const group of groups) {
      ensureSpace(14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C_DARK);
      doc.text(`${group.label}  (${group.cols.length})`, M, y);
      y += 5;

      const descLines = doc.splitTextToSize(group.message, CW);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...C_MUTED);
      doc.text(descLines, M, y);
      y += descLines.length * 4.5 + 3;

      // Column names as inline dot-separated text
      const colText = group.cols.join('  ·  ');
      const colLines = doc.splitTextToSize(colText, CW);
      ensureSpace(colLines.length * 4.5 + 4);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const textColor: RGB =
        group.kind === 'critical' ? C_RED
        : group.kind === 'warning' ? C_AMBER
        : group.kind === 'success' ? C_GREEN
        : C_ACCENT;
      doc.setTextColor(...textColor);
      doc.text(colLines, M + 2, y);
      y += colLines.length * 4.5 + 7;
    }
  }

  // ── SECTION 05: Valeurs manquantes ───────────────────────────────────────────
  if (sections.missingValues) {
    if (missingEntries.length > 0) {
      sectionTitle('05', 'Valeurs manquantes par colonne');

      autoTable(doc, {
        startY: y,
        head: [['Colonne', 'Type', 'Valeurs nulles', '%', 'Niveau', 'Action suggérée']],
        body: missingEntries.map(([col, count]) => {
          const pct = totalRows ? (count / totalRows) * 100 : 0;
          const colProfile = profile.profiles.find(p => p.name === col);
          const colKind = colProfile ? kindLabel(colProfile.kind) : '—';
          let level: string;
          let action: string;
          if (pct >= 40)      { level = 'Critique'; action = 'Supprimer la colonne'; }
          else if (pct >= 15) { level = 'Élevé';    action = 'Imputation KNN / MICE'; }
          else if (pct >= 5)  { level = 'Modéré';   action = 'Imputation médiane / mode'; }
          else                 { level = 'Faible';   action = 'Imputation simple'; }
          return [col, colKind, count.toLocaleString(), `${pct.toFixed(1)}%`, level, action];
        }),
        margin: { left: M, right: M },
        styles: { fontSize: 8.5, cellPadding: 3, textColor: C_INK },
        headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: C_ROW_ALT },
        tableWidth: CW,
        didParseCell: (hook) => {
          if (hook.column.index === 4 && hook.section === 'body') {
            const v = hook.cell.raw as string;
            if      (v === 'Critique') hook.cell.styles.textColor = C_RED;
            else if (v === 'Élevé')    hook.cell.styles.textColor = [180, 100, 0] as RGB;
            else if (v === 'Modéré')   hook.cell.styles.textColor = C_AMBER;
            else                        hook.cell.styles.textColor = C_GREEN;
          }
        },
      });
      y = getLastY() + 6;

      const critCount = missingEntries.filter(([, c]) => (c / totalRows) * 100 >= 40).length;
      const highCount = missingEntries.filter(([, c]) => {
        const p = (c / totalRows) * 100;
        return p >= 15 && p < 40;
      }).length;

      if (critCount > 0) {
        highlight(
          `${critCount} colonne${critCount > 1 ? 's ont' : ' a'} plus de 40% de valeurs manquantes — ` +
          `leur suppression est recommandée (l'imputation introduirait un biais majeur).`,
          'critical',
        );
      } else if (highCount > 0) {
        highlight(
          `${highCount} colonne${highCount > 1 ? 's ont' : ' a'} entre 15% et 40% de valeurs manquantes — ` +
          `une imputation avancée (KNN, MICE) est recommandée avant l'entraînement.`,
          'warning',
        );
      }
    } else {
      sectionTitle('05', 'Valeurs manquantes');
      if (zeroSuspects.length > 0) {
        para(
          `Aucune valeur manquante (NaN) n'a été détectée. Cependant, ${zeroSuspects.length} colonne${zeroSuspects.length > 1 ? 's contiennent' : ' contient'} des zéros suspects ` +
          `qui peuvent masquer des valeurs manquantes d'un point de vue métier (${zeroSuspects.slice(0, 3).join(', ')}${zeroSuspects.length > 3 ? '…' : ''}).`,
        );
      } else {
        para('Aucune valeur manquante (NaN) détectée dans ce dataset. La qualité des données est optimale sur cet aspect.');
      }
    }
  }

  // ── SECTION 06: Statistiques descriptives ───────────────────────────────────
  if (sections.numericStats && numericProfiles.length > 0) {
    sectionTitle('06', 'Statistiques descriptives — colonnes numériques');

    const outlierColNames = new Set(outlierCols.map(c => c.name));
    const zeroSuspectSet  = new Set(zeroSuspects);

    autoTable(doc, {
      startY: y,
      head: [['Colonne', 'Min', 'P25', 'Médiane', 'Moyenne', 'P75', 'Max', 'Std', 'Notes']],
      body: numericProfiles.map(p => {
        const flags: string[] = [];
        if (outlierColNames.has(p.name))  flags.push('Outliers');
        if (zeroSuspectSet.has(p.name))   flags.push('Zéros ?');
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
      margin: { left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: C_INK },
      headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        8: { cellWidth: 22 },
      },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
      didParseCell: (hook) => {
        if (hook.column.index === 8 && hook.section === 'body') {
          const v = hook.cell.raw as string;
          hook.cell.styles.textColor = v !== '—' ? C_AMBER : C_MUTED;
          if (v !== '—') hook.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = getLastY() + 6;

    if (outlierCols.length > 0) {
      para(
        `${outlierCols.length} colonne${outlierCols.length > 1 ? 's présentent' : ' présente'} des valeurs extrêmes (IQR×3) : ` +
        `${outlierCols.slice(0, 4).map(c => c.name).join(', ')}${outlierCols.length > 4 ? `… (+${outlierCols.length - 4})` : ''}. ` +
        `L'impact varie selon le modèle — fort pour la régression linéaire, SVM et KNN ; limité pour les arbres de décision et forêts aléatoires. ` +
        `Vérifiez s'il s'agit d'erreurs de saisie avant de capper ou de supprimer ces valeurs.`,
      );
    }
    if (zeroSuspects.length > 0) {
      highlight(
        `${zeroSuspects.length} colonne${zeroSuspects.length > 1 ? 's ont' : ' a'} un minimum de 0 avec une médiane strictement positive : ` +
        `${zeroSuspects.slice(0, 4).join(', ')}${zeroSuspects.length > 4 ? '…' : ''}. ` +
        `Ces zéros peuvent être des valeurs manquantes mal codées. Requalifiez-les en NaN avant imputation.`,
        'warning',
      );
    }
    if (outlierCols.length === 0 && zeroSuspects.length === 0) {
      note('Aucun outlier flagrant (IQR×3) ni zéro suspect détecté. Les distributions numériques semblent cohérentes.');
    }
  }

  // ── SECTION 07: Analyse de la variable cible ─────────────────────────────────
  if (sections.targetAnalysis) {
    sectionTitle('07', 'Analyse de la variable cible');

    if (!targetColumn) {
      highlight(
        'Aucune variable cible définie. Configurez-la dans la page Database avant de lancer l\'entraînement.',
        'warning',
      );
    } else if (!targetAnalysis) {
      highlight(
        `La variable cible « ${targetColumn} » n'a pas pu être analysée (profil introuvable dans le dataset).`,
        'warning',
      );
    } else {
      const { profile: tp, taskType, effectiveUnique, classDistribution, imbalanceRatio,
              dominantClass, minorityClass, inferredFromMean } = targetAnalysis;

      const nUnique = effectiveUnique ?? tp.unique;

      autoTable(doc, {
        startY: y,
        head: [],
        body: [
          ['Variable cible',      targetColumn],
          ['Type de tâche',       taskType],
          ['Type de colonne',     kindLabel(tp.kind)],
          ['Valeurs uniques',     nUnique != null ? String(nUnique) : '—'],
          ['Valeurs manquantes',  tp.missing > 0
            ? `${tp.missing.toLocaleString()} (${tp.missing_pct.toFixed(1)}%)`
            : 'Aucune'],
        ] as [string, string][],
        margin: { left: M, right: M },
        styles: { fontSize: 9.5, cellPadding: 3.5, textColor: C_INK },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55, fillColor: C_TH_BG, textColor: C_DARK },
          1: { textColor: C_INK },
        },
        alternateRowStyles: { fillColor: C_ROW_ALT },
        tableWidth: CW,
      });
      y = getLastY() + 6;

      if (classDistribution.length > 0) {
        subHeading('Distribution des classes');

        if (inferredFromMean) {
          note(
            `Effectifs estimés à partir de la moyenne de la colonne (${(tp.numeric!.mean! * 100).toFixed(1)}% de valeurs positives). ` +
            `Les proportions sont approximatives.`,
          );
        }

        const totalLabeled = classDistribution.reduce((s, c) => s + c.count, 0);
        const maxCount = Math.max(...classDistribution.map((c) => c.count));
        const minCount = Math.min(...classDistribution.map((c) => c.count));
        const isBinary = classDistribution.length === 2;
        autoTable(doc, {
          startY: y,
          head: [['Classe', 'Effectif', 'Proportion', 'Représentation']],
          body: classDistribution.slice(0, 20).map(({ value, count }) => {
            const pct = totalLabeled > 0 ? (count / totalLabeled) * 100 : 0;
            let level: string;
            if (isBinary) {
              level = count === maxCount ? 'Majoritaire' : 'Minoritaire';
            } else if (count === maxCount) {
              level = 'Majoritaire';
            } else if (count === minCount && pct < 10) {
              level = 'Très minoritaire';
            } else if (pct >= 20) {
              level = 'Représentée';
            } else if (pct >= 10) {
              level = 'Minoritaire';
            } else {
              level = 'Très minoritaire';
            }
            return [value, count.toLocaleString(), `${pct.toFixed(1)}%`, level];
          }),
          margin: { left: M, right: M },
          styles: { fontSize: 9, cellPadding: 3.5, textColor: C_INK },
          headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
          columnStyles: { 0: { fontStyle: 'bold' } },
          alternateRowStyles: { fillColor: C_ROW_ALT },
          tableWidth: CW,
          didParseCell: (hook) => {
            if (hook.column.index === 3 && hook.section === 'body') {
              const v = hook.cell.raw as string;
              if      (v === 'Majoritaire')      hook.cell.styles.textColor = C_ACCENT;
              else if (v === 'Très minoritaire') hook.cell.styles.textColor = C_RED;
              else if (v === 'Minoritaire')      hook.cell.styles.textColor = C_AMBER;
              else                                hook.cell.styles.textColor = C_GREEN;
            }
          },
        });
        y = getLastY() + 6;

        if (imbalanceRatio != null) {
          if (imbalanceRatio > 10) {
            highlight(
              `Déséquilibre sévère : ratio ${imbalanceRatio.toFixed(1)}:1 ` +
              `(classe dominante « ${dominantClass} » vs minoritaire « ${minorityClass} »). ` +
              `Actions recommandées : SMOTE, SMOTE+Tomek, class_weight. ` +
              `Métriques adaptées : F1, Recall, PR-AUC, Balanced Accuracy.`,
              'critical',
            );
          } else if (imbalanceRatio > 3) {
            highlight(
              `Déséquilibre modéré : ratio ${imbalanceRatio.toFixed(1)}:1. ` +
              `Envisagez SMOTE ou class_weight pour améliorer la sensibilité sur la classe minoritaire. ` +
              `Privilégiez F1-score ou ROC-AUC à l'accuracy pour l'évaluation.`,
              'warning',
            );
          } else {
            note(`Distribution équilibrée : ratio ${imbalanceRatio.toFixed(1)}:1. Un split stratifié est recommandé pour préserver les proportions en train/test.`);
          }
        }

      } else if (taskType === 'Régression' && tp.numeric) {
        const skew = tp.numeric.mean != null && tp.numeric.p50 != null
          ? tp.numeric.mean - tp.numeric.p50
          : null;
        const skewNote = skew != null && Math.abs(skew) > 0.05 * (tp.numeric.std ?? 1)
          ? ` La distribution est asymétrique (moyenne ${fmt(tp.numeric.mean)} vs médiane ${fmt(tp.numeric.p50)}).`
          : '';
        para(
          `Variable cible de régression — ` +
          `min ${fmt(tp.numeric.min)}, médiane ${fmt(tp.numeric.p50)}, ` +
          `max ${fmt(tp.numeric.max)}, écart-type ${fmt(tp.numeric.std)}.` +
          skewNote +
          ` Vérifiez la distribution pour décider d'une éventuelle transformation (log, Box-Cox) avant l'entraînement.`,
        );
      }
    }
  }

  // ── SECTION 08: Corrélations ─────────────────────────────────────────────────
  if (sections.correlations && correlationData) {
    sectionTitle('08', 'Corrélations (Pearson)');

    const { columns: cols, matrix } = correlationData;
    const pairs: { a: string; b: string; corr: number }[] = [];
    for (let i = 0; i < cols.length; i++)
      for (let j = i + 1; j < cols.length; j++) {
        const v = matrix?.[i]?.[j];
        if (Number.isFinite(v)) pairs.push({ a: cols[i], b: cols[j], corr: v });
      }

    const top8pos = [...pairs].sort((a, b) => b.corr - a.corr).slice(0, 8);
    const top8neg = [...pairs].sort((a, b) => a.corr - b.corr).slice(0, 8);

    note(`${cols.length} colonnes numériques analysées.`);
    subHeading('Corrélations positives les plus fortes');

    autoTable(doc, {
      startY: y,
      head: [['Colonne A', 'Colonne B', 'r (Pearson)']],
      body: top8pos.map(p => [p.a, p.b, `+${p.corr.toFixed(4)}`]),
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 3, textColor: C_INK },
      headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
    });
    y = getLastY() + 6;

    subHeading('Corrélations négatives les plus fortes');

    autoTable(doc, {
      startY: y,
      head: [['Colonne A', 'Colonne B', 'r (Pearson)']],
      body: top8neg.map(p => [p.a, p.b, p.corr.toFixed(4)]),
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 3, textColor: C_INK },
      headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
    });
    y = getLastY() + 4;

    note('Corrélation ≠ causalité. À interpréter en tenant compte du contexte métier.');
  }

  // ── SECTION 09: Recommandations prioritaires ─────────────────────────────────
  if (sections.recommendations) {
    sectionTitle('09', 'Recommandations prioritaires');

    type Rec = { priority: 'high' | 'medium' | 'low'; text: string };
    const recs: Rec[] = [];

    if (!targetColumn) {
      recs.push({
        priority: 'high',
        text: 'Définir la variable cible dans la page Database avant de lancer l\'entraînement.',
      });
    }
    if (constantCols.length > 0) {
      recs.push({
        priority: 'high',
        text: `Supprimer les colonnes à variance nulle : ${constantCols.slice(0, 4).join(', ')}${constantCols.length > 4 ? '…' : ''}.`,
      });
    }
    if (suspectedIds.length > 0) {
      recs.push({
        priority: 'high',
        text: `Exclure les colonnes identifiants du training pour éviter le sur-apprentissage : ${suspectedIds.slice(0, 4).join(', ')}${suspectedIds.length > 4 ? `… (+${suspectedIds.length - 4})` : ''}.`,
      });
    }

    const critMissing = missingEntries.filter(([, c]) => (c / totalRows) * 100 >= 40);
    if (critMissing.length > 0) {
      recs.push({
        priority: 'high',
        text: `Supprimer ${critMissing.length} colonne${critMissing.length > 1 ? 's' : ''} avec > 40% de manquants ` +
          `(${critMissing.slice(0, 3).map(([n]) => n).join(', ')}${critMissing.length > 3 ? '…' : ''}).`,
      });
    }
    if (zeroSuspects.length > 0) {
      recs.push({
        priority: 'high',
        text: `Requalifier les zéros comme valeurs manquantes dans : ${zeroSuspects.slice(0, 4).join(', ')}${zeroSuspects.length > 4 ? '…' : ''}. ` +
          `Un zéro biologiquement impossible (Glucose=0, BMI=0…) est un NaN masqué. Requalifiez avant d'imputer.`,
      });
    }
    if (targetAnalysis?.imbalanceRatio != null && targetAnalysis.imbalanceRatio > 3) {
      recs.push({
        priority: targetAnalysis.imbalanceRatio > 10 ? 'high' : 'medium',
        text: `Appliquer une stratégie de rééquilibrage — ratio ${targetAnalysis.imbalanceRatio.toFixed(1)}:1 sur la variable cible. ` +
          `Options : SMOTE (données synthétiques), class_weight="balanced", random undersampling. ` +
          `Utiliser F1, PR-AUC ou Balanced Accuracy comme métrique principale.`,
      });
    }

    const modMissing = missingEntries.filter(([, c]) => {
      const p = (c / totalRows) * 100;
      return p >= 5 && p < 40;
    });
    if (modMissing.length > 0) {
      recs.push({
        priority: 'medium',
        text: `Imputer ${modMissing.length} colonne${modMissing.length > 1 ? 's' : ''} avec des valeurs manquantes (5–40%) : ` +
          `médiane pour les colonnes numériques, mode pour les catégorielles, ou KNN si les corrélations sont fortes.`,
      });
    }
    if (outlierCols.length > 0) {
      recs.push({
        priority: 'medium',
        text: `Traiter les outliers dans : ${outlierCols.slice(0, 4).map(c => c.name).join(', ')}${outlierCols.length > 4 ? `… (+${outlierCols.length - 4})` : ''}. ` +
          `Options : winsorisation (capping), transformation log, ou suppression si erreur de saisie avérée.`,
      });
    }
    if (numericCount > 0) {
      recs.push({
        priority: 'low',
        text: 'Standardiser (StandardScaler) ou normaliser (MinMaxScaler) les variables numériques pour les modèles sensibles à l\'échelle (SVM, KNN, régression logistique).',
      });
    }
    if (highCardinalityCols.length > 0) {
      recs.push({
        priority: 'low',
        text: `Encoder les colonnes à haute cardinalité par target encoding ou regroupement : ${highCardinalityCols.slice(0, 3).join(', ')}${highCardinalityCols.length > 3 ? '…' : ''}.`,
      });
    }
    if (targetAnalysis?.taskType.includes('Classification')) {
      recs.push({
        priority: 'low',
        text: 'Utiliser un split stratifié pour préserver les proportions de classes en train/test.',
      });
    }

    if (recs.length === 0) {
      recs.push({
        priority: 'low',
        text: 'Données de bonne qualité — structurellement prêtes pour l\'entraînement. Vérifiez néanmoins la cohérence métier des valeurs avant de lancer.',
      });
    }

    recs.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

    const priorityLabel: Record<string, string> = {
      high:   'Priorité haute',
      medium: 'Priorité moyenne',
      low:    'Priorité basse',
    };
    const priorityColor: Record<string, RGB> = {
      high:   C_RED,
      medium: C_AMBER,
      low:    C_GREEN,
    };

    autoTable(doc, {
      startY: y,
      head: [['#', 'Priorité', 'Recommandation']],
      body: recs.map((r, i) => [String(i + 1), priorityLabel[r.priority], r.text]),
      margin: { left: M, right: M },
      styles: { fontSize: 9, cellPadding: 3.5, textColor: C_INK },
      headStyles: { fillColor: C_TH_BG, textColor: C_DARK, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 40, fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
      didParseCell: (hook) => {
        if (hook.column.index === 1 && hook.section === 'body') {
          const r = recs[hook.row.index];
          if (r) hook.cell.styles.textColor = priorityColor[r.priority];
        }
      },
    });
    y = getLastY() + 10;
  }

  // ── SECTION 10: Conclusion & Verdict ────────────────────────────────────────
  if (sections.conclusion) {
    sectionTitle('10', 'Conclusion & Verdict');

    const sentences: string[] = [];

    if (completeness >= 95 && suspectedIds.length === 0 && constantCols.length === 0 && zeroSuspects.length === 0) {
      sentences.push(
        `Ce dataset présente une qualité structurelle solide : complétude de ${completeness}%, ` +
        `aucun identifiant parasite, aucune colonne constante ni zéro suspect détecté.`,
      );
    } else {
      const issues: string[] = [];
      if (completeness < 95) issues.push(`complétude de ${completeness}%`);
      if (suspectedIds.length > 0) issues.push(`${suspectedIds.length} identifiant(s) potentiel(s)`);
      if (constantCols.length > 0) issues.push(`${constantCols.length} colonne(s) constante(s)`);
      if (zeroSuspects.length > 0) issues.push(`${zeroSuspects.length} colonne(s) avec zéros suspects`);
      sentences.push(
        `Ce dataset requiert un prétraitement ciblé avant l'entraînement, notamment en raison de : ${issues.join(', ')}.`,
      );
    }

    if (targetColumn && targetAnalysis) {
      const imbalNote =
        targetAnalysis.imbalanceRatio != null && targetAnalysis.imbalanceRatio > 3
          ? ` Le déséquilibre de classes (ratio ${targetAnalysis.imbalanceRatio.toFixed(1)}:1) devra être traité.`
          : '';
      sentences.push(
        `La tâche de ${targetAnalysis.taskType} sur « ${targetColumn} » est prête à être configurée.${imbalNote}`,
      );
    }

    sentences.push(
      `Après les prétraitements recommandés, ce dataset sera exploitable pour un entraînement supervisé via la page Entraînement de MedIQ.`,
    );

    para(sentences.join(' '));

    ensureSpace(20);
    subHeading('Verdict ML');

    const verdictRows: [string, string][] = [];
    const verdictLabel: Record<MLReadiness['level'], string> = {
      ready:           '✓  Prêt pour l\'entraînement',
      ready_with_prep: '⚠  Prêt avec prétraitements recommandés',
      not_ready:       '✗  Non prêt sans nettoyage complémentaire',
    };
    verdictRows.push(['Statut global', verdictLabel[mlReadiness.level]]);

    if (mlReadiness.blockers.length > 0) {
      verdictRows.push(['Bloquants', mlReadiness.blockers.join('\n')]);
    }
    if (mlReadiness.warnings.length > 0) {
      verdictRows.push(['Points à traiter', mlReadiness.warnings.join('\n')]);
    }

    const verdictStatusColor: Record<MLReadiness['level'], RGB> = {
      ready:           C_GREEN,
      ready_with_prep: C_AMBER,
      not_ready:       C_RED,
    };

    autoTable(doc, {
      startY: y,
      head: [],
      body: verdictRows,
      margin: { left: M, right: M },
      styles: { fontSize: 9.5, cellPadding: 4, textColor: C_INK },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, fillColor: C_TH_BG, textColor: C_DARK },
        1: { textColor: C_INK },
      },
      alternateRowStyles: { fillColor: C_ROW_ALT },
      tableWidth: CW,
      didParseCell: (hook) => {
        if (hook.column.index === 1 && hook.section === 'body' && hook.row.index === 0) {
          hook.cell.styles.textColor = verdictStatusColor[mlReadiness.level];
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fontSize = 10;
        }
      },
    });
    y = getLastY() + 10;
  }

  // ── PAGE NUMBERS ────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer band — dark, matching header
    doc.setFillColor(11, 22, 46);
    doc.rect(0, ph - 13, pw, 13, 'F');
    // Left: branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(37, 99, 235);
    doc.text('MedIQ', M, ph - 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(' \u2014 Document confidentiel', M + 23, ph - 5.5);
    // Center: date
    doc.setTextColor(100, 116, 139);
    doc.text(now, pw / 2, ph - 5.5, { align: 'center' });
    // Right: page indicator
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`${i} / ${pageCount}`, pw - M, ph - 5.5, { align: 'right' });
    if (i > 1) drawRunningHeader();
  }

  // ── DOWNLOAD ────────────────────────────────────────────────────────────────
  const safeName = dataset.original_name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 40);
  doc.save(`rapport_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
