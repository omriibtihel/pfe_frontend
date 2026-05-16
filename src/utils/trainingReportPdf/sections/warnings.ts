import type jsPDF from 'jspdf';
import { metricDirection } from '@/utils/metricUtils';
import { C, CW, M } from '../constants';
import type { TrainingReportContext } from '../context';
import { ensureY, fill, section, txtc } from '../drawing';
import { modelName, num4, pct } from '../formatters';

/**
 * Section 5 — Note d'interprétation et limites.
 * Format sobre : paragraphes numérotés avec un fin trait vertical à gauche,
 * sans pastilles ni encadrés colorés.
 */
export function renderWarnings(doc: jsPDF, ctx: TrainingReportContext, y: number): number {
  const { session, isReg } = ctx;

  const notes: string[] = [];

  // Détection de sur-apprentissage par modèle (direction-aware)
  for (const r of session.results) {
    const tr = r.trainScore;
    const te = r.testScore;
    if (tr !== null && te !== null) {
      const direction = metricDirection(r.primaryMetric?.name ?? 'accuracy');
      const gap = direction === 'lower_is_better' ? te - tr : tr - te;
      if (gap > 0.15) {
        notes.push(
          `${modelName(r.modelType)} : écart notable entre train (${isReg ? num4(tr) : pct(tr)}) et test (${isReg ? num4(te) : pct(te)}) — risque de sur-apprentissage.`,
        );
      }
    }
  }

  // Avertissements génériques obligatoires
  notes.push(
    "Ce rapport est généré automatiquement. Les performances mesurées sur le jeu de test interne ne garantissent pas les résultats en conditions réelles.",
    "Tout déploiement en environnement clinique nécessite une validation prospective sur données indépendantes, une revue par des experts du domaine et une évaluation éthique.",
    "La fiabilité des métriques dépend de la taille et de la représentativité du jeu de données. Un faible effectif peut entraîner des estimations instables.",
  );

  if (notes.length === 0) return y;

  y = ensureY(doc, y, 24);
  y = section(doc, '5.', "Note d'interprétation et limites", y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  txtc(doc, C.slate);

  for (let i = 0; i < notes.length; i++) {
    const text = notes[i];
    const lines = doc.splitTextToSize(text, CW - 8);
    const h = Math.max(8, lines.length * 4.5 + 3);
    y = ensureY(doc, y, h + 2);

    // Trait vertical bleu marine discret à gauche
    fill(doc, C.navy);
    doc.rect(M, y, 1.2, h - 1, 'F');

    doc.text(lines, M + 5, y + 4);
    y += h + 1;
  }

  return y;
}
