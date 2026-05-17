/**
 * OperationsTimeline — historique des opérations + modal de détails.
 *
 * Affiche deux sections distinctes :
 *  - "Pipeline de transformations" : les ops `cleaning` qui modifient réellement
 *    les données. Numérotées dans l'ordre de rejouage (croissant).
 *  - "Décisions de schéma" : les ops `schema` (métadonnées qui n'altèrent pas
 *    les données). Dédupliquées par (action, colonne|alert_key) en ne gardant
 *    que la décision la plus récente, et masquées si elles équivalent au
 *    défaut (verify=false, dismissed=false).
 */
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronDown, Layers, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function useOpTypeLabel() {
  const { t } = useTranslation();
  return (type: string) => {
    const k = (type ?? "").toLowerCase();
    if (k === "schema") return t("nettoyage.timeline.opTypeSchema");
    if (k === "cleaning") return t("nettoyage.timeline.opTypeCleaning");
    if (k === "imputation") return t("nettoyage.timeline.opTypeImputation");
    if (k === "normalization") return t("nettoyage.timeline.opTypeNormalization");
    if (k === "encoding") return t("nettoyage.timeline.opTypeEncoding");
    return type || "—";
  };
}

function useFormatOpDate() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("fr") ? "fr-FR" : "en-US";
  return (iso: string): { short: string; full: string } => {
    const d = new Date(iso);
    const full = d.toLocaleString(locale);
    const diffMs = Date.now() - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 0) return { short: full, full };
    if (sec < 60) return { short: t("nettoyage.timeline.now"), full };
    const min = Math.floor(sec / 60);
    if (min < 60) return { short: t("nettoyage.timeline.minAgo", { n: min }), full };
    const hr = Math.floor(min / 60);
    if (hr < 24) return { short: t("nettoyage.timeline.hAgo", { n: hr }), full };
    const day = Math.floor(hr / 24);
    if (day < 7) return { short: t("nettoyage.timeline.dAgo", { n: day }), full };
    return { short: d.toLocaleDateString(locale), full };
  };
}

function useSchemaActionLabel() {
  const { t } = useTranslation();
  return (action: string): string => {
    switch (action) {
      case "set_kind": return t("nettoyage.timeline.schemaSetKind");
      case "clear_kind": return t("nettoyage.timeline.schemaClearKind");
      case "verify_categorical": return t("nettoyage.timeline.schemaVerifyCat");
      case "dismiss_alert": return t("nettoyage.timeline.schemaDismissAlert");
      default: return action || t("nettoyage.timeline.schemaAction");
    }
  };
}

function useHumanizeKind() {
  const { t } = useTranslation();
  return (kind: string): string => {
    const k = kind.toLowerCase();
    if (k === "numeric") return t("nettoyage.timeline.kindNumeric");
    if (k === "categorical") return t("nettoyage.timeline.kindCategorical");
    if (k === "datetime") return t("nettoyage.timeline.kindDatetime");
    if (k === "binary") return t("nettoyage.timeline.kindBinary");
    if (k === "text") return t("nettoyage.timeline.kindText");
    if (k === "id") return t("nettoyage.timeline.kindId");
    return kind;
  };
}

// ── Cleaning humanization helpers ─────────────────────────────────────────────

const CH_PREFIX = "nettoyage.timeline.cleaningHumanize";

type TFn = ReturnType<typeof useTranslation>["t"];

/** Liste lisible « a, b, c (+N autres) » avec quotes monospace logiques. */
function formatColList(t: TFn, cols: string[], max = 3): string {
  if (cols.length === 0) return "";
  const head = cols.slice(0, max).map((c) => `« ${c} »`).join(", ");
  if (cols.length <= max) return head;
  return head + t(`${CH_PREFIX}.moreSuffix`, { n: cols.length - max });
}

/** Liste « « old » → « new » » avec overflow. */
function formatRenameMapping(t: TFn, mapping: Record<string, unknown>, max = 2): string {
  const entries = Object.entries(mapping);
  if (entries.length === 0) return "";
  const head = entries.slice(0, max).map(([k, v]) => `« ${k} » → « ${String(v)} »`).join(", ");
  if (entries.length <= max) return head;
  return head + t(`${CH_PREFIX}.moreSuffix`, { n: entries.length - max });
}

