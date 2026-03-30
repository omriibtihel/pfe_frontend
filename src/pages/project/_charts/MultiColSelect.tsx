import React, { useState } from "react";
import { Check, ChevronDown, Search, X as XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLORS } from "./constants";

export function MultiColSelect({
  triggerLabel,
  all,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  maxItems,
}: {
  triggerLabel?: string;
  all: string[];
  selected: string[];
  onToggle: (col: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  maxItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? all.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : all;
  const atMax = maxItems !== undefined && selected.length >= maxItems;

  const triggerText =
    selected.length === 0
      ? triggerLabel ?? "Choisir colonnes"
      : `${selected.length} colonne${selected.length > 1 ? "s" : ""} sélectionnée${selected.length > 1 ? "s" : ""}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-muted/50 transition text-left">
          <span className="flex-1 text-xs text-muted-foreground truncate">{triggerText}</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">{selected.length}/{all.length}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold">
            {selected.length} / {all.length} sélectionnée{selected.length > 1 ? "s" : ""}
          </span>
          <div className="flex gap-3 text-xs">
            <button className="text-primary hover:underline" onClick={onSelectAll}>Tout</button>
            <button className="text-muted-foreground hover:underline" onClick={onClearAll}>Aucune</button>
          </div>
        </div>

        {/* Search — visible only when list is long */}
        {all.length > 8 && (
          <div className="flex items-center gap-1.5 px-3 py-2 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Rechercher..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* List */}
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.map((name) => {
            const isSelected = selected.includes(name);
            const disabled = !isSelected && atMax;
            const color = COLORS[all.indexOf(name) % COLORS.length];
            return (
              <button
                key={name}
                disabled={disabled}
                onClick={() => onToggle(name)}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-left transition ${
                  disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-muted/60 cursor-pointer"
                }`}
              >
                <span
                  className="h-4 w-4 rounded border flex items-center justify-center shrink-0 transition"
                  style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate flex-1" title={name}>{name}</span>
              </button>
            );
          })}
          {q && filtered.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-3">Aucune colonne</p>
          )}
        </div>

        {maxItems !== undefined && (
          <div className="px-3 py-2 border-t text-[10px] text-muted-foreground">
            Maximum {maxItems} colonnes
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
