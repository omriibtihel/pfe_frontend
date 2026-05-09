import { FileText, Star } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { PredictionRow } from '@/types';
import { _fmt } from './helpers';

export function RowDetailsModal({
  row,
  topFeatures,
  isClassification,
  threshold,
  onClose,
}: {
  row: PredictionRow;
  topFeatures: string[];
  isClassification: boolean;
  threshold: number;
  onClose: () => void;
}) {
  const allFeatures = Object.keys(row.inputData);
  const topSet = new Set(topFeatures);
  const otherFeatures = allFeatures.filter((f) => !topSet.has(f)).sort((a, b) => a.localeCompare(b));

  const descParts = [
    `Prédiction : ${String(row.prediction)}`,
    isClassification && row.score != null
      ? `Score : ${(row.score * 100).toFixed(1)} % (seuil ${(threshold * 100).toFixed(0)} %)`
      : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const renderRow = (name: string, isTop: boolean) => {
    const value = row.inputData[name];
    return (
      <div
        key={name}
        className="grid grid-cols-[1fr_auto] items-baseline gap-3 px-3 py-1.5 rounded-md hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate" title={name}>
          {isTop && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
          <span className={isTop ? 'font-medium text-foreground' : ''}>{name}</span>
        </span>
        <span className="font-mono tabular-nums text-[12px] font-semibold text-foreground" title={_fmt(value)}>
          {_fmt(value)}
        </span>
      </div>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      icon={<FileText className="h-5 w-5" />}
      title={`Détails complets — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <p className="text-[11px] text-muted-foreground">
          ★ marque les variables jugées les plus importantes par le modèle (SHAP global). Les valeurs affichées
          sont celles passées en entrée — non transformées.
        </p>
      }
    >
      <div className="space-y-4">
        {topFeatures.length > 0 && (
          <section className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Variables clés du modèle
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
              {topFeatures.map((f) => renderRow(f, true))}
            </div>
          </section>
        )}

        {otherFeatures.length > 0 && (
          <section className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Autres variables
              <span className="ml-1.5 normal-case font-normal text-muted-foreground/80 tracking-normal">
                ({otherFeatures.length})
              </span>
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/40">
              {otherFeatures.map((f) => renderRow(f, false))}
            </div>
          </section>
        )}

        {allFeatures.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune variable disponible.</p>
        )}
      </div>
    </Modal>
  );
}