/** Représentation lisible d'une valeur (null / "" → (vide), sinon "X"). */
function formatValue(t: TFn, raw: unknown, treatAsNull?: boolean): string {
  if (treatAsNull || raw === null || raw === undefined || raw === "") {
    return t(`${CH_PREFIX}.nullOrEmpty`);
  }
  return `"${String(raw)}"`;
}

/** Somme des `changed_count` par colonne dans le résultat de l'op. */
function totalCellsChanged(result: ReturnType<typeof getOpResult>): number | null {
  if (!result?.per_column) return null;
  let total = 0;
  for (const info of Object.values(result.per_column)) {
    total += (info?.changed_count ?? 0) as number;
  }
  return total;
}

/** Nombre de lignes supprimées, soit explicite, soit dérivé du delta de forme. */
function rowsRemovedFrom(result: ReturnType<typeof getOpResult>): number | null {
  if (!result) return null;
  if (typeof result.rows_removed === "number") return result.rows_removed;
  const br = result.before_shape?.rows;
  const ar = result.after_shape?.rows;
  if (br != null && ar != null) return br - ar;
  return null;
}

/**
 * Produit un libellé i18n riche et compréhensible pour une op de nettoyage,
 * à partir de `params.action`, des colonnes ciblées, et du résultat réel
 * (nombre de lignes/cellules effectivement modifiées). Toujours dérivé à
 * l'affichage — indépendant de la langue active au moment de la création.
 */
