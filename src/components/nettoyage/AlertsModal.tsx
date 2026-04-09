/**
 * AlertsModal.tsx
 *
 * Pure rendering layer — all alert logic lives in alertRules.ts.
 * Each alert type has one dedicated renderer component.
 */
import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from 'lucide-react';

import { Modal }   from '@/components/ui/modal';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';

import type { ColumnKind, CleaningAction } from '@/services/dataService';
import type { ColumnMeta }                 from '@/services/dataService';
import {
  buildAlerts,
  alertKey,
  countVisibleAlerts,
  type AlertItem,
  type AlertSeverity,
} from './alertRules';

// Re-export for the NettoyagePage badge counter
export { countVisibleAlerts };

// ── Icons & badges per severity ───────────────────────────────────────────────

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  error:   <XCircle       className="h-5 w-5 text-red-500"   />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  info:    <Info          className="h-5 w-5 text-blue-500"  />,
};

const SEVERITY_BADGE_CLASS: Record<AlertSeverity, string> = {
  error:   'border-red-500/30   bg-red-500/10   text-red-700   dark:text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  info:    'border-blue-500/30  bg-blue-500/10  text-blue-700  dark:text-blue-400',
};

// ── Shared action primitives ──────────────────────────────────────────────────

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-2">
      <XCircle className="h-4 w-4" />
      Ignorer
    </Button>
  );
}

interface DropButtonProps {
  column: string;
  disabled: boolean;
  onDismiss: () => void;
  onRunCleaning: ActionProps['onRunCleaning'];
}
function DropColumnButton({ column, disabled, onDismiss, onRunCleaning }: DropButtonProps) {
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={disabled}
      className="gap-2"
      onClick={() => {
        onRunCleaning('Suppression colonne', 'drop_columns' as CleaningAction, {}, [column]);
        onDismiss();
      }}
    >
      <Wrench className="h-4 w-4" />
      Supprimer cette colonne
    </Button>
  );
}

// ── Shared props type ─────────────────────────────────────────────────────────

interface ActionProps {
  alert: AlertItem;
  disableActions: boolean;
  kindOverrides: Record<string, ColumnKind>;
  onDismiss: () => void;
  onVerifyCategorical: (col: string, verified: boolean) => void;
  onSetOverride: (col: string, kind: ColumnKind) => void;
  onClearOverride: (col: string) => void;
  onRunCleaning: (description: string, action: CleaningAction, params?: Record<string, unknown>, columns?: string[]) => void;
}

// ── Per-type action sections ──────────────────────────────────────────────────

