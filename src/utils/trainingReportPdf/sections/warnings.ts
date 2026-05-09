import type jsPDF from 'jspdf';
import { metricDirection } from '@/utils/metricUtils';
import { C, CW, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { drawc, ensureY, fill, section, txtc } from '../drawing';
import { modelName, num4, pct } from '../formatters';

export function renderWarnings(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { session, isReg } = ctx;

  const warnings: string[] = [];

  // Overfitting detection — direction-aware.
  for (const r of session.results) {
    const tr = r.trainScore;
    const te = r.testScore;
    if (tr !== null && te !== null) {
      const direction = metricDirection(r.primaryMetric?.name ?? 'accuracy');
      const overfitThreshold = 0.15;
      const gap = direction === 'lower_is_better' ? te - tr : tr - te;
      if (gap > overfitThreshold) {
        warnings.push(
          `${modelName(r.modelType)} : écart notable entre score entraînement (${isReg ? num4(tr) : pct(tr)}) et score test (${isReg ? num4(te) : pct(te)}) — risque de sur-apprentissage.`,
        );
      }
    }
  }

  // Mandatory generic disclaimers.
  warnings.push(
    'Ce rapport est généré automatiquement. Les performances présentées sont mesurées sur un jeu de test interne et ne garantissent pas les résultats en conditions réelles.',
    'Tout déploiement en environnement clinique nécessite une validation prospective sur des données indépendantes, une revue par des experts du domaine et une évaluation éthique.',
    'La fiabilité des métriques dépend de la taille et de la représentativité du jeu de données. Un faible effectif peut entraîner des estimations instables.',
  );

  if (warnings.length === 0) return y;

  y = ensureY(doc, y, 30);
  y = section(doc, '5.', 'Avertissements et limites', y);

  for (const w of warnings.slice(0, 8)) {
    const wLines = doc.splitTextToSize(w, CW - 22);
    const wH = Math.max(11, wLines.length * 4.5 + 9);
    y = ensureY(doc, y, wH + 3);

    fill(doc, C.orangeBg);
    drawc(doc, C.orange);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y, CW, wH, 1.5, 1.5, 'FD');
    doc.setLineWidth(0.1);

    fill(doc, C.orange);
    doc.roundedRect(M, y, 4, wH, 1.5, 1.5, 'F');
    doc.rect(M + 1.5, y, 2.5, wH, 'F');

    fill(doc, C.orange);
    doc.circle(M + 12, y + wH / 2, 3.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    txtc(doc, C.white);
    doc.text('!', M + 12, y + wH / 2 + 2.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    txtc(doc, C.slate);
    doc.text(wLines, M + 21, y + 6.5);
    y += wH + 3;
  }

  return y;
}
