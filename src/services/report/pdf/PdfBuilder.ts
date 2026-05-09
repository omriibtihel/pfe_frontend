import jsPDF from 'jspdf';
import type { DatasetOut } from '../../databaseService';
import {
  ALERT,
  AlertKind,
  C_ACCENT,
  C_DARK,
  C_INK,
  C_MUTED,
  C_RULE,
} from '../theme';
import type { MLReadiness, RGB } from '../types';

/**
 * Encapsulates the jsPDF document plus every layout helper used by the
 * section renderers. The `doc`, vertical cursor `y` and page metrics
 * (margins, content width) are owned by the builder; sections only call
 * methods on it.
 *
 * This keeps each section file pure — given a builder + a `ReportContext`,
 * it knows where it can draw and where it can't, but never manipulates
 * raw jsPDF state directly.
 */
export class PdfBuilder {
  readonly doc: jsPDF;
  readonly pw: number;
  readonly ph: number;
  readonly M = 18;
  readonly CW: number;
  y: number;

  private readonly _dataset: DatasetOut;

  constructor(dataset: DatasetOut) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.pw = this.doc.internal.pageSize.getWidth();
    this.ph = this.doc.internal.pageSize.getHeight();
    this.CW = this.pw - 2 * this.M;
    this.y = this.M;
    this._dataset = dataset;
  }

  // ── Layout helpers ─────────────────────────────────────────────────────────

  drawRunningHeader(): void {
    const { doc, pw, M } = this;
    doc.setFillColor(11, 22, 46);
    doc.rect(0, 0, pw, 11, 'F');
    doc.setFillColor(...C_ACCENT);
    doc.rect(0, 10.5, pw, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(37, 99, 235);
    doc.text('MEDIQ', M, 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text("Rapport d'analyse des donnees", pw / 2, 7.5, { align: 'center' });
    doc.setTextColor(203, 213, 225);
    doc.text(this._dataset.original_name, pw - M, 7.5, { align: 'right' });
  }

  ensureSpace(needed: number): void {
    if (this.y + needed > this.ph - this.M - 8) {
      this.doc.addPage();
      this.y = this.M + 8;
      this.drawRunningHeader();
    }
  }

  drawRule(thickness = 0.3): void {
    this.doc.setDrawColor(...C_RULE);
    this.doc.setLineWidth(thickness);
    this.doc.line(this.M, this.y, this.pw - this.M, this.y);
    this.y += 4;
  }

  /** Section title: full-width band with left accent bar + number + title. */
  sectionTitle(num: string, title: string): void {
    const { doc, M, CW } = this;
    this.ensureSpace(22);
    this.y += 8;
    doc.setFillColor(239, 246, 255);
    doc.rect(M, this.y, CW, 11, 'F');
    doc.setFillColor(...C_ACCENT);
    doc.rect(M, this.y, 3.5, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_ACCENT);
    doc.text(num, M + 9, this.y + 7.5);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C_DARK);
    doc.text(title.toUpperCase(), M + 21, this.y + 7.5);
    this.y += 16;
  }

  /** Sub-heading inside a section. */
  subHeading(text: string): void {
    this.ensureSpace(10);
    this.y += 2;
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...C_DARK);
    this.doc.text(text, this.M, this.y);
    this.y += 6;
  }

  /** Body paragraph. */
  para(text: string, maxWidth = this.CW): void {
    const lines = this.doc.splitTextToSize(text, maxWidth);
    const h = lines.length * 5;
    this.ensureSpace(h + 3);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...C_INK);
    this.doc.text(lines, this.M, this.y);
    this.y += h + 4;
  }

  /** Small muted caption / note. */
  note(text: string, maxWidth = this.CW): void {
    const lines = this.doc.splitTextToSize(text, maxWidth);
    const h = lines.length * 4.5;
    this.ensureSpace(h + 2);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...C_MUTED);
    this.doc.text(lines, this.M, this.y);
    this.y += h + 3;
  }

  /** Highlight box — use sparingly for genuinely important notices. */
  highlight(text: string, kind: AlertKind, maxWidth = this.CW): void {
    const { doc, M } = this;
    const c = ALERT[kind];
    const icon = kind === 'success' ? 'v' : '!';
    const lines = doc.splitTextToSize(text, maxWidth - 22);
    const h = Math.max(14, lines.length * 5 + 12);
    this.ensureSpace(h + 4);
    doc.setFillColor(...c.bg);
    doc.roundedRect(M, this.y, maxWidth, h, 2, 2, 'F');
    doc.setFillColor(...c.bar);
    doc.roundedRect(M, this.y, 4, h, 2, 2, 'F');
    doc.rect(M + 1.5, this.y, 2.5, h, 'F');
    doc.setFillColor(...c.bar);
    doc.circle(M + 12, this.y + h / 2, 3.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(icon, M + 12, this.y + h / 2 + 2.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c.text);
    doc.text(lines, M + 20, this.y + 7.5);
    this.y += h + 5;
  }

  /** Y position after the most recently rendered autoTable. */
  getLastY(): number {
    return (this.doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? this.y;
  }

  // ── Cover page ─────────────────────────────────────────────────────────────

  drawCoverPage(opts: {
    completeness: number;
    completenessColor: RGB;
    mlReadiness: MLReadiness;
    totalRows: number;
    totalCols: number;
  }): void {
    const { doc, pw, M, CW } = this;
    const { completeness, completenessColor, mlReadiness, totalRows, totalCols } = opts;

    const now = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

    // Main header band — dark navy
    const BAND_H = 96;
    doc.setFillColor(11, 22, 46);
    doc.rect(0, 0, pw, BAND_H, 'F');
    doc.setFillColor(15, 33, 68);
    doc.rect(0, 52, pw, BAND_H - 52, 'F');
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
    doc.text("RAPPORT D'ANALYSE", M, 27);

    // Dataset title — large bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(255, 255, 255);
    const titleLines = doc.splitTextToSize(this._dataset.original_name, pw - 2 * M - 20);
    doc.text(titleLines[0], M, 39);
    if (titleLines.length > 1) {
      doc.setFontSize(14);
      doc.text(titleLines[1], M, 48);
    }

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Analyse de qualite  ·  Preparation ML  ·  Recommandations', M, 51);

    // KPI boxes row
    const KPI_TOP = 57;
    const KPI_H = 24;
    const KPI_GAP = 3;
    const KPI_W = (CW - KPI_GAP * 3) / 4;
    const mlBadgeLabel =
      mlReadiness.level === 'ready' ? 'Pret' : mlReadiness.level === 'ready_with_prep' ? 'A prep.' : 'Bloque';
    const mlBadgeColor: RGB =
      mlReadiness.level === 'ready'
        ? [74, 222, 128]
        : mlReadiness.level === 'ready_with_prep'
          ? [251, 191, 36]
          : [248, 113, 113];
    const kpiData: Array<{ label: string; value: string; color: RGB }> = [
      { label: 'Observations', value: totalRows.toLocaleString(), color: [255, 255, 255] },
      { label: 'Variables', value: String(totalCols), color: [255, 255, 255] },
      { label: 'Completude', value: `${completeness}%`, color: completenessColor },
      { label: 'Statut ML', value: mlBadgeLabel, color: mlBadgeColor },
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

    this.y = BAND_H + 10;
  }

  // ── Footers ────────────────────────────────────────────────────────────────

  drawFooters(): void {
    const { doc, pw, ph, M } = this;
    const now = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(11, 22, 46);
      doc.rect(0, ph - 13, pw, 13, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(37, 99, 235);
      doc.text('MedIQ', M, ph - 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(' — Document confidentiel', M + 23, ph - 5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(now, pw / 2, ph - 5.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`${i} / ${pageCount}`, pw - M, ph - 5.5, { align: 'right' });
      if (i > 1) this.drawRunningHeader();
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  save(): void {
    const safeName = this._dataset.original_name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9_-]/gi, '_')
      .slice(0, 40);
    this.doc.save(`rapport_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
