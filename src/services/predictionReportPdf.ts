/**
 * predictionReportPdf.ts
 *
 * Sprint 5 — client-side PDF export of an LLM-generated prediction report.
 * Pure function: takes the assembled report dict + a few metadata fields and
 * triggers a download. No network, no side effects beyond the file save.
 *
 * Header (per plan §11): project name, date, model used, dataset version.
 * Disclaimer is rendered as a permanent footer banner so the printout stays
 * compliant if separated from the on-screen panel.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { ReportFactor, ReportLang, ReportPrediction } from './predictionReportService';

// ── Public types ──────────────────────────────────────────────────────────────

export interface PdfChartFactor {
  label: string;
  value: string;
  /** "increase" | "decrease" | "neutral" */
  direction: string;
  /** Normalised weight in [0, 1]. */
  weight: number;
}

export interface PredictionReportPdfInput {
  prediction: ReportPrediction | null;
  summary: string;
  keyFactors: ReportFactor[];
  context: string;
  limitations: string;
  nextSteps: string;
  disclaimer: string;
  // Header metadata
  projectName: string;
  modelName: string;
  modelVersion?: string | number;
  generatedAt?: Date;
  lang: ReportLang;
  // Chart data (optional — charts are skipped when absent)
  scorePct?: number | null;
  thresholdPct?: number;
  chartFactors?: PdfChartFactor[];
}

// ── Localized strings for the PDF chrome ──────────────────────────────────────

const STRINGS = {
  fr: {
    title: "Rapport d'analyse prédictive",
    project: 'Projet',
    model: 'Modèle',
    date: 'Date',
    prediction: 'Prédiction',
    confidence: 'Confiance',
    summary: 'Résumé',
    keyFactors: 'Facteurs clés',
    context: 'Contexte',
    limitations: 'Limites du modèle',
    nextSteps: 'À retenir',
    disclaimer: 'Avertissement',
    factorLabel: 'Variable',
    factorValue: 'Valeur',
    factorDirection: 'Effet',
    factorExplanation: 'Explication',
    page: 'Page',
    of: 'sur',
    filenamePrefix: 'rapport_prediction',
    // Chart strings
    scoreTitle: "Score de l'analyse",
    alertLevel: "Niveau d'alerte",
    aboveAlert: "Au-dessus du niveau d'alerte",
    belowAlert: "En dessous du niveau d'alerte",
    factorInfluence: 'Influence des facteurs',
    reassuring: 'Rassurant',
    concerning: 'Préoccupant',
    intro: "Ce rapport vous guide étape par étape pour comprendre l'analyse réalisée.",
    endOfReport: 'Fin du rapport',
  },
  en: {
    title: 'Predictive analysis report',
    project: 'Project',
    model: 'Model',
    date: 'Date',
    prediction: 'Prediction',
    confidence: 'Confidence',
    summary: 'Summary',
    keyFactors: 'Key factors',
    context: 'Context',
    limitations: 'Model limitations',
    nextSteps: 'Next steps',
    disclaimer: 'Disclaimer',
    factorLabel: 'Variable',
    factorValue: 'Value',
    factorDirection: 'Effect',
    factorExplanation: 'Explanation',
    page: 'Page',
    of: 'of',
    filenamePrefix: 'prediction_report',
    // Chart strings
    scoreTitle: 'Analysis score',
    alertLevel: 'Alert level',
    aboveAlert: 'Above the alert level',
    belowAlert: 'Below the alert level',
    factorInfluence: 'Factor influence',
    reassuring: 'Reassuring',
    concerning: 'Concerning',
    intro: 'This report walks you through the analysis step by step.',
    endOfReport: 'End of report',
  },
} as const;

// ── Layout constants ──────────────────────────────────────────────────────────

const MARGIN = 15;
const PAGE_W = 210; // A4 portrait, mm
const CONTENT_W = PAGE_W - MARGIN * 2;
const COLOR_PRIMARY: [number, number, number] = [37, 99, 235];   // blue-600
const COLOR_TEXT: [number, number, number] = [17, 24, 39];        // gray-900
const COLOR_MUTED: [number, number, number] = [107, 114, 128];    // gray-500
const COLOR_WARNING_BG: [number, number, number] = [254, 243, 199]; // amber-100
const COLOR_WARNING_BORDER: [number, number, number] = [217, 119, 6]; // amber-600

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date, lang: ReportLang): string {
  return d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function ensureRoom(doc: jsPDF, cursor: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursor + needed > pageHeight - MARGIN - 12) {
    doc.addPage();
    return MARGIN;
  }
  return cursor;
}

