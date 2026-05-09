import { Loader2, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { PredictionReportPanel } from '@/components/prediction/PredictionReportPanel';
import type { ExplanationMethod, LimeLocalItem, PredictionRow, ShapLocalItem } from '@/types';
import { ExplanationPanel, MethodToggle } from './ExplanationPanel';

export function ExplanationModal({
  row,
  shapItems,
  limeItems,
  method,
  onMethodChange,
  isLoading,
  isClassification,
  onClose,
  projectId,
  modelId,
  modelName,
  projectName,
}: {
  row: PredictionRow;
  shapItems?: ShapLocalItem[] | null;
  limeItems?: LimeLocalItem[] | null;
  method: ExplanationMethod;
  onMethodChange: (m: ExplanationMethod) => void;
  isLoading: boolean;
  isClassification: boolean;
  onClose: () => void;
  projectId: string;
  modelId: number;
  modelName: string;
  projectName: string;
}) {
  const descParts = [
    `Prédiction : ${String(row.prediction)}`,
    isClassification && row.score != null ? `Score : ${(row.score * 100).toFixed(1)}%` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const titlePrefix = method === 'shap' ? 'SHAP' : method === 'lime' ? 'LIME' : 'SHAP vs LIME';

  // Inject the latest LIME items into the row so the report panel can use them.
  const rowWithLime: PredictionRow = { ...row, lime: limeItems ?? row.lime ?? null };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={<Sparkles className="h-5 w-5" />}
      title={`Explication ${titlePrefix} — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-[11px] text-muted-foreground">
            Impact <span className="font-medium text-orange-600 dark:text-orange-400">positif ↑</span> ou{' '}
            <span className="font-medium text-blue-600 dark:text-blue-400">négatif ↓</span> par rapport à la
            prédiction moyenne du modèle.
          </p>
          <PredictionReportPanel
            projectId={projectId}
            modelId={modelId}
            row={rowWithLime}
            projectName={projectName}
            modelName={modelName}
          />
        </div>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] text-muted-foreground">Méthode d'explication</span>
          <MethodToggle value={method} onChange={onMethodChange} />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ExplanationPanel method={method} shapItems={shapItems} limeItems={limeItems} />
        )}
      </div>
    </Modal>
  );
}
