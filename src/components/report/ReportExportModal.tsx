import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { ReportInput, ReportSections } from '@/services/reportService';
import { DEFAULT_SECTIONS, generateDatasetReport } from '@/services/reportService';
import type { CorrelationOut } from '@/services/databaseService';

// ─────────────────────────────────────────────────────────────────────────────
// Section definitions (label, key, description)
// ─────────────────────────────────────────────────────────────────────────────

type SectionDef = {
  key: keyof ReportSections;
  label: string;
  description: string;
  requiresCorrelation?: boolean;
};

const SECTIONS: SectionDef[] = [
  { key: 'executiveSummary', label: 'Résumé exécutif',             description: 'Synthèse narrative automatique de l\'état du dataset en 3-4 phrases.' },
  { key: 'generalInfo',      label: 'Informations générales',      description: 'Nom, dimensions, format, date d\'import, variable cible et tâche détectée.' },
  { key: 'dataQuality',      label: 'Qualité des données',         description: 'Complétude, types, nulls, outliers, identifiants et colonnes constantes.' },
  { key: 'columnAnalysis',   label: 'Analyse des colonnes',        description: 'Colonnes groupées : identifiants, constantes, haute cardinalité, manquants critiques.' },
  { key: 'missingValues',    label: 'Valeurs manquantes',          description: 'Tableau détaillé par colonne avec niveaux et actions suggérées.' },
  { key: 'numericStats',     label: 'Statistiques numériques',     description: 'Min / P25 / Médiane / Moyenne / P75 / Max / Std + détection outliers.' },
  { key: 'targetAnalysis',   label: 'Variable cible',              description: 'Distribution des classes, déséquilibre et recommandations.' },
  { key: 'correlations',     label: 'Corrélations (Pearson)',      description: 'Top paires positives et négatives.', requiresCorrelation: true },
  { key: 'recommendations',  label: 'Recommandations prioritaires', description: 'Liste d\'actions triées par priorité (haute, moyenne, basse).' },
  { key: 'conclusion',       label: 'Conclusion',                  description: 'Bilan narratif sur la préparation du dataset pour l\'entraînement.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  reportInput: Omit<ReportInput, 'sections'>;
  correlationData?: CorrelationOut | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReportExportModal({ open, onClose, reportInput, correlationData }: Props) {
  const [sections, setSections] = useState<ReportSections>({ ...DEFAULT_SECTIONS });
  const [isGenerating, setIsGenerating] = useState(false);

  const toggle = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Small timeout to let the UI re-render the loading state before jsPDF blocks the thread
      await new Promise(r => setTimeout(r, 60));
      generateDatasetReport({ ...reportInput, correlationData, sections });
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedCount = Object.values(sections).filter(Boolean).length;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Exporter le rapport PDF"
      size="lg"
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Sélectionnez les sections à inclure dans le rapport généré.
        </p>

        {/* Section checklist */}
        <div className="space-y-2">
          {SECTIONS.map(({ key, label, description, requiresCorrelation }) => {
            const disabled = requiresCorrelation && !correlationData;
            const checked  = sections[key];
            return (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed border-border/40'
                    : checked
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => !disabled && toggle(key)}
                  className="mt-0.5 h-4 w-4 rounded accent-primary flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  {requiresCorrelation && !correlationData && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Calculez d'abord la matrice dans l'onglet Analyse.
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 text-xs text-muted-foreground">
          <button
            className="hover:text-primary transition-colors underline-offset-2 hover:underline"
            onClick={() => setSections({ ...DEFAULT_SECTIONS })}
          >
            Réinitialiser
          </button>
          <button
            className="hover:text-primary transition-colors underline-offset-2 hover:underline"
            onClick={() => setSections(Object.fromEntries(SECTIONS.map(s => [s.key, !s.requiresCorrelation || !!correlationData])) as ReportSections)}
          >
            Tout sélectionner
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            {selectedCount} section{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Annuler
            </Button>
            <Button
              onClick={() => void handleGenerate()}
              disabled={isGenerating || selectedCount === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Générer le PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
