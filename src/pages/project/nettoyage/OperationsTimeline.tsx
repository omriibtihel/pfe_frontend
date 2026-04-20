/**
 * OperationsTimeline — carte historique des opérations + modal de détails.
 */
import React from "react";
import { motion } from "framer-motion";
import { ChevronDown, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { buildOpSummaryChips } from "@/components/nettoyage/OpSummaryChips";

import type { ProcessingOperation } from "@/types";
import type { ColumnMeta } from "@/services/dataService";
import { normalizeKind, inferKindFallback, kindLabel, kindBadgeClass, getOpResult } from "./useNettoyageData";

// ── Local helpers ─────────────────────────────────────────────────────────────
function opTypeBadge(t: string) {
  const k = (t ?? "").toLowerCase();
  if (k === "schema") return "bg-secondary/10 border-secondary/20 text-secondary";
  if (k === "cleaning") return "bg-primary/10 border-primary/20 text-primary";
  return "bg-muted/30 border-border text-muted-foreground";
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface OperationsTimelineProps {
  operations: ProcessingOperation[];
  selectedOp: ProcessingOperation | null;
  onSelectOp: (op: ProcessingOperation | null) => void;
  columnMetaMap: Record<string, ColumnMeta>;
  dtypes: Record<string, string>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OperationsTimeline({ operations, selectedOp, onSelectOp, columnMetaMap, dtypes }: OperationsTimelineProps) {
  const renderColBadge = (c: string, variant: "outline" | "secondary" | "destructive" = "outline") => {
    const kind = normalizeKind(columnMetaMap?.[c]?.kind ?? inferKindFallback(c, dtypes?.[c]));
    return (
      <span key={c} className="inline-flex items-center gap-2">
        <Badge variant={variant} className="text-xs">{c}</Badge>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${kindBadgeClass(kind)}`}>{kindLabel(kind)}</Badge>
      </span>
    );
  };

  return (
    <>
      {/* ── History card ── */}
      <Card className="border-0 shadow-card">
        <CardHeader className="bg-gradient-to-r from-accent/5 to-transparent">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center">
              <Layers className="h-4 w-4 text-accent" />
            </div>
            Historique
            {operations.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">{operations.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {operations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
              <Layers className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Aucune opération</p>
            </div>
          ) : (
            <div className="space-y-2">
              {operations.map((op, i) => {
                const r = getOpResult(op);
                const summaryChips = buildOpSummaryChips(op);
                return (
                  <motion.button
                    key={op.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    type="button"
                    onClick={() => onSelectOp(op)}
                    className="w-full text-left p-3 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all duration-300 flex items-start gap-3 group/item"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium truncate">{op.description}</p>
                        <Badge variant="outline" className={`shrink-0 text-[10px] ${opTypeBadge(op.op_type)}`}>{op.op_type}</Badge>
                      </div>
                      {summaryChips.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">{summaryChips}</div>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {new Date(op.created_at).toLocaleString("fr-FR")}
                        {r ? <span className="ml-2 text-primary/60">· cliquer pour détails</span> : null}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 -rotate-90 group-hover/item:text-foreground transition-colors" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Op details modal ── */}
      <Modal isOpen={!!selectedOp} onClose={() => onSelectOp(null)} title="Détails de l'opération" size="xl">
        {selectedOp ? (() => {
          const r = getOpResult(selectedOp);
          const cols = (selectedOp.columns ?? []).filter(Boolean);
          return (
            <div className="max-h-[80vh] overflow-y-auto pr-1">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedOp.op_type}</Badge>
                  <Badge variant="outline">{new Date(selectedOp.created_at).toLocaleString("fr-FR")}</Badge>
                  {cols.length > 0 ? <Badge variant="outline">{cols.length} colonne(s)</Badge> : null}
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedOp.description}</p>
                  {cols.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cols.slice(0, 20).map((c) => renderColBadge(c, "outline"))}
                      {cols.length > 20 ? <span className="text-xs text-muted-foreground">+{cols.length - 20}…</span> : null}
                    </div>
                  )}
                </div>
                {r ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {r.before_shape?.rows != null && r.after_shape?.rows != null ? (
                        <Badge variant="outline">Lignes: {r.before_shape.rows} → {r.after_shape.rows}</Badge>
                      ) : null}
                      {r.before_shape?.cols != null && r.after_shape?.cols != null ? (
                        <Badge variant="outline">Colonnes: {r.before_shape.cols} → {r.after_shape.cols}</Badge>
                      ) : null}
                      {Array.isArray(r.columns_added) && r.columns_added.length ? <Badge variant="outline">+ {r.columns_added.length} colonnes</Badge> : null}
                      {Array.isArray(r.columns_removed) && r.columns_removed.length ? <Badge variant="outline">- {r.columns_removed.length} colonnes</Badge> : null}
                      {typeof r.rows_removed === "number" && r.rows_removed !== 0 ? <Badge variant="outline">{r.rows_removed} lignes supprimées</Badge> : null}
                    </div>
                    {r.per_column ? (
                      <div className="rounded-md border border-border overflow-hidden">
                        <div className="px-3 py-2 bg-muted/40">
                          <p className="text-sm font-medium">Impact par colonne</p>
                          <p className="text-xs text-muted-foreground">rempli = NaN comblés, modifié = valeurs changées</p>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="text-left py-2 pr-3">Colonne</th>
                                <th className="text-right py-2 px-3">Manquants (avant)</th>
                                <th className="text-right py-2 px-3">Manquants (après)</th>
                                <th className="text-right py-2 px-3">Remplis</th>
                                <th className="text-right py-2 pl-3">Modifiés</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(r.per_column).map(([c, info]: any) => (
                                <tr key={c} className="border-b border-border last:border-b-0">
                                  <td className="py-2 pr-3 font-medium">{c}</td>
                                  <td className="py-2 px-3 text-right">{info?.missing_before ?? "—"}</td>
                                  <td className="py-2 px-3 text-right">{info?.missing_after ?? "—"}</td>
                                  <td className="py-2 px-3 text-right">{info?.filled ?? "—"}</td>
                                  <td className="py-2 pl-3 text-right">{info?.changed_count ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-md border border-border p-3 bg-muted/30">
                    <p className="text-sm font-medium">Détails indisponibles</p>
                    <p className="text-xs text-muted-foreground mt-1">Cette opération ne fournit pas encore de résumé détaillé.</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <Button variant="outline" onClick={() => onSelectOp(null)}>Fermer</Button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </Modal>
    </>
  );
}
