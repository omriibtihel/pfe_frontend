import type jsPDF from 'jspdf';
import { W, H, M, CW, BOT, C, type RGB } from './constants';
import type { Quality } from './constants';
import { quality, qualityColor } from './quality';

// ── Utilitaires de dessin ─────────────────────────────────────────────────────
export function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
export function drawc(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
export function txtc(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }

export function ensureY(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > BOT) { doc.addPage(); return M + 4; }
  return y;
}

/** Barre de progression horizontale colorée selon la qualité. */
export function bar(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  value: number | null, lowerIsBetter = false,
): void {
  const ratio = value == null ? 0 : Math.max(0, Math.min(1, Math.abs(value)));
  const q = quality(value, lowerIsBetter);
  fill(doc, C.border);
  doc.rect(x, y, w, h, 'F');
  if (ratio > 0.005) {
    fill(doc, qualityColor(q));
    doc.rect(x, y, ratio * w, h, 'F');
  }
}

/** Point de qualité coloré (disque). */
export function dot(doc: jsPDF, x: number, y: number, q: Quality): void {
  fill(doc, qualityColor(q));
  doc.circle(x, y, 1.3, 'F');
}

/** En-tête de section numérotée (bandeau). */
export function section(doc: jsPDF, num: string, title: string, y: number): number {
  y = ensureY(doc, y, 18);
  y += 4;
  // Background band
  fill(doc, C.navyLight);
  doc.rect(M, y, CW, 11, 'F');
  // Left accent bar
  fill(doc, C.navy);
  doc.rect(M, y, 4, 11, 'F');
  // Section number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  txtc(doc, C.teal);
  doc.text(num, M + 8, y + 7.5);
  // Title
  doc.setFontSize(10);
  txtc(doc, C.navy);
  doc.text(title.toUpperCase(), M + 19, y + 7.5);
  txtc(doc, C.slate);
  return y + 16;
}

/** Séparateur horizontal léger. */
export function hrule(doc: jsPDF, y: number): void {
  drawc(doc, C.border);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  doc.setLineWidth(0.1);
}

/**
 * Dessine une courbe ROC ou PR dans un espace délimité.
 * pts : [[x0,y0], [x1,y1], ...] en coordonnées normalisées [0,1].
 * showDiag : true = trace la diagonale aléatoire (ROC uniquement).
 */
export function drawMiniCurve(
  doc: jsPDF,
  pts: [number, number][],
  x0: number, y0: number,
  w: number,  h: number,
  title: string,
  subLabel: string,
  showDiag: boolean,
): void {
  const PL = 9; const PB = 7; const PT = 10; const PR = 3;
  const AX = x0 + PL;
  const AY = y0 + h - PB;
  const AW = w - PL - PR;
  const AH = h - PB - PT;

  // Cadre extérieur
  fill(doc, C.white);
  drawc(doc, C.border);
  doc.setLineWidth(0.2);
  doc.rect(x0, y0, w, h, 'FD');

  // Zone de tracé
  fill(doc, C.bg);
  doc.rect(AX, y0 + PT, AW, AH, 'F');

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  txtc(doc, C.navy);
  doc.text(title, x0 + w / 2, y0 + 5, { align: 'center' });

  // Sous-label (AUC)
  if (subLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    txtc(doc, C.muted);
    doc.text(subLabel, x0 + w / 2, y0 + 9, { align: 'center' });
  }

  // Axes
  drawc(doc, C.border);
  doc.setLineWidth(0.15);
  doc.line(AX, AY, AX + AW, AY);
  doc.line(AX, AY, AX, y0 + PT);

  // Graduations
  doc.setFontSize(4.5);
  txtc(doc, C.muted);
  doc.setLineWidth(0.1);
  for (let t = 0; t <= 4; t++) {
    const v = t / 4;
    const lx = AX + v * AW;
    const ly = AY - v * AH;
    doc.line(lx, AY, lx, AY + 0.7);
    if (t === 0 || t === 2 || t === 4) doc.text(v.toFixed(1), lx, AY + 3.5, { align: 'center' });
    doc.line(AX, ly, AX - 0.7, ly);
    if (t === 2 || t === 4) doc.text(v.toFixed(1), AX - 1.2, ly + 1, { align: 'right' });
  }

  // Diagonale aléatoire (ROC)
  if (showDiag) {
    doc.setLineDashPattern([1.2, 1.2], 0);
    drawc(doc, C.muted);
    doc.setLineWidth(0.2);
    doc.line(AX, AY, AX + AW, y0 + PT);
    doc.setLineDashPattern([], 0);
  }

  // Courbe
  if (pts.length >= 2) {
    const px = (v: number) => AX + Math.max(0, Math.min(1, v)) * AW;
    const py = (v: number) => AY - Math.max(0, Math.min(1, v)) * AH;
    doc.setLineWidth(0.7);
    drawc(doc, C.navyMid);
    doc.setLineDashPattern([], 0);
    for (let i = 1; i < pts.length; i++) {
      doc.line(px(pts[i - 1][0]), py(pts[i - 1][1]), px(pts[i][0]), py(pts[i][1]));
    }
  }
}

/** Dernier finalY d'autoTable ou fallback. */
export function finalY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback;
}

// ── Pied de page ──────────────────────────────────────────────────────────────
export function footers(doc: jsPDF, genDate: string): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    // Thin top divider
    drawc(doc, C.border);
    doc.setLineWidth(0.3);
    doc.line(M, H - 14.5, W - M, H - 14.5);
    doc.setLineWidth(0.1);
    // Light footer background
    fill(doc, [248, 250, 252] as RGB);
    doc.rect(0, H - 14, W, 14, 'F');
    // Left: branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    txtc(doc, C.navy);
    doc.text('MedicalVision', M, H - 5.5);
    doc.setFont('helvetica', 'normal');
    txtc(doc, C.muted);
    doc.text(' \u2014 Document confidentiel a usage professionnel', M + 23, H - 5.5);
    // Center: generation date
    doc.setFontSize(6.5);
    txtc(doc, C.muted);
    doc.text(`Genere le ${genDate}`, W / 2, H - 5.5, { align: 'center' });
    // Right: page number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    txtc(doc, C.navy);
    doc.text(`${p} / ${total}`, W - M, H - 5.5, { align: 'right' });
  }
}
