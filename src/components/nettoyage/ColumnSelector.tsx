import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  Search,
  SlidersHorizontal,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import type { ColumnMeta } from "@/services/dataService";
import { normalizeKind, inferKindFallback, kindLabel, kindBadgeClass } from "@/pages/project/nettoyage/useNettoyageData";

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "numeric", label: "Num" },
  { key: "categorical", label: "Cat" },
  { key: "datetime", label: "Date" },
  { key: "binary", label: "Bin" },
  { key: "text", label: "Text" },
  { key: "id", label: "ID" },
  { key: "other", label: "Other" },
];

export function ColumnSelector({
  columns,
  selectedColumns,
  onToggle,
  label = "Colonnes",
  metaMap,
}: {
  columns: string[];
  selectedColumns: string[];
  onToggle: (col: string) => void;
  label?: string;
  metaMap?: Record<string, ColumnMeta>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "missing" | "unique">("name");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = columns.slice();

    if (selectedOnly) {
      const set = new Set(selectedColumns);
      list = list.filter((c) => set.has(c));
    }
    if (query) list = list.filter((c) => c.toLowerCase().includes(query));

    if (typeFilter.size > 0) {
      list = list.filter((c) => {
        const k = normalizeKind(metaMap?.[c]?.kind ?? inferKindFallback(c, metaMap?.[c]?.dtype));
        return typeFilter.has(k);
      });
    }

    if (missingOnly) list = list.filter((c) => (metaMap?.[c]?.missing ?? 0) > 0);

    list.sort((a, b) => {
      if (sortBy === "name") return a.localeCompare(b);
      if (sortBy === "missing") return (metaMap?.[b]?.missing ?? 0) - (metaMap?.[a]?.missing ?? 0);
      if (sortBy === "unique") return (metaMap?.[b]?.unique ?? 0) - (metaMap?.[a]?.unique ?? 0);
      return a.localeCompare(b);
    });

    return list;
  }, [columns, q, typeFilter, missingOnly, selectedOnly, sortBy, selectedColumns, metaMap]);

  const toggleType = (k: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 py-2 h-auto text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            {label} {selectedColumns.length > 0 && `(${selectedColumns.length})`}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-1 pt-2 space-y-2">
        <div className="rounded-md border border-border bg-muted/20 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="pl-8 h-9" />
            </div>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v === "missing" || v === "unique" ? v : "name")}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Tri" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">
                  <div className="flex items-center gap-2">
                    <ArrowDownAZ className="h-4 w-4" />
                    Nom
                  </div>
                </SelectItem>
                <SelectItem value="missing">
                  <div className="flex items-center gap-2">
                    <ArrowDownWideNarrow className="h-4 w-4" />
                    Manquants
                  </div>
                </SelectItem>
                <SelectItem value="unique">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Unique
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((t) => {
              const active = typeFilter.has(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleType(t.key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition ${
                    active ? kindBadgeClass(t.key) : "border-border bg-background hover:bg-accent/50"
                  }`}
                >
                  <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 border ${kindBadgeClass(t.key)}`}>
                    {t.label}
                  </span>
                  {t.key}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={missingOnly} onCheckedChange={(v) => setMissingOnly(Boolean(v))} className="h-3.5 w-3.5" />
              Manquants seul.
            </label>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={selectedOnly} onCheckedChange={(v) => setSelectedOnly(Boolean(v))} className="h-3.5 w-3.5" />
              Sélectionnés seul.
            </label>

            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length}/{columns.length}
            </span>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border border-border p-2 bg-muted/30">
          {columns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Aucune colonne</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat</p>
          ) : (
            filtered.map((col) => {
              const m = metaMap?.[col];
              const kind = normalizeKind(m?.kind ?? inferKindFallback(col, m?.dtype));
              const missing = m?.missing ?? 0;
              const unique = m?.unique ?? 0;

              return (
                <label
                  key={col}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-sm transition-colors"
                >
                  <Checkbox checked={selectedColumns.includes(col)} onCheckedChange={() => onToggle(col)} className="h-3.5 w-3.5" />
                  <span className="truncate flex-1">{col}</span>

                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${kindBadgeClass(kind)}`}>
                    {kindLabel(kind)}
                  </Badge>

                  {(missing > 0 || unique > 0) && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {missing > 0 ? `NaN:${missing}` : null}
                      {missing > 0 && unique > 0 ? " • " : null}
                      {unique > 0 ? `uniq:${unique}` : null}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