function useHumanizeCleaningAction() {
  const { t } = useTranslation();

  return (op: ProcessingOperation): string | null => {
    const params = (op.params ?? {}) as Record<string, unknown>;
    const action = String(params.action ?? "");
    const cols = ((op.columns ?? []) as unknown[]).map(String).filter(Boolean);
    const r = getOpResult(op);

    switch (action) {
      case "drop_columns": {
        if (cols.length === 0) return t(`${CH_PREFIX}.dropColumns`, { count: 0, cols: "—" });
        return t(`${CH_PREFIX}.dropColumns`, { count: cols.length, cols: formatColList(t, cols) });
      }

      case "drop_duplicates": {
        const removed = rowsRemovedFrom(r);
        const onSubset = cols.length > 0;
        const subsetCols = onSubset ? formatColList(t, cols, 3) : "";

        if (removed == null) {
          return onSubset
            ? t(`${CH_PREFIX}.dropDuplicatesSubsetNoResult`, { cols: subsetCols })
            : t(`${CH_PREFIX}.dropDuplicatesAllNoResult`);
        }
        if (removed === 0) {
          return onSubset
            ? t(`${CH_PREFIX}.dropDuplicatesSubsetNone`, { cols: subsetCols })
            : t(`${CH_PREFIX}.dropDuplicatesAllNone`);
        }
        return onSubset
          ? t(`${CH_PREFIX}.dropDuplicatesSubset`, { count: removed, n: removed, cols: subsetCols })
          : t(`${CH_PREFIX}.dropDuplicatesAll`, { count: removed, n: removed });
      }

      case "drop_empty_rows": {
        const removed = rowsRemovedFrom(r);
        const onSubset = cols.length > 0;
        const subsetCols = onSubset ? formatColList(t, cols, 3) : "";

        if (removed == null) {
          return onSubset
            ? t(`${CH_PREFIX}.dropEmptyRowsSubsetNoResult`, { cols: subsetCols })
            : t(`${CH_PREFIX}.dropEmptyRowsNoResult`);
        }
        if (removed === 0) {
          return onSubset
            ? t(`${CH_PREFIX}.dropEmptyRowsSubsetNone`, { cols: subsetCols })
            : t(`${CH_PREFIX}.dropEmptyRowsNone`);
        }
        return onSubset
          ? t(`${CH_PREFIX}.dropEmptyRowsSubset`, { count: removed, n: removed, cols: subsetCols })
          : t(`${CH_PREFIX}.dropEmptyRows`, { count: removed, n: removed });
      }

      case "drop_empty_cols": {
        // Si l'utilisateur a fourni une sélection, c'est borné à cette sélection.
        if (cols.length > 0) return t(`${CH_PREFIX}.dropEmptyColsSubset`);

        const removedNames = (r?.columns_removed ?? []) as string[];
        if (r == null) return t(`${CH_PREFIX}.dropEmptyColsNoResult`);
        if (removedNames.length === 0) return t(`${CH_PREFIX}.dropEmptyColsNone`);
        return t(`${CH_PREFIX}.dropEmptyCols`, {
          count: removedNames.length,
          cols: formatColList(t, removedNames),
        });
      }

      case "rename_columns": {
        // Le mapping effectivement appliqué (résultat) prime sur les params bruts.
        const applied = (r as { applied_rename?: Record<string, unknown> } | null)?.applied_rename;
        const fromParams = (params.mapping ?? {}) as Record<string, unknown>;
        const mapping = applied && Object.keys(applied).length > 0 ? applied : fromParams;
        const n = Object.keys(mapping).length;
        if (n === 0) return t(`${CH_PREFIX}.renameEmpty`);
        return t(`${CH_PREFIX}.rename`, { count: n, mapping: formatRenameMapping(t, mapping) });
      }

      case "strip_whitespace": {
        const changed = totalCellsChanged(r);
        const onSelection = cols.length > 0;
        const selectionCols = onSelection ? formatColList(t, cols, 3) : "";

        if (changed == null) {
          return onSelection
            ? t(`${CH_PREFIX}.stripWhitespaceSelectionNoResult`, { cols: selectionCols })
            : t(`${CH_PREFIX}.stripWhitespaceAutoNoResult`);
        }
        if (changed === 0) {
          return onSelection
            ? t(`${CH_PREFIX}.stripWhitespaceSelectionNone`, { cols: selectionCols })
            : t(`${CH_PREFIX}.stripWhitespaceAutoNone`);
        }
        return onSelection
          ? t(`${CH_PREFIX}.stripWhitespaceSelection`, { count: changed, n: changed, cols: selectionCols })
          : t(`${CH_PREFIX}.stripWhitespaceAuto`, { count: changed, n: changed });
      }

      case "substitute_values": {
        const col = String(params.column ?? cols[0] ?? "—");
        const fromStr = formatValue(t, params.from_value, params.treat_from_as_null === true);
        const toStr = formatValue(t, params.to_value, params.treat_to_as_null === true);
        const changed = totalCellsChanged(r);

        if (changed == null) {
          return t(`${CH_PREFIX}.substituteValuesNoResult`, { col, from: fromStr, to: toStr });
        }
        if (changed === 0) {
          return t(`${CH_PREFIX}.substituteValuesNone`, { col, from: fromStr });
        }
        return t(`${CH_PREFIX}.substituteValues`, { col, from: fromStr, to: toStr, count: changed, n: changed });
      }

      default:
        return null;
    }
  };
}

function useHumanizeDescription() {
  const { t } = useTranslation();
  const humanizeKind = useHumanizeKind();
  const humanizeCleaning = useHumanizeCleaningAction();
  return (op: ProcessingOperation): string => {
    const desc = (op.description ?? "").trim();
    const opType = (op.op_type ?? "").toLowerCase();
    const params = op.params ?? {};

    if (opType === "schema") {
      const action = String(params.schema_action ?? "");
      const column = params.column ? String(params.column) : null;

      if (action === "set_kind" && column && params.kind) {
        return t("nettoyage.timeline.humanizeSet", { col: column, kind: humanizeKind(String(params.kind)) });
      }
      if (action === "clear_kind" && column) {
        return t("nettoyage.timeline.humanizeClear", { col: column });
      }
      if (action === "verify_categorical" && column) {
        return params.verified === false
          ? t("nettoyage.timeline.humanizeVerifyOff", { col: column })
          : t("nettoyage.timeline.humanizeVerifyOn", { col: column });
      }
      if (action === "dismiss_alert") {
        const key = params.alert_key ? String(params.alert_key) : "";
        const dismissed = params.dismissed !== false;
        if (key) {
          return dismissed
            ? t("nettoyage.timeline.humanizeDismissOn", { key })
            : t("nettoyage.timeline.humanizeDismissOff", { key });
        }
        return dismissed
          ? t("nettoyage.timeline.humanizeDismissOnGeneric")
          : t("nettoyage.timeline.humanizeDismissOffGeneric");
      }

      const arrowMatch = desc.match(/^Schema\s*:\s*(.+?)\s*(?:→|->|-)+\s*(.+)$/i);
      if (arrowMatch) {
        return t("nettoyage.timeline.humanizeSet", { col: arrowMatch[1].trim(), kind: humanizeKind(arrowMatch[2].trim()) });
      }
    }

    if (opType === "cleaning") {
      // Always re-derive a localized label from `params.action` — the stored
      // `op.description` was frozen in the language active at creation time
      // and would not follow runtime language switches.
      const humanized = humanizeCleaning(op);
      if (humanized) return humanized;
    }

    return desc;
  };
}