function drawHeader(doc: jsPDF, input: PredictionReportPdfInput, t: typeof STRINGS.fr): number {
  const date = input.generatedAt ?? new Date();

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(t.title, MARGIN, MARGIN + 4);

  // Metadata block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  const meta = [
    `${t.project}: ${input.projectName}`,
    `${t.model}: ${input.modelName}${input.modelVersion ? ` (v${input.modelVersion})` : ''}`,
    `${t.date}: ${formatDate(date, input.lang)}`,
  ];
  meta.forEach((line, i) => doc.text(line, MARGIN, MARGIN + 12 + i * 4));

  // Separator
  doc.setDrawColor(...COLOR_MUTED);
  doc.setLineWidth(0.2);
  const sepY = MARGIN + 12 + meta.length * 4 + 2;
  doc.line(MARGIN, sepY, PAGE_W - MARGIN, sepY);

  // Pedagogical intro line
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(t.intro, MARGIN, sepY + 5);

  return sepY + 11;
}

/**
 * Numbered badge ahead of a section title so the report reads as a
 * step-by-step walkthrough. Returns the x-offset where the title text
 * should start.
 */
function drawStepBadge(doc: jsPDF, step: number, cursor: number): number {
  const badgeR = 3.2;
  const cx = MARGIN + badgeR;
  const cy = cursor - 1.6;
  doc.setFillColor(...COLOR_PRIMARY);
  doc.circle(cx, cy, badgeR, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(step), cx, cy + 1.1, { align: 'center' });
  return MARGIN + badgeR * 2 + 2.5;
}

function drawSectionHeading(
  doc: jsPDF,
  title: string,
  cursor: number,
  step?: number,
): number {
  const x = step !== undefined ? drawStepBadge(doc, step, cursor) : MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(title.toUpperCase(), x, cursor);
  return cursor + 5;
}

function drawSection(
  doc: jsPDF,
  title: string,
  body: string,
  cursor: number,
  step?: number,
): number {
  if (!body) return cursor;

  cursor = ensureRoom(doc, cursor, 18);
  cursor = drawSectionHeading(doc, title, cursor, step);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT);
  const lines = doc.splitTextToSize(body, CONTENT_W);
  cursor = ensureRoom(doc, cursor, lines.length * 5 + 4);
  doc.text(lines, MARGIN, cursor);
  return cursor + lines.length * 5 + 6;
}

function drawPredictionBox(
  doc: jsPDF,
  pred: ReportPrediction,
  cursor: number,
  t: typeof STRINGS.fr,
  step?: number,
): number {
  cursor = ensureRoom(doc, cursor, 30);
  cursor = drawSectionHeading(doc, t.prediction, cursor, step);

  const boxH = 18;
  cursor = ensureRoom(doc, cursor, boxH + 4);
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, cursor, CONTENT_W, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_TEXT);
  const labelText = pred.score_pct
    ? `${pred.label} — ${pred.score_pct}`
    : pred.label;
  doc.text(labelText, MARGIN + 4, cursor + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`${t.confidence}: ${pred.confidence_text}`, MARGIN + 4, cursor + 13);

  return cursor + boxH + 8;
}

function drawKeyFactors(
  doc: jsPDF,
  factors: ReportFactor[],
  cursor: number,
  t: typeof STRINGS.fr,
  step?: number,
): number {
  if (!factors.length) return cursor;

  cursor = ensureRoom(doc, cursor, 18);
  cursor = drawSectionHeading(doc, t.keyFactors, cursor, step);
  cursor -= 1;

  autoTable(doc, {
    startY: cursor,
    margin: { left: MARGIN, right: MARGIN },
    head: [[t.factorLabel, t.factorValue, t.factorDirection, t.factorExplanation]],
    body: factors.map((f) => [
      f.label,
      f.value + (f.normal_range ? `\n(${f.normal_range})` : ''),
      f.direction,
      f.explanation,
    ]),
    headStyles: { fillColor: COLOR_PRIMARY, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: COLOR_TEXT, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 'auto' },
    },
    styles: { cellPadding: 2.5 },
  });

  // jsPDF-autotable sets `lastAutoTable.finalY` after the table is drawn.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return (finalY ?? cursor) + 6;
}

/**
 * Render the disclaimer once on its own dedicated last page so the
 * legal notice is impossible to miss but never repeated.
 */
