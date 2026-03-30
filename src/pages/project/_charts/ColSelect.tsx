import React, { useState } from "react";
import { Search, X as XIcon } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function ColSelect({
  value,
  onChange,
  cols,
  placeholder = "Choisir colonne",
}: {
  value: string;
  onChange: (v: string) => void;
  cols: Array<string | { name: string }>;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const names = cols.map((c) => (typeof c === "string" ? c : c.name));
  const filtered = q ? names.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : names;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-xl">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {names.length > 8 && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b sticky top-0 bg-popover z-10">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Rechercher..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {filtered.map((name) => (
          <SelectItem key={name} value={name}>{name}</SelectItem>
        ))}
        {q && filtered.length === 0 && (
          <div className="py-3 text-xs text-center text-muted-foreground">Aucune colonne</div>
        )}
      </SelectContent>
    </Select>
  );
}