/**
 * Sépare les ops par catégorie et dédoublonne les décisions de schéma :
 *  - cleaning : conservées telles quelles, ordre chronologique croissant (rejouage).
 *  - schema : on garde la décision la plus récente par (action, cible) et on
 *    masque celles qui équivalent au défaut (verify=false, dismissed=false).
 *
 * Hypothèse d'entrée : `ops` arrive trié `created_at` ascendant (cf. backend).
 */
function partitionOperations(ops: ProcessingOperation[]) {
  const cleaning: ProcessingOperation[] = [];
  const schemaLatest = new Map<string, ProcessingOperation>();

  for (const op of ops) {
    const type = (op.op_type ?? "").toLowerCase();
    if (type === "cleaning") {
      cleaning.push(op);
      continue;
    }
    if (type !== "schema") continue;

    const p = (op.params ?? {}) as Record<string, unknown>;
    const action = String(p.schema_action ?? "");
    const target = action === "dismiss_alert"
      ? String(p.alert_key ?? "")
      : String(p.column ?? "");
    schemaLatest.set(`${action}::${target}`, op);
  }

  const schema = Array.from(schemaLatest.values()).filter((op) => {
    const p = (op.params ?? {}) as Record<string, unknown>;
    const action = String(p.schema_action ?? "");
    if (action === "verify_categorical" && p.verified === false) return false;
    if (action === "dismiss_alert" && p.dismissed === false) return false;
    return true;
  });

  // Décisions de schéma : plus récentes d'abord (lecture "état courant").
  schema.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return { cleaning, schema };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface OperationsTimelineProps {
  operations: ProcessingOperation[];
  selectedOp: ProcessingOperation | null;
  onSelectOp: (op: ProcessingOperation | null) => void;
  columnMetaMap: Record<string, ColumnMeta>;
  dtypes: Record<string, string>;
}

// ── Sub-component: liste d'opérations (sans Card wrapper) ─────────────────────
interface OpListProps {
  ops: ProcessingOperation[];
  numbered: boolean;
  emptyLabel: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  onSelectOp: (op: ProcessingOperation | null) => void;
}

function OpList({ ops, numbered, emptyLabel, emptyHint, emptyIcon, onSelectOp }: OpListProps) {
  const { t } = useTranslation();
  const formatOpDate = useFormatOpDate();
  const opTypeLabel = useOpTypeLabel();
  const humanizeDescription = useHumanizeDescription();

  if (ops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
        <div className="mb-3 opacity-40">{emptyIcon ?? <Layers className="h-10 w-10" />}</div>
        <p className="text-sm font-medium">{emptyLabel}</p>
        {emptyHint ? <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-xs text-center">{emptyHint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ops.map((op, i) => {
        const summaryChips = buildOpSummaryChips(op, t);
        const dt = formatOpDate(op.created_at);
        return (
          <motion.button
            key={op.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.03 }}
            type="button"
            onClick={() => onSelectOp(op)}
            className="w-full text-left p-3 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all duration-300 flex items-start gap-3 group/item"
          >
            {numbered ? (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {i + 1}
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
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
                <span className="ml-2 text-primary/60">· {t("nettoyage.timeline.clickForDetails")}</span>
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 -rotate-90 group-hover/item:text-foreground transition-colors" />
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OperationsTimeline({ operations, selectedOp, onSelectOp, columnMetaMap, dtypes }: OperationsTimelineProps) {
  const { t, i18n } = useTranslation();
  const opTypeLabel = useOpTypeLabel();
  const schemaActionLabel = useSchemaActionLabel();
  const humanizeDescription = useHumanizeDescription();
  const locale = i18n.language?.startsWith("fr") ? "fr-FR" : "en-US";

  const { cleaning, schema } = useMemo(() => partitionOperations(operations), [operations]);

  const renderColBadge = (c: string, variant: "outline" | "secondary" | "destructive" = "outline") => {
    const kind = normalizeKind(columnMetaMap?.[c]?.kind ?? inferKindFallback(c, dtypes?.[c]));
    return (
      <span key={c} className="inline-flex items-center gap-2">
        <Badge variant={variant} className="text-xs">{c}</Badge>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${kindBadgeClass(kind)}`}>{kindLabel(kind)}</Badge>
      </span>
    );
  };

  // Onglet par défaut = celui qui a du contenu (priorité au pipeline).
  // Bascule auto vers "schema" si seul ce dernier a des entrées.
  const initialTab = cleaning.length === 0 && schema.length > 0 ? "schema" : "pipeline";
  const [tab, setTab] = useState<"pipeline" | "schema">(initialTab);

  return (
    <>
      <Card className="border-0 shadow-card overflow-hidden">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "pipeline" | "schema")}>
          <CardHeader className="bg-gradient-to-r from-accent/5 to-transparent pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                {t("nettoyage.timeline.historyTitle")}
              </CardTitle>

              <TabsList className="h-9">
                <TabsTrigger value="pipeline" className="gap-2 text-xs">
                  <Layers className="h-3.5 w-3.5" />
                  {t("nettoyage.timeline.pipelineTitle")}
                  {cleaning.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
                      {cleaning.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="schema" className="gap-2 text-xs">
                  <Tag className="h-3.5 w-3.5" />
                  {t("nettoyage.timeline.schemaDecisionsTitle")}
                  {schema.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
                      {schema.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Sous-titre contextuel — change avec l'onglet pour rappeler la sémantique */}
            <p className="text-xs text-muted-foreground mt-1">
              {tab === "pipeline"
                ? t("nettoyage.timeline.pipelineHint")
                : t("nettoyage.timeline.schemaDecisionsHint")}
            </p>
          </CardHeader>

          <CardContent className="pt-4">
            <TabsContent value="pipeline" className="mt-0">
              <OpList
                ops={cleaning}
                numbered
                emptyLabel={t("nettoyage.timeline.pipelineEmpty")}
                emptyHint={t("nettoyage.timeline.pipelineEmptyHint")}
                emptyIcon={<Layers className="h-10 w-10" />}
                onSelectOp={onSelectOp}
              />
            </TabsContent>
            <TabsContent value="schema" className="mt-0">
              <OpList
                ops={schema}
                numbered={false}
                emptyLabel={t("nettoyage.timeline.schemaDecisionsEmpty")}
                emptyHint={t("nettoyage.timeline.schemaDecisionsEmptyHint")}
                emptyIcon={<Tag className="h-10 w-10" />}
                onSelectOp={onSelectOp}
              />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* ── Op details modal ── */}
      <Modal isOpen={!!selectedOp} onClose={() => onSelectOp(null)} title={t("nettoyage.timeline.detailsTitle")} size="xl">
        {selectedOp ? (() => {
          const r = getOpResult(selectedOp);
          const cols = (selectedOp.columns ?? []).filter(Boolean);
          const isSchema = (selectedOp.op_type ?? "").toLowerCase() === "schema";
          const schemaAction = isSchema ? String(selectedOp.params?.schema_action ?? "") : "";
          // Si la delta lignes (avant→après) est dispo, elle exprime déjà le nombre
          // de lignes supprimées — on évite la double affichage.
          const hasRowsDelta = r?.before_shape?.rows != null && r?.after_shape?.rows != null;
          return (
            <div className="max-h-[80vh] overflow-y-auto pr-1">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{opTypeLabel(selectedOp.op_type)}</Badge>
                  <Badge variant="outline">{new Date(selectedOp.created_at).toLocaleString(locale)}</Badge>
                  {cols.length > 0 ? <Badge variant="outline">{t("nettoyage.timeline.colsCount", { n: cols.length })}</Badge> : null}
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
                      {hasRowsDelta ? (
                        <Badge variant="outline">{t("nettoyage.timeline.rowsDelta", { before: r.before_shape!.rows, after: r.after_shape!.rows })}</Badge>
                      ) : null}
                      {r.before_shape?.cols != null && r.after_shape?.cols != null ? (
                        <Badge variant="outline">{t("nettoyage.timeline.colsDelta", { before: r.before_shape.cols, after: r.after_shape.cols })}</Badge>
                      ) : null}
                      {Array.isArray(r.columns_added) && r.columns_added.length ? <Badge variant="outline">{t("nettoyage.timeline.colsAdded", { n: r.columns_added.length })}</Badge> : null}
                      {Array.isArray(r.columns_removed) && r.columns_removed.length ? <Badge variant="outline">{t("nettoyage.timeline.colsRemoved", { n: r.columns_removed.length })}</Badge> : null}
                      {!hasRowsDelta && typeof r.rows_removed === "number" && r.rows_removed !== 0 ? (
                        <Badge variant="outline">{t("nettoyage.timeline.rowsRemoved", { n: r.rows_removed })}</Badge>
                      ) : null}
                    </div>
                    {r.per_column ? (
                      <div className="rounded-md border border-border overflow-hidden">
                        <div className="px-3 py-2 bg-muted/40">
                          <p className="text-sm font-medium">{t("nettoyage.timeline.impactTitle")}</p>
                          <p className="text-xs text-muted-foreground">{t("nettoyage.timeline.impactHint")}</p>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground">
                              <tr className="border-b border-border">
                                <th className="text-left py-2 pr-3">{t("nettoyage.timeline.thColumn")}</th>
                                <th className="text-right py-2 px-3">{t("nettoyage.timeline.thMissingBefore")}</th>
                                <th className="text-right py-2 px-3">{t("nettoyage.timeline.thMissingAfter")}</th>
                                <th className="text-right py-2 px-3">{t("nettoyage.timeline.thFilled")}</th>
                                <th className="text-right py-2 pl-3">{t("nettoyage.timeline.thChanged")}</th>
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
                        <div>{t("nettoyage.timeline.schemaColumn")} <span className="font-mono text-foreground">{String(selectedOp.params.column)}</span></div>
                      ) : null}
                      {schemaAction === "set_kind" && selectedOp.params?.kind ? (
                        <div>{t("nettoyage.timeline.schemaNewType")} <span className="font-medium text-foreground">{String(selectedOp.params.kind)}</span></div>
                      ) : null}
                      {schemaAction === "verify_categorical" ? (
                        <div>{t("nettoyage.timeline.schemaStatus")} <span className="font-medium text-foreground">{selectedOp.params?.verified === false ? t("nettoyage.timeline.notVerified") : t("nettoyage.timeline.verified")}</span></div>
                      ) : null}
                      {schemaAction === "dismiss_alert" ? (
                        <>
                          {selectedOp.params?.alert_key ? (
                            <div>{t("nettoyage.timeline.alertKey")} <span className="font-mono text-foreground">{String(selectedOp.params.alert_key)}</span></div>
                          ) : null}
                          <div>{t("nettoyage.timeline.schemaStatus")} <span className="font-medium text-foreground">{selectedOp.params?.dismissed === false ? t("nettoyage.timeline.restored") : t("nettoyage.timeline.dismissed")}</span></div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-border p-3 bg-muted/30">
                    <p className="text-sm font-medium">{t("nettoyage.timeline.noResult")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("nettoyage.timeline.noResultDesc")}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <Button variant="outline" onClick={() => onSelectOp(null)}>{t("nettoyage.timeline.close")}</Button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </Modal>
    </>
  );
}
