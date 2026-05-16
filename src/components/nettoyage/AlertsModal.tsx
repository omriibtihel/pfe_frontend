/**
 * AlertsModal.tsx
 *
 * Pure rendering layer — all alert logic lives in alertRules.ts.
 * Each alert type has one dedicated renderer component.
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertTriangle, CheckCircle2, Info, LayoutList, Wrench, XCircle } from 'lucide-react';

import { Modal }   from '@/components/ui/modal';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import type { ColumnKind, CleaningAction } from '@/services/dataService';
import type { ColumnMeta }                 from '@/services/dataService';
import { ParasiteValueBadges }             from '@/components/shared/ParasiteValueBadges';
import {
  buildAlerts,
  alertKey,
  countVisibleAlerts,
  type AlertItem,
  type AlertSeverity,
  type AlertThresholds,
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
  const { t } = useTranslation();
  return (
    <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-2">
      <XCircle className="h-4 w-4" />
      {t('nettoyage.alertsModal.ignore')}
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
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={disabled}
      className="gap-2"
      onClick={() => {
        onRunCleaning(t('nettoyage.cleaning.opDropFromAlert'), 'drop_columns' as CleaningAction, {}, [column]);
        onDismiss();
      }}
    >
      <Wrench className="h-4 w-4" />
      {t('nettoyage.alertsModal.dropColumn')}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button size="sm" variant="outline" className="gap-2" onClick={() => { onSetOverride(alert.column, 'id'); onDismiss(); }}>
        <Wrench className="h-4 w-4" />
        {t('nettoyage.alertsModal.markAsId')}
      </Button>
      <DropColumnButton column={alert.column} disabled={disableActions} onDismiss={onDismiss} onRunCleaning={onRunCleaning} />
      {kindOverrides[alert.column] != null && (
        <Button size="sm" variant="ghost" onClick={() => onClearOverride(alert.column)}>
          {t('nettoyage.alertsModal.cancelOverride')}
        </Button>
      )}
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function ActionsVerifyCat({ alert, kindOverrides, onDismiss, onVerifyCategorical, onSetOverride, onClearOverride }: ActionProps & { alert: Extract<AlertItem, { type: 'verify_cat' }> }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button size="sm" variant="outline" className="gap-2" onClick={() => onVerifyCategorical(alert.column, true)}>
        <CheckCircle2 className="h-4 w-4" />
        {t('nettoyage.alertsModal.confirmCat')}
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => onSetOverride(alert.column, 'numeric')}>
        <Wrench className="h-4 w-4" />
        {t('nettoyage.alertsModal.makeNumeric')}
      </Button>
      {kindOverrides[alert.column] != null && (
        <Button size="sm" variant="ghost" onClick={() => onClearOverride(alert.column)}>
          {t('nettoyage.alertsModal.cancelOverride')}
        </Button>
      )}
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

// ── Alert card (title + description + actions) ────────────────────────────────

function alertContent(alert: AlertItem, t: TFunction): { title: string; description: string } {
  switch (alert.type) {
    case 'all_missing':
      return {
        title: t('nettoyage.alertsModal.allMissingTitle'),
        description: t('nettoyage.alertsModal.allMissingDesc', { col: alert.column }),
      };
    case 'constant_column':
      return {
        title: t('nettoyage.alertsModal.constantTitle'),
        description: t('nettoyage.alertsModal.constantDesc', { col: alert.column }),
      };
    case 'missing_high':
      return {
        title: t('nettoyage.alertsModal.missingHighTitle'),
        description: t('nettoyage.alertsModal.missingHighDesc', { col: alert.column, pct: (alert.missingPct * 100).toFixed(1) }),
      };
    case 'missing_low':
      return {
        title: t('nettoyage.alertsModal.missingLowTitle'),
        description: t('nettoyage.alertsModal.missingLowDesc', { col: alert.column, pct: (alert.missingPct * 100).toFixed(1) }),
      };
    case 'verify_cat':
      return {
        title: t('nettoyage.alertsModal.verifyCatTitle'),
        description: t('nettoyage.alertsModal.verifyCatDesc', { col: alert.column }),
      };
    case 'high_cardinality':
      return {
        title: t('nettoyage.alertsModal.highCardTitle'),
        description: t('nettoyage.alertsModal.highCardDesc', { col: alert.column, unique: alert.unique, nonMissing: alert.nonMissing, pct: alert.pct }),
      };
    case 'likely_id':
      return {
        title: t('nettoyage.alertsModal.likelyIdTitle'),
        description: t('nettoyage.alertsModal.likelyIdDesc', { col: alert.column }),
      };
    case 'high_outliers':
      return {
        title: t('nettoyage.alertsModal.highOutliersTitle'),
        description: t('nettoyage.alertsModal.highOutliersDesc', { col: alert.column, pct: alert.pct }),
      };
    case 'moderate_outliers':
      return {
        title: t('nettoyage.alertsModal.moderateOutliersTitle'),
        description: t('nettoyage.alertsModal.moderateOutliersDesc', { col: alert.column, pct: alert.pct }),
      };
    case 'highly_skewed':
      return {
        title: t('nettoyage.alertsModal.skewedTitle'),
        description: t('nettoyage.alertsModal.skewedDesc', { col: alert.column, skew: alert.skewness.toFixed(2) }),
      };
    case 'parasite_values':
      return {
        title: t('nettoyage.alertsModal.parasiteTitle'),
        description: alert.count > 1
          ? t('nettoyage.alertsModal.parasiteDescOther', { col: alert.column, count: alert.count })
          : t('nettoyage.alertsModal.parasiteDescOne', { col: alert.column, count: alert.count }),
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
    case 'parasite_values':
      return <ActionsDismissOnly onDismiss={props.onDismiss} />;
    case 'high_cardinality':
      return <ActionsHighCardinality {...props} alert={alert} />;
    case 'verify_cat':
      return <ActionsVerifyCat {...props} alert={alert} />;
  }
}

function AlertCard({ alert, ...props }: ActionProps) {
  const { t } = useTranslation();
  const { title, description } = alertContent(alert, t);
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{SEVERITY_ICON[alert.severity]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {alert.type === 'parasite_values' && (
            <div className="mt-2">
              <ParasiteValueBadges
                count={alert.count}
                distinct={alert.distinct}
                convertible_ratio={alert.convertible_ratio}
              />
            </div>
          )}
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
  thresholds?: Partial<AlertThresholds>;

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
  thresholds,
  disableActions,
  onDismissAlert,
  onVerifyCategorical,
  onSetOverride,
  onClearOverride,
  onRunCleaning,
}: AlertsModalProps) {
  const { t } = useTranslation();
  const visibleAlerts = useMemo(
    () => buildAlerts(metaMap, verifiedCategorical, kindOverrides, thresholds)
            .filter((a) => !dismissedAlertKeys.has(alertKey(a))),
    [metaMap, verifiedCategorical, kindOverrides, dismissedAlertKeys, thresholds],
  );

  const grouped = useMemo(() => ({
    error:   visibleAlerts.filter((a) => a.severity === 'error'),
    warning: visibleAlerts.filter((a) => a.severity === 'warning'),
    info:    visibleAlerts.filter((a) => a.severity === 'info'),
  }), [visibleAlerts]);

  const renderAlert = (alert: AlertItem) => {
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
  };

  const renderList = (items: AlertItem[], emptyLabel: string) =>
    items.length === 0 ? (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" />
        {emptyLabel}
      </div>
    ) : (
      <div className="space-y-2">{items.map(renderAlert)}</div>
    );

  return (
    <Modal isOpen={open} onClose={onClose} title={t('nettoyage.alertsModal.title')} size="xl">
      <div className="space-y-3">
        {visibleAlerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            {t('nettoyage.alertsModal.none')}
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto gap-1 p-1">
              <TabsTrigger value="all" className="gap-1.5 px-2 py-1.5 min-w-0">
                <LayoutList className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">{t('nettoyage.alertsModal.tabAll')}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{visibleAlerts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="error" className="gap-1.5 px-2 py-1.5 min-w-0" disabled={grouped.error.length === 0}>
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="hidden sm:inline truncate">{t('nettoyage.alertsModal.tabErrors')}</span>
                {grouped.error.length > 0 && (
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${SEVERITY_BADGE_CLASS.error}`}>{grouped.error.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="warning" className="gap-1.5 px-2 py-1.5 min-w-0" disabled={grouped.warning.length === 0}>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline truncate">{t('nettoyage.alertsModal.tabWarnings')}</span>
                {grouped.warning.length > 0 && (
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${SEVERITY_BADGE_CLASS.warning}`}>{grouped.warning.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="info" className="gap-1.5 px-2 py-1.5 min-w-0" disabled={grouped.info.length === 0}>
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="hidden sm:inline truncate">{t('nettoyage.alertsModal.tabInfo')}</span>
                {grouped.info.length > 0 && (
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${SEVERITY_BADGE_CLASS.info}`}>{grouped.info.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">{renderList(visibleAlerts, t('nettoyage.alertsModal.emptyAll'))}</TabsContent>
            <TabsContent value="error">{renderList(grouped.error, t('nettoyage.alertsModal.emptyErrors'))}</TabsContent>
            <TabsContent value="warning">{renderList(grouped.warning, t('nettoyage.alertsModal.emptyWarnings'))}</TabsContent>
            <TabsContent value="info">{renderList(grouped.info, t('nettoyage.alertsModal.emptyInfo'))}</TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>{t('nettoyage.alertsModal.close')}</Button>
        </div>
      </div>
    </Modal>
  );
}