function ActionsDropOnly({ alert, disableActions, onDismiss, onRunCleaning }: ActionProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <DropColumnButton column={alert.column} disabled={disableActions} onDismiss={onDismiss} onRunCleaning={onRunCleaning} />
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function ActionsDismissOnly({ onDismiss }: Pick<ActionProps, 'onDismiss'>) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function ActionsHighCardinality({ alert, disableActions, kindOverrides, onDismiss, onSetOverride, onClearOverride, onRunCleaning }: ActionProps & { alert: Extract<AlertItem, { type: 'high_cardinality' }> }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button size="sm" variant="outline" className="gap-2" onClick={() => { onSetOverride(alert.column, 'id'); onDismiss(); }}>
        <Wrench className="h-4 w-4" />
        Marquer comme ID
      </Button>
      <DropColumnButton column={alert.column} disabled={disableActions} onDismiss={onDismiss} onRunCleaning={onRunCleaning} />
      {kindOverrides[alert.column] != null && (
        <Button size="sm" variant="ghost" onClick={() => onClearOverride(alert.column)}>
          Annuler override
        </Button>
      )}
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function ActionsVerifyCat({ alert, kindOverrides, onDismiss, onVerifyCategorical, onSetOverride, onClearOverride }: ActionProps & { alert: Extract<AlertItem, { type: 'verify_cat' }> }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button size="sm" variant="outline" className="gap-2" onClick={() => onVerifyCategorical(alert.column, true)}>
        <CheckCircle2 className="h-4 w-4" />
        Confirmer catégoriel
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => onSetOverride(alert.column, 'numeric')}>
        <Wrench className="h-4 w-4" />
        Rendre numérique
      </Button>
      {kindOverrides[alert.column] != null && (
        <Button size="sm" variant="ghost" onClick={() => onClearOverride(alert.column)}>
          Annuler override
        </Button>
      )}
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

// ── Alert card (title + description + actions) ────────────────────────────────

function alertContent(alert: AlertItem): { title: string; description: string } {
  switch (alert.type) {
    case 'all_missing':
      return {
        title: 'Colonne entièrement vide',
        description: `"${alert.column}" ne contient aucune valeur (100 % manquants). Elle n'apportera rien au modèle.`,
      };
    case 'constant_column':
      return {
        title: 'Colonne constante',
        description: `"${alert.column}" n'a qu'une seule valeur unique — variance nulle. Ce type de colonne nuit à l'entraînement.`,
      };
    case 'missing_high':
      return {
        title: 'Beaucoup de valeurs manquantes',
        description: `"${alert.column}" : ${(alert.missingPct * 100).toFixed(1)} % manquants. Suggestion : supprimer la colonne.`,
      };
    case 'missing_low':
      return {
        title: 'Valeurs manquantes modérées',
        description: `"${alert.column}" : ${(alert.missingPct * 100).toFixed(1)} % manquants. Suggestion : imputer (médiane / mode).`,
      };
    case 'verify_cat':
      return {
        title: 'Vérification du type',
        description: `"${alert.column}" est détectée catégorielle. Confirme le type ou convertis en numérique.`,
      };
    case 'high_cardinality':
      return {
        title: 'Cardinalité très élevée',
        description: `"${alert.column}" : ${alert.unique} valeurs uniques sur ${alert.nonMissing} lignes (${alert.pct} %). Probablement un identifiant ou du texte libre — à supprimer ou marquer comme ID.`,
      };
    case 'likely_id':
      return {
        title: 'Colonne identifiant détectée',
        description: `"${alert.column}" est identifiée comme un identifiant (ID). Les colonnes ID ne doivent pas être utilisées comme features.`,
      };
    case 'high_outliers':
      return {
        title: 'Beaucoup de valeurs aberrantes',
        description: `"${alert.column}" : ~${alert.pct} % de valeurs hors IQR×1,5. À traiter en étape de préparation (scaling robuste ou winsorisation).`,
      };
    case 'moderate_outliers':
      return {
        title: 'Quelques valeurs aberrantes',
        description: `"${alert.column}" : ~${alert.pct} % de valeurs aberrantes détectées (IQR×1,5). À surveiller en préparation.`,
      };
    case 'highly_skewed':
      return {
        title: 'Distribution très asymétrique',
        description: `"${alert.column}" : asymétrie de ${alert.skewness.toFixed(2)}. Envisage une transformation (log, Yeo-Johnson) dans l'étape de préparation.`,
      };
  }
}

function AlertActions(props: ActionProps) {
  const { alert } = props;
  switch (alert.type) {
    case 'all_missing':
    case 'constant_column':
    case 'likely_id':
    case 'missing_high':
      return <ActionsDropOnly {...props} />;
    case 'missing_low':
    case 'high_outliers':
    case 'moderate_outliers':
    case 'highly_skewed':
      return <ActionsDismissOnly onDismiss={props.onDismiss} />;
    case 'high_cardinality':
      return <ActionsHighCardinality {...props} alert={alert} />;
    case 'verify_cat':
      return <ActionsVerifyCat {...props} alert={alert} />;
  }
}

function AlertCard({ alert, ...props }: ActionProps) {
  const { title, description } = alertContent(alert);
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{SEVERITY_ICON[alert.severity]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <AlertActions {...props} alert={alert} />
        </div>
        <Badge variant="outline" className={`text-[10px] ${SEVERITY_BADGE_CLASS[alert.severity]}`}>
          {alert.severity}
        </Badge>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface AlertsModalProps {
  open: boolean;
  onClose: () => void;

  metaMap: Record<string, ColumnMeta>;
  verifiedCategorical: Set<string>;
  kindOverrides: Record<string, ColumnKind>;
  dismissedAlertKeys: Set<string>;

  disableActions: boolean;

  onDismissAlert: (key: string, dismissed?: boolean) => void;
  onVerifyCategorical: (col: string, verified: boolean) => void;
  onSetOverride: (col: string, kind: ColumnKind) => void;
  onClearOverride: (col: string) => void;
  onRunCleaning: (description: string, action: CleaningAction, params?: Record<string, unknown>, columns?: string[]) => void;
}

export function AlertsModal({
  open,
  onClose,
  metaMap,
  verifiedCategorical,
  kindOverrides,
  dismissedAlertKeys,
  disableActions,
  onDismissAlert,
  onVerifyCategorical,
  onSetOverride,
  onClearOverride,
  onRunCleaning,
}: AlertsModalProps) {
  const visibleAlerts = useMemo(
    () => buildAlerts(metaMap, verifiedCategorical, kindOverrides)
            .filter((a) => !dismissedAlertKeys.has(alertKey(a))),
    [metaMap, verifiedCategorical, kindOverrides, dismissedAlertKeys],
  );

  const errorCount   = visibleAlerts.filter((a) => a.severity === 'error').length;
  const warningCount = visibleAlerts.filter((a) => a.severity === 'warning').length;

  return (
    <Modal isOpen={open} onClose={onClose} title="Alertes & recommandations" size="xl">
      <div className="space-y-3">
        {visibleAlerts.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
            {errorCount > 0   && <Badge variant="outline" className={SEVERITY_BADGE_CLASS.error}>   {errorCount} erreur{errorCount   > 1 ? 's' : ''}</Badge>}
            {warningCount > 0 && <Badge variant="outline" className={SEVERITY_BADGE_CLASS.warning}>{warningCount} avertissement{warningCount > 1 ? 's' : ''}</Badge>}
          </div>
        )}

        {visibleAlerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Aucune alerte pour l'instant.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((alert) => {
              const key = alertKey(alert);
              return (
                <AlertCard
                  key={key}
                  alert={alert}
                  disableActions={disableActions}
                  kindOverrides={kindOverrides}
                  onDismiss={() => onDismissAlert(key, true)}
                  onVerifyCategorical={onVerifyCategorical}
                  onSetOverride={onSetOverride}
                  onClearOverride={onClearOverride}
                  onRunCleaning={onRunCleaning}
                />
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
