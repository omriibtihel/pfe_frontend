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

  return sepY + 6;
}

function drawSection(doc: jsPDF, title: string, body: string, cursor: number): number {
  if (!body) return cursor;

  cursor = ensureRoom(doc, cursor, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(title.toUpperCase(), MARGIN, cursor);
  cursor += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT);
  const lines = doc.splitTextToSize(body, CONTENT_W);
  cursor = ensureRoom(doc, cursor, lines.length * 5 + 4);
  doc.text(lines, MARGIN, cursor);
  return cursor + lines.length * 5 + 4;
}

function drawPredictionBox(
  doc: jsPDF,
  pred: ReportPrediction,
  cursor: number,
  t: typeof STRINGS.fr,
): number {
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

  return cursor + boxH + 6;
}

function drawKeyFactors(
  doc: jsPDF,
  factors: ReportFactor[],
  cursor: number,
  t: typeof STRINGS.fr,
): number {
  if (!factors.length) return cursor;

  cursor = ensureRoom(doc, cursor, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(t.keyFactors.toUpperCase(), MARGIN, cursor);
  cursor += 4;

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

function drawDisclaimerFooter(
  doc: jsPDF,
  text: string,
  t: typeof STRINGS.fr,
): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Disclaimer banner anchored to the bottom of every page so it cannot
    // be trimmed off by a misaligned print job.
    doc.setFillColor(...COLOR_WARNING_BG);
    doc.setDrawColor(...COLOR_WARNING_BORDER);
    doc.setLineWidth(0.3);
    const bannerY = pageHeight - MARGIN - 12;
    doc.roundedRect(MARGIN, bannerY, CONTENT_W, 9, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_WARNING_BORDER);
    doc.text(t.disclaimer.toUpperCase(), MARGIN + 2, bannerY + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT);
    const lines = doc.splitTextToSize(text, CONTENT_W - 4);
    doc.text(lines.slice(0, 2), MARGIN + 2, bannerY + 7);

    // Pagination
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

// ── Public entry point ────────────────────────────────────────────────────────

export function downloadPredictionReportPdf(input: PredictionReportPdfInput): void {
  const t = STRINGS[input.lang];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let cursor = drawHeader(doc, input, t);

  if (input.prediction) {
    cursor = drawPredictionBox(doc, input.prediction, cursor, t);
  }

  cursor = drawSection(doc, t.summary, input.summary, cursor);
  cursor = drawKeyFactors(doc, input.keyFactors, cursor, t);
  cursor = drawSection(doc, t.context, input.context, cursor);
  cursor = drawSection(doc, t.limitations, input.limitations, cursor);
  cursor = drawSection(doc, t.nextSteps, input.nextSteps, cursor);

  drawDisclaimerFooter(doc, input.disclaimer, t);

  const ts = (input.generatedAt ?? new Date())
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const safeModel = input.modelName.replace(/[^\w-]/g, '_');
  doc.save(`${t.filenamePrefix}_${safeModel}_${ts}.pdf`);
}
