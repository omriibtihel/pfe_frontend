import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { DEFAULT_ADVANCED_PARAMS, type TrainingPreprocessingAdvancedParams } from '@/types';

interface AdvancedPreprocessingModalProps {
  params: TrainingPreprocessingAdvancedParams;
  onChange: (params: TrainingPreprocessingAdvancedParams) => void;
}

export function AdvancedPreprocessingModal({ params, onChange }: AdvancedPreprocessingModalProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TrainingPreprocessingAdvancedParams>(params);

  const handleOpen = () => {
    setDraft(params);
    setOpen(true);
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleReset = () => setDraft(DEFAULT_ADVANCED_PARAMS);

  const isModified =
    params.knnNeighbors !== DEFAULT_ADVANCED_PARAMS.knnNeighbors ||
    params.constantFillNumeric !== DEFAULT_ADVANCED_PARAMS.constantFillNumeric ||
    params.constantFillCategorical !== DEFAULT_ADVANCED_PARAMS.constantFillCategorical ||
    params.varianceThreshold !== DEFAULT_ADVANCED_PARAMS.varianceThreshold;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5 text-xs"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Paramètres avancés
        {isModified && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" title="Modifié" />
        )}
      </Button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Paramètres avancés du preprocessing"
        description="Ces valeurs sont appliquées telles quelles au backend. Aucune valeur n'est cachée."
        size="md"
        icon={<Settings2 className="h-5 w-5" />}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              Réinitialiser
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={handleApply}>
              Appliquer
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* KNN Imputation */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-knn" className="text-sm font-medium">
              KNN Imputation — nombre de voisins{' '}
              <span className="text-muted-foreground font-normal">(KNNImputer k)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Utilisé quand l'imputation est réglée sur <strong>knn</strong>. Doit être ≥ 1.
              Défaut : 5.
            </p>
            <Input
              id="adv-knn"
              type="number"
              min={1}
              max={50}
              value={draft.knnNeighbors}
              onChange={(e) => {
                const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                setDraft((d) => ({ ...d, knnNeighbors: v }));
              }}
            />
          </div>

          {/* Constant fill — numeric */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-fill-num" className="text-sm font-medium">
              Imputation constante numérique{' '}
              <span className="text-muted-foreground font-normal">(fill_value)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Valeur insérée quand l'imputation est <strong>constant</strong> pour une colonne numérique.
              Défaut : 0.
            </p>
            <Input
              id="adv-fill-num"
              type="number"
              step="any"
              value={draft.constantFillNumeric}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setDraft((d) => ({ ...d, constantFillNumeric: v }));
              }}
            />
          </div>

          {/* Constant fill — categorical */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-fill-cat" className="text-sm font-medium">
              Imputation constante catégorielle{' '}
              <span className="text-muted-foreground font-normal">(fill_value)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Valeur insérée quand l'imputation est <strong>constant</strong> pour une colonne
              catégorielle. Défaut : <code>__missing__</code>.
            </p>
            <Input
              id="adv-fill-cat"
              value={draft.constantFillCategorical}
              onChange={(e) =>
                setDraft((d) => ({ ...d, constantFillCategorical: e.target.value }))
              }
              placeholder="__missing__"
            />
          </div>

          {/* VarianceThreshold */}
          <div className="space-y-1.5">
            <Label htmlFor="adv-vt" className="text-sm font-medium">
              VarianceThreshold{' '}
              <span className="text-muted-foreground font-normal">(seuil)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Les features dont la variance est <strong>inférieure</strong> à ce seuil sont supprimées
              après le preprocessing. <strong>0 = désactivé</strong> (aucune feature supprimée).
              Défaut : 0.01.
            </p>
            <Input
              id="adv-vt"
              type="number"
              min={0}
              max={1}
              step={0.001}
              value={draft.varianceThreshold}
              onChange={(e) => {
                const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                setDraft((d) => ({ ...d, varianceThreshold: v }));
              }}
            />
            {draft.varianceThreshold === 0 && (
              <p className="text-xs text-amber-600">
                VarianceThreshold désactivé — aucune feature ne sera supprimée automatiquement.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