function drawFinalDisclaimer(
  doc: jsPDF,
  text: string,
  t: typeof STRINGS.fr,
): void {
  doc.addPage();
  const pageHeight = doc.internal.pageSize.getHeight();

  let cursor = MARGIN + 30;

  // Big centred title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_WARNING_BORDER);
  doc.text(t.disclaimer.toUpperCase(), PAGE_W / 2, cursor, { align: 'center' });
  cursor += 14;

  // Warning box around full disclaimer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT);
  const innerW = CONTENT_W - 12;
  const lines = doc.splitTextToSize(text, innerW);
  const lineH = 6;
  const boxH = 14 + lines.length * lineH;
  const boxY = cursor;

  doc.setFillColor(...COLOR_WARNING_BG);
  doc.setDrawColor(...COLOR_WARNING_BORDER);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, boxY, CONTENT_W, boxH, 3, 3, 'FD');

  // Optional warning glyph (using basic text — keeps PDF self-contained)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_WARNING_BORDER);
  doc.text('!', MARGIN + 6, boxY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(lines, MARGIN + 12, boxY + 9);

  // Bottom strip — date + project for traceability
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(t.endOfReport, PAGE_W / 2, pageHeight - MARGIN - 6, { align: 'center' });
}

function drawPaginationFooter(doc: jsPDF, t: typeof STRINGS.fr): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      `${t.page} ${i} ${t.of} ${pageCount}`,
      PAGE_W - MARGIN,
      pageHeight - MARGIN + 2,
      { align: 'right' },
    );
  }
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

type Strings = typeof STRINGS.fr;

// Color constants for chart drawing
const COLOR_RED:   [number, number, number] = [239, 68,  68];   // red-500
const COLOR_GREEN: [number, number, number] = [22,  163, 74];   // green-600
const COLOR_BLUE:  [number, number, number] = [59,  130, 246];  // blue-500
const COLOR_GREY_BG: [number, number, number] = [229, 231, 235]; // gray-200
const COLOR_GREY_TEXT: [number, number, number] = [75, 85, 99];  // gray-600

/**
 * Draw a horizontal progress-bar gauge showing the prediction score.
 *
 * Layout (all in mm):
 *   Full bar   = CONTENT_W wide, 7 mm tall
 *   Score fill = (scorePct / 100) × CONTENT_W
 *   Threshold  = a perpendicular tick + label
 */
function drawScoreGaugePdf(
  doc: jsPDF,
  input: PredictionReportPdfInput,
  cursor: number,
  t: Strings,
  step?: number,
): number {
  const { scorePct, thresholdPct = 50, lang } = input;
  if (scorePct == null) return cursor;

  const needed = 42;
  cursor = ensureRoom(doc, cursor, needed);
  cursor = drawSectionHeading(doc, t.scoreTitle, cursor, step);
  cursor += 2;

  const barH   = 7;
  const barW   = CONTENT_W;
  const scoreW = Math.max((scorePct / 100) * barW, 0.5);
  const threshX = MARGIN + (thresholdPct / 100) * barW;
  const isConcerning = scorePct > thresholdPct;
  const fillColor = isConcerning ? COLOR_RED : COLOR_GREEN;

  // Background bar (grey)
  doc.setFillColor(...COLOR_GREY_BG);
  doc.setDrawColor(...COLOR_GREY_BG);
  doc.roundedRect(MARGIN, cursor, barW, barH, 1.5, 1.5, 'F');

  // Score fill
  doc.setFillColor(...fillColor);
  doc.setDrawColor(...fillColor);
  doc.roundedRect(MARGIN, cursor, scoreW, barH, 1.5, 1.5, 'F');

  // Threshold tick (vertical line slightly taller than the bar)
  doc.setDrawColor(...COLOR_GREY_TEXT);
  doc.setLineWidth(0.7);
  doc.line(threshX, cursor - 2, threshX, cursor + barH + 2);

  // 0 % / 100 % endpoint labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('0%',   MARGIN,          cursor + barH + 4.5);
  doc.text('100%', MARGIN + barW,   cursor + barH + 4.5, { align: 'right' });

  // Threshold label (centred on the tick, clamped to stay inside the page)
  const threshLabel = `${t.alertLevel} ${thresholdPct}%`;
  const labelX = Math.min(Math.max(threshX, MARGIN + 16), MARGIN + barW - 16);
  doc.setTextColor(...COLOR_GREY_TEXT);
  doc.text(threshLabel, labelX, cursor + barH + 9, { align: 'center' });

  // Score callout (right side, coloured)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...fillColor);
  doc.text(`${scorePct}%`, MARGIN + barW + 5, cursor + barH - 0.5);

  cursor += barH + 13;

  // Caption below the bar
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_GREY_TEXT);
  const caption = isConcerning
    ? (lang === 'fr' ? `! ${t.aboveAlert}` : `! ${t.aboveAlert}`)
    : (lang === 'fr' ? `OK ${t.belowAlert}` : `OK ${t.belowAlert}`);
  doc.text(caption, MARGIN, cursor);
  cursor += 7;

  return cursor;
}

