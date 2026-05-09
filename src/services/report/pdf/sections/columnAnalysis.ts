import type { PdfBuilder } from '../PdfBuilder';
import type { ReportContext, RGB } from '../../types';
import { C_ACCENT, C_AMBER, C_DARK, C_GREEN, C_MUTED, C_RED } from '../../theme';

type ColGroup = {
  label: string;
  kind: 'critical' | 'warning' | 'info' | 'success';
  cols: string[];
  message: string;
};

export function renderColumnAnalysis(
  pdf: PdfBuilder,
  ctx: ReportContext,
  allColumnNames: string[],
): void {
  pdf.sectionTitle('04', 'Analyse des colonnes');

  const { suspectedIds, constantCols, heavyMissingCols, zeroSuspects, highCardinalityCols } = ctx;

  const groups: ColGroup[] = [];

  if (suspectedIds.length > 0) {
    groups.push({
      label: 'Identifiants potentiels',
      kind: 'critical',
      cols: suspectedIds,
      message:
        "Cardinalité très élevée ou nom caractéristique d'identifiant. Ces colonnes ne contribuent pas à la prédiction et introduisent du sur-apprentissage.",
    });
  }
  if (constantCols.length > 0) {
    groups.push({
      label: 'Colonnes constantes — variance nulle',
      kind: 'critical',
      cols: constantCols,
      message:
        'Une seule valeur distincte : aucune information discriminante. À supprimer avant tout entraînement.',
    });
  }
  if (heavyMissingCols.length > 0) {
    groups.push({
      label: 'Valeurs manquantes critiques (> 15%)',
      kind: 'warning',
      cols: heavyMissingCols,
      message:
        'Plus de 15% de valeurs manquantes. Imputation avancée (KNN, MICE) recommandée, ou suppression si le taux dépasse 40%.',
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
      message:
        'Trop de valeurs distinctes pour un encodage one-hot standard. Privilégiez le target encoding ou le regroupement par fréquence.',
    });
  }

  const problematicSet = new Set([
    ...suspectedIds,
    ...constantCols,
    ...heavyMissingCols,
    ...zeroSuspects,
    ...highCardinalityCols,
  ]);
  const cleanCols = allColumnNames.filter((n) => !problematicSet.has(n));

  if (cleanCols.length > 0) {
    groups.push({
      label: 'Colonnes exploitables',
      kind: 'success',
      cols: cleanCols,
      message:
        'Ces colonnes ne présentent pas de problème structurel détecté — elles sont prêtes à être utilisées.',
    });
  }

  for (const group of groups) {
    pdf.ensureSpace(14);
    pdf.doc.setFontSize(9);
    pdf.doc.setFont('helvetica', 'bold');
    pdf.doc.setTextColor(...C_DARK);
    pdf.doc.text(`${group.label}  (${group.cols.length})`, pdf.M, pdf.y);
    pdf.y += 5;

    const descLines = pdf.doc.splitTextToSize(group.message, pdf.CW);
    pdf.doc.setFontSize(8);
    pdf.doc.setFont('helvetica', 'italic');
    pdf.doc.setTextColor(...C_MUTED);
    pdf.doc.text(descLines, pdf.M, pdf.y);
    pdf.y += descLines.length * 4.5 + 3;

    const colText = group.cols.join('  ·  ');
    const colLines = pdf.doc.splitTextToSize(colText, pdf.CW);
    pdf.ensureSpace(colLines.length * 4.5 + 4);
    pdf.doc.setFontSize(8);
    pdf.doc.setFont('helvetica', 'normal');
    const textColor: RGB =
      group.kind === 'critical'
        ? C_RED
        : group.kind === 'warning'
          ? C_AMBER
          : group.kind === 'success'
            ? C_GREEN
            : C_ACCENT;
    pdf.doc.setTextColor(...textColor);
    pdf.doc.text(colLines, pdf.M + 2, pdf.y);
    pdf.y += colLines.length * 4.5 + 7;
  }
}
