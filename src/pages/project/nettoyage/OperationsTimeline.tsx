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

function opTypeLabel(t: string) {
  const k = (t ?? "").toLowerCase();
  if (k === "schema") return "Schéma";
  if (k === "cleaning") return "Nettoyage";
  if (k === "imputation") return "Imputation";
  if (k === "normalization") return "Normalisation";
  if (k === "encoding") return "Encodage";
  return t || "—";
}

function formatOpDate(iso: string): { short: string; full: string } {
  const d = new Date(iso);
  const full = d.toLocaleString("fr-FR");
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 0) return { short: full, full };
  if (sec < 60) return { short: "à l'instant", full };
  const min = Math.round(sec / 60);
  if (min < 60) return { short: `il y a ${min} min`, full };
  const hr = Math.round(min / 60);
  if (hr < 24) return { short: `il y a ${hr} h`, full };
  const day = Math.round(hr / 24);
  if (day < 7) return { short: `il y a ${day} j`, full };
  return { short: d.toLocaleDateString("fr-FR"), full };
}

function schemaActionLabel(action: string): string {
  switch (action) {
    case "set_kind": return "Type de colonne défini";
    case "clear_kind": return "Type de colonne réinitialisé";
    case "verify_categorical": return "Vérification catégorielle";
    case "dismiss_alert": return "Alerte ignorée";
    default: return action || "Action schéma";
  }
}

function humanizeKind(kind: string): string {
  const k = kind.toLowerCase();
  if (k === "numeric") return "numérique";
  if (k === "categorical") return "catégoriel";
  if (k === "datetime") return "date/heure";
  if (k === "binary") return "binaire";
  if (k === "text") return "texte";
  if (k === "id") return "identifiant";
  return kind;
}

/**
 * Réécrit les descriptions techniques du backend en libellés FR lisibles.
 * Ex: "Schema: restecg → numeric" → "Type de « restecg » défini sur numérique".
 */
function humanizeDescription(op: ProcessingOperation): string {
  const desc = (op.description ?? "").trim();
  const opType = (op.op_type ?? "").toLowerCase();
  const params = op.params ?? {};

  if (opType === "schema") {
    const action = String(params.schema_action ?? "");
    const column = params.column ? String(params.column) : null;

    if (action === "set_kind" && column && params.kind) {
      return `Type de « ${column} » défini sur ${humanizeKind(String(params.kind))}`;
    }
    if (action === "clear_kind" && column) {
      return `Type de « ${column} » réinitialisé (auto-détection)`;
    }
    if (action === "verify_categorical" && column) {
      return params.verified === false
        ? `Vérification catégorielle retirée pour « ${column} »`
        : `« ${column} » confirmé comme catégoriel`;
    }
    if (action === "dismiss_alert") {
      return params.dismissed === false ? "Alerte rétablie" : "Alerte ignorée";
    }

    const arrowMatch = desc.match(/^Schema\s*:\s*(.+?)\s*(?:→|->|-)+\s*(.+)$/i);
    if (arrowMatch) {
      return `Type de « ${arrowMatch[1].trim()} » défini sur ${humanizeKind(arrowMatch[2].trim())}`;
    }
  }

  return desc;
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
                const dt = formatOpDate(op.created_at);
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
                        <p className="text-sm font-medium truncate" title={op.description}>{humanizeDescription(op)}</p>
                        <Badge variant="outline" className={`shrink-0 text-[10px] ${opTypeBadge(op.op_type)}`}>{opTypeLabel(op.op_type)}</Badge>
                      </div>
                      {summaryChips.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">{summaryChips}</div>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        <span title={dt.full}>{dt.short}</span>
                        <span className="ml-2 text-primary/60">· cliquer pour détails</span>
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
          const isSchema = (selectedOp.op_type ?? "").toLowerCase() === "schema";
          const schemaAction = isSchema ? String(selectedOp.params?.schema_action ?? "") : "";
          return (
            <div className="max-h-[80vh] overflow-y-auto pr-1">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{opTypeLabel(selectedOp.op_type)}</Badge>
                  <Badge variant="outline">{new Date(selectedOp.created_at).toLocaleString("fr-FR")}</Badge>
                  {cols.length > 0 ? <Badge variant="outline">{cols.length} colonne(s)</Badge> : null}
                </div>
                <div>
                  <p className="text-sm font-medium" title={selectedOp.description}>{humanizeDescription(selectedOp)}</p>
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
                              {Object.entries(r.per_column).map(([c, info]) => (
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
                ) : isSchema ? (
                  <div className="rounded-md border border-border p-3 bg-muted/30 space-y-2">
                    <p className="text-sm font-medium">{schemaActionLabel(schemaAction)}</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {selectedOp.params?.column ? (
                        <div>Colonne : <span className="font-mono text-foreground">{String(selectedOp.params.column)}</span></div>
                      ) : null}
                      {schemaAction === "set_kind" && selectedOp.params?.kind ? (
                        <div>Nouveau type : <span className="font-medium text-foreground">{String(selectedOp.params.kind)}</span></div>
                      ) : null}
                      {schemaAction === "verify_categorical" ? (
                        <div>Statut : <span className="font-medium text-foreground">{selectedOp.params?.verified === false ? "Non vérifié" : "Vérifié"}</span></div>
                      ) : null}
                      {schemaAction === "dismiss_alert" ? (
                        <>
                          {selectedOp.params?.alert_key ? (
                            <div>Clé d'alerte : <span className="font-mono text-foreground">{String(selectedOp.params.alert_key)}</span></div>
                          ) : null}
                          <div>Statut : <span className="font-medium text-foreground">{selectedOp.params?.dismissed === false ? "Rétablie" : "Ignorée"}</span></div>
                        </>
                      ) : null}
                    </div>
                  </div>
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