/**
 * Draw a horizontal bar chart for factor contributions.
 *
 * Centre axis at MARGIN + CONTENT_W / 2.
 * Bars extend left (reassuring, blue) or right (concerning, red).
 */
function drawFactorsChartPdf(
  doc: jsPDF,
  factors: PdfChartFactor[],
  cursor: number,
  lang: ReportLang,
  t: Strings,
  step?: number,
): number {
  if (factors.length === 0) return cursor;

  const ROW_H     = 8;   // mm per factor row
  const BAR_HALF  = 48;  // mm — max bar length each side
  const cx        = MARGIN + CONTENT_W / 2;  // centre x = 105 mm
  const needed    = 26 + factors.length * ROW_H;

  cursor = ensureRoom(doc, cursor, needed);
  cursor = drawSectionHeading(doc, t.factorInfluence, cursor, step);
  cursor += 1;

  // Legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_BLUE);
  doc.text(`<- ${t.reassuring}`, cx - 2, cursor, { align: 'right' });
  doc.setTextColor(...COLOR_RED);
  doc.text(`${t.concerning} ->`, cx + 2, cursor, { align: 'left' });
  cursor += 4;

  // Centre axis line
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.25);
  doc.line(cx, cursor, cx, cursor + factors.length * ROW_H);

  // Factor rows
  factors.forEach((f, i) => {
    const rowY = cursor + i * ROW_H;
    const midY = rowY + ROW_H / 2;

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN, rowY, CONTENT_W, ROW_H, 'F');
    }

    // Label (right-aligned, fits left of the left-bar zone)
    const MAX_LBL = 22;
    const label = f.label.length > MAX_LBL
      ? f.label.slice(0, MAX_LBL - 1) + '.'
      : f.label;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(label, cx - BAR_HALF - 2, midY + 1, { align: 'right' });

    // Bar
    const minLen   = f.weight > 0 ? 1 : 0;
    const barLen   = Math.max(Math.round(f.weight * BAR_HALF * 0.92), minLen);
    const isConcerning = f.direction === 'increase';
    const isNeutral    = f.direction === 'neutral';
    const barColor: [number, number, number] = isNeutral
      ? [156, 163, 175]
      : isConcerning ? COLOR_RED : COLOR_BLUE;
    const barX = isConcerning ? cx : cx - barLen;
    const barRectH = ROW_H - 3;

    if (barLen > 0) {
      doc.setFillColor(...barColor);
      doc.rect(barX, midY - barRectH / 2, barLen, barRectH, 'F');
    }

    // Value (right of bar zone)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(f.value, cx + BAR_HALF + 3, midY + 1);
  });

  cursor += factors.length * ROW_H + 6;
  return cursor;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function downloadPredictionReportPdf(input: PredictionReportPdfInput): void {
  const t = STRINGS[input.lang];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let cursor = drawHeader(doc, input, t);

  // Pedagogical, numbered walkthrough.
  let step = 1;

  if (input.prediction) {
    cursor = drawPredictionBox(doc, input.prediction, cursor, t, step++);
  }
  if (input.scorePct != null) {
    cursor = drawScoreGaugePdf(doc, input, cursor, t, step++);
  }
  if (input.summary) {
    cursor = drawSection(doc, t.summary, input.summary, cursor, step++);
  }
  if (input.chartFactors && input.chartFactors.length > 0) {
    cursor = drawFactorsChartPdf(doc, input.chartFactors, cursor, input.lang, t, step++);
  }
  if (input.keyFactors.length > 0) {
    cursor = drawKeyFactors(doc, input.keyFactors, cursor, t, step++);
  }
  if (input.context) {
    cursor = drawSection(doc, t.context, input.context, cursor, step++);
  }
  if (input.limitations) {
    cursor = drawSection(doc, t.limitations, input.limitations, cursor, step++);
  }
  if (input.nextSteps) {
    cursor = drawSection(doc, t.nextSteps, input.nextSteps, cursor, step++);
  }

  // Disclaimer rendered once on a dedicated final page.
  drawFinalDisclaimer(doc, input.disclaimer, t);
  drawPaginationFooter(doc, t);

  const ts = (input.generatedAt ?? new Date())
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const safeModel = input.modelName.replace(/[^\w-]/g, '_');
  doc.save(`${t.filenamePrefix}_${safeModel}_${ts}.pdf`);
}
