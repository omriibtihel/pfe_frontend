import { useState, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { ModelHyperparamScalar, TrainingHyperparamFieldSchema } from "@/types";
import { cn } from "@/lib/utils";

interface HpChipsInputProps {
  chips: ModelHyperparamScalar[];
  fieldSchema: TrainingHyperparamFieldSchema;
  onChange: (values: ModelHyperparamScalar[]) => void;
}

function parseAndValidate(
  token: string,
  schema: TrainingHyperparamFieldSchema,
): { ok: true; value: ModelHyperparamScalar } | { ok: false; reason: string } {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, reason: "vide" };

  const type = schema.type;
  const lower = trimmed.toLowerCase();

  if ((type === "int_or_none" || type === "enum_or_null") && (lower === "null" || lower === "none")) {
    return { ok: true, value: null };
  }

  if (type === "int" || type === "int_or_none") {
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return { ok: false, reason: `"${trimmed}" n'est pas un entier` };
    return { ok: true, value: n };
  }

  if (type === "float") {
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n)) return { ok: false, reason: `"${trimmed}" n'est pas un nombre` };
    return { ok: true, value: n };
  }

  if (type === "float_or_enum") {
    const allowed = (schema.enum ?? []).map((x) => x.toLowerCase());
    if (allowed.includes(lower)) return { ok: true, value: lower };
    const n = Number.parseFloat(trimmed);
    if (!Number.isFinite(n)) return { ok: false, reason: `"${trimmed}" n'est pas un nombre ni une option valide` };
    return { ok: true, value: n };
  }

  if (type === "enum" || type === "enum_or_null") {
    const allowed = (schema.enum ?? []).map((x) => x.toLowerCase());
    if (!allowed.includes(lower)) return { ok: false, reason: `"${trimmed}" non reconnu (options : ${allowed.join(", ")})` };
    return { ok: true, value: lower };
  }

  return { ok: true, value: trimmed };
}

function chipLabel(v: ModelHyperparamScalar): string {
  return v === null ? "null" : String(v);
}

export function HpChipsInput({ chips, fieldSchema, onChange }: HpChipsInputProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tryAdd = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const result = parseAndValidate(trimmed, fieldSchema);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    if (chips.some((c) => c === result.value)) {
      setInputText("");
      setError(null);
      return;
    }
    onChange([...chips, result.value]);
    setInputText("");
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      tryAdd(inputText);
    } else if (e.key === "Backspace" && !inputText && chips.length > 0) {
      onChange(chips.slice(0, -1));
      setError(null);
    } else {
      setError(null);
    }
  };

  const removeChip = (index: number) => {
    onChange(chips.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex flex-wrap gap-1 min-h-[32px] rounded-md border bg-background px-2 py-1 cursor-text transition-colors",
          error ? "border-destructive" : "border-input focus-within:border-ring",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((chip, i) => (
          <span
            key={`${i}-${chip}`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono select-none"
          >
            {chipLabel(chip)}
            <button
              type="button"
              aria-label={`Supprimer ${chipLabel(chip)}`}
              onClick={(e) => { e.stopPropagation(); removeChip(i); }}
              className="hover:text-destructive focus:outline-none"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputText.trim()) tryAdd(inputText); }}
          className="flex-1 min-w-[60px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder={chips.length === 0 ? "Valeur + Entrée (ou virgule)" : ""}
          aria-label="Ajouter une valeur"
        />
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {!error && chips.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">
          Aucune valeur — le backend utilisera ses propres defaults.
        </p>
      )}
    </div>
  );
}
