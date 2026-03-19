import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Wrench } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { ColumnMeta, ColumnKind, CleaningAction } from "@/services/dataService";

type AlertItem = {
  key: string;
  title: string;
  description: string;
  severity: "warning" | "info";
  column?: string;
};

function normalizeKind(kind?: string): string {
  const k = String(kind ?? "other").toLowerCase();
  if (k === "bool" || k === "boolean") return "binary";
  return k;
}

function buildAlerts(
  metaMap: Record<string, ColumnMeta>,
  verifiedCategorical: Set<string>,
  kindOverrides: Record<string, ColumnKind>
) {
  const alerts: AlertItem[] = [];

  for (const [col, meta] of Object.entries(metaMap)) {
    const total = meta.total ?? 0;
    const missing = meta.missing ?? 0;
    const missingRatio = total > 0 ? missing / total : 0;

    if (total > 0 && missingRatio > 0.2) {
      alerts.push({
        key: `missing>20:${col}`,
        title: `Beaucoup de valeurs manquantes`,
        description: `La colonne "${col}" a ${(missingRatio * 100).toFixed(
          1
        )}% de valeurs manquantes. Suggestion: supprimer.`,
        severity: "warning",
        column: col,
      });
    }

    const k = normalizeKind(meta.kind);
    if (k === "categorical" && !verifiedCategorical.has(col) && !kindOverrides[col]) {
      alerts.push({
        key: `verify_cat:${col}`,
        title: `Vérification du type`,
        description: `La colonne "${col}" est détectée "Cat". Confirme si c'est vraiment catégoriel ou si tu veux la rendre "Num".`,
        severity: "info",
        column: col,
      });
    }
  }

  return alerts;
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
}: {
  open: boolean;
  onClose: () => void;

  metaMap: Record<string, ColumnMeta>;
  verifiedCategorical: Set<string>;
  kindOverrides: Record<string, ColumnKind>;
  dismissedAlertKeys: Set<string>;

  disableActions: boolean;

  onDismissAlert: (key: string, dismissed?: boolean) => Promise<void> | void;
  onVerifyCategorical: (col: string, verified: boolean) => Promise<void> | void;
  onSetOverride: (col: string, kind: ColumnKind) => Promise<void> | void;
  onClearOverride: (col: string) => Promise<void> | void;

  onRunCleaning: (
    description: string,
    action: CleaningAction,
    params?: Record<string, any>,
    overrideColumns?: string[]
  ) => Promise<void> | void;
}) {
  const visibleAlerts = useMemo(() => {
    const all = buildAlerts(metaMap, verifiedCategorical, kindOverrides);
    return all.filter((a) => !dismissedAlertKeys.has(a.key));
  }, [metaMap, verifiedCategorical, kindOverrides, dismissedAlertKeys]);

  return (
    <Modal isOpen={open} onClose={onClose} title="Alertes & recommandations" size="xl">
      <div className="space-y-3">
        {visibleAlerts.length === 0 ? (
          <div className="rounded-md border border-border p-4 bg-muted/30 text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Aucune alerte pour l’instant.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((a) => (
              <div key={a.key} className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${a.severity === "warning" ? "text-amber-600" : "text-blue-600"}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {a.key.startsWith("missing>20:") && a.column ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              await onRunCleaning(`Suppression colonne (missing>20%)`, "drop_columns" as any, {}, [a.column!]);
                              await onDismissAlert(a.key, true);
                            }}
                            disabled={disableActions}
                            className="gap-2"
                          >
                            <Wrench className="h-4 w-4" />
                            Supprimer cette colonne
                          </Button>

                          <Button size="sm" variant="outline" onClick={() => onDismissAlert(a.key, true)} className="gap-2">
                            <XCircle className="h-4 w-4" />
                            Ignorer
                          </Button>
                        </>
                      ) : null}

                      {a.key.startsWith("verify_cat:") && a.column ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => onVerifyCategorical(a.column!, true)} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Confirmer catégoriel
                          </Button>

                          <Button size="sm" variant="outline" onClick={() => onSetOverride(a.column!, "numeric")} className="gap-2">
                            <Wrench className="h-4 w-4" />
                            Rendre numérique
                          </Button>

                          {kindOverrides[a.column!] ? (
                            <Button size="sm" variant="ghost" onClick={() => onClearOverride(a.column!)} className="gap-2">
                              Annuler override
                            </Button>
                          ) : null}

                          <Button size="sm" variant="ghost" onClick={() => onDismissAlert(a.key, true)} className="gap-2">
                            Ignorer
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px]">
                    {a.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
