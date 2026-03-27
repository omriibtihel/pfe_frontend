import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { ColumnMeta, ColumnKind, CleaningAction } from '@/services/dataService';

// ── Constants ─────────────────────────────────────────────────────────────────

const MISSING_HIGH_THRESHOLD = 0.2;   // > 20% → suggest drop
const MISSING_LOW_THRESHOLD  = 0.05;  // 5–20% → suggest imputation

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertSeverity = 'warning' | 'info';

/**
 * Discriminated union on `type` replaces fragile key.startsWith() parsing.
 * Adding a new alert type = add a new member here + handle it in the renderer.
 */
type AlertItem =
  | { type: 'missing_high';  severity: 'warning'; column: string; missingPct: number }
  | { type: 'missing_low';   severity: 'info';    column: string; missingPct: number }
  | { type: 'verify_cat';    severity: 'info';    column: string };

// ── Alert builder ──────────────────────────────────────────────────────────────

function buildAlerts(
  metaMap: Record<string, ColumnMeta>,
  verifiedCategorical: Set<string>,
  kindOverrides: Record<string, ColumnKind>,
): AlertItem[] {
  const alerts: AlertItem[] = [];

  for (const [col, meta] of Object.entries(metaMap)) {
    const total = meta.total ?? 0;
    const missing = meta.missing ?? 0;
    if (total === 0) continue;

    const missingPct = missing / total;

    if (missingPct > MISSING_HIGH_THRESHOLD) {
      alerts.push({ type: 'missing_high', severity: 'warning', column: col, missingPct });
    } else if (missingPct > MISSING_LOW_THRESHOLD) {
      alerts.push({ type: 'missing_low', severity: 'info', column: col, missingPct });
    }

    const kind = String(meta.kind ?? 'other').toLowerCase().replace(/^bool(ean)?$/, 'binary');
    const alreadyHandled = verifiedCategorical.has(col) || kindOverrides[col] != null;
    if (kind === 'categorical' && !alreadyHandled) {
      alerts.push({ type: 'verify_cat', severity: 'info', column: col });
    }
  }

  return alerts;
}

/** Stable unique key per alert (used for dismiss tracking). */
function alertKey(a: AlertItem): string {
  switch (a.type) {
    case 'missing_high': return `missing_high:${a.column}`;
    case 'missing_low':  return `missing_low:${a.column}`;
    case 'verify_cat':   return `verify_cat:${a.column}`;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  info:    <Info          className="h-5 w-5 text-blue-500"  />,
};

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-2">
      <XCircle className="h-4 w-4" />
      Ignorer
    </Button>
  );
}

// ── Alert renderers (one per type) ────────────────────────────────────────────

interface AlertRendererProps {
  alert: AlertItem;
  disableActions: boolean;
  kindOverrides: Record<string, ColumnKind>;
  onDismiss: () => void;
  onVerifyCategorical: (col: string, verified: boolean) => void;
  onSetOverride: (col: string, kind: ColumnKind) => void;
  onClearOverride: (col: string) => void;
  onRunCleaning: (description: string, action: CleaningAction, params?: Record<string, unknown>, columns?: string[]) => void;
}

function MissingHighActions({ alert, disableActions, onDismiss, onRunCleaning }: AlertRendererProps & { alert: Extract<AlertItem, { type: 'missing_high' }> }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button
        size="sm"
        variant="destructive"
        disabled={disableActions}
        className="gap-2"
        onClick={() => {
          onRunCleaning(`Suppression colonne (missing>${Math.round(MISSING_HIGH_THRESHOLD * 100)}%)`, 'drop_columns' as CleaningAction, {}, [alert.column]);
          onDismiss();
        }}
      >
        <Wrench className="h-4 w-4" />
        Supprimer cette colonne
      </Button>
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function MissingLowActions({ onDismiss }: Pick<AlertRendererProps, 'onDismiss'>) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function VerifyCatActions({ alert, kindOverrides, onDismiss, onVerifyCategorical, onSetOverride, onClearOverride }: AlertRendererProps & { alert: Extract<AlertItem, { type: 'verify_cat' }> }) {
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

function AlertCard({ alert, ...props }: AlertRendererProps & { alert: AlertItem }) {
  const title = (() => {
    switch (alert.type) {
      case 'missing_high': return 'Beaucoup de valeurs manquantes';
      case 'missing_low':  return 'Valeurs manquantes modérées';
      case 'verify_cat':   return 'Vérification du type';
    }
  })();

  const description = (() => {
    switch (alert.type) {
      case 'missing_high':
        return `"${alert.column}" : ${(alert.missingPct * 100).toFixed(1)}% manquants. Suggestion : supprimer la colonne.`;
      case 'missing_low':
        return `"${alert.column}" : ${(alert.missingPct * 100).toFixed(1)}% manquants. Suggestion : imputer (median / mode).`;
      case 'verify_cat':
        return `"${alert.column}" est détectée catégorielle. Confirme le type ou convertis en numérique.`;
    }
  })();

  const actions = (() => {
    switch (alert.type) {
      case 'missing_high': return <MissingHighActions {...props} alert={alert} />;
      case 'missing_low':  return <MissingLowActions  onDismiss={props.onDismiss} />;
      case 'verify_cat':   return <VerifyCatActions   {...props} alert={alert} />;
    }
  })();

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{SEVERITY_ICON[alert.severity]}</span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {actions}
        </div>

        <Badge variant="outline" className="text-[10px]">{alert.severity}</Badge>
      </div>
    </div>
  );
}

// ── Public props & component ──────────────────────────────────────────────────

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

  return (
    <Modal isOpen={open} onClose={onClose} title="Alertes & recommandations" size="xl">
      <div className="space-y-3">
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

/**
 * Exported for use in NettoyagePage badge counter — avoids duplicating
 * the threshold logic in the parent component.
 */
export function countVisibleAlerts(
  metaMap: Record<string, ColumnMeta>,
  verifiedCategorical: Set<string>,
  kindOverrides: Record<string, ColumnKind>,
  dismissedAlertKeys: Set<string>,
): number {
  return buildAlerts(metaMap, verifiedCategorical, kindOverrides)
    .filter((a) => !dismissedAlertKeys.has(alertKey(a)))
    .length;
}
