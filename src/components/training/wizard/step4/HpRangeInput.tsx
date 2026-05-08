import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HpRange, TrainingHyperparamFieldSchema } from "@/types";

interface HpRangeInputProps {
  value: HpRange | null;
  fieldType: string;
  fieldSchema: TrainingHyperparamFieldSchema;
  onChange: (range: HpRange) => void;
}

function parseBound(s: string, isInt: boolean): number {
  return isInt ? Number.parseInt(s, 10) : Number.parseFloat(s);
}

function schemaLowerBound(schema: TrainingHyperparamFieldSchema, isInt: boolean): number | undefined {
  if (typeof schema.min === "number") return schema.min;
  if (typeof schema.ge === "number") return schema.ge;
  if (typeof schema.gt === "number") return schema.gt + (isInt ? 1 : 1e-9);
  return undefined;
}

function schemaUpperBound(schema: TrainingHyperparamFieldSchema, isInt: boolean): number | undefined {
  if (typeof schema.max === "number") return schema.max;
  if (typeof schema.le === "number") return schema.le;
  if (typeof schema.lt === "number") return schema.lt - (isInt ? 1 : 1e-9);
  return undefined;
}

export function HpRangeInput({ value, fieldType, fieldSchema, onChange }: HpRangeInputProps) {
  const isInt = fieldType === "int" || fieldType === "int_or_none";
  const isFloat = fieldType === "float" || fieldType === "float_or_enum";
  const isIntOrNone = fieldType === "int_or_none";
  const showDistribution = isFloat;

  const lower = schemaLowerBound(fieldSchema, isInt);
  const upper = schemaUpperBound(fieldSchema, isInt);

  const [minText, setMinText] = useState(value != null ? String(value.min) : "");
  const [maxText, setMaxText] = useState(value != null ? String(value.max) : "");
  const [distribution, setDistribution] = useState<"uniform" | "log_uniform">(
    value?.distribution ?? "uniform",
  );
  const [includeNull, setIncludeNull] = useState<boolean>(value?.includeNull ?? false);
  const [error, setError] = useState<string | null>(null);

  const tryPropagate = (
    mStr: string,
    xStr: string,
    dist: "uniform" | "log_uniform",
    incNull: boolean,
  ) => {
    const minVal = parseBound(mStr, isInt);
    const maxVal = parseBound(xStr, isInt);

    if (!Number.isFinite(minVal)) { setError("Valeur Min invalide"); return; }
    if (!Number.isFinite(maxVal)) { setError("Valeur Max invalide"); return; }
    if (minVal >= maxVal) { setError("Min doit être strictement inférieur à Max"); return; }
    if (typeof lower === "number" && minVal < lower) { setError(`Min ≥ ${lower}`); return; }
    if (typeof upper === "number" && maxVal > upper) { setError(`Max ≤ ${upper}`); return; }

    setError(null);
    const range: HpRange = { kind: "range", min: minVal, max: maxVal };
    if (showDistribution) range.distribution = dist;
    if (isIntOrNone && incNull) range.includeNull = true;
    onChange(range);
  };

  const minPlaceholder = typeof lower === "number" ? `≥ ${lower}` : "Min";
  const maxPlaceholder = typeof upper === "number" ? `≤ ${upper}` : "Max";

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-0.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Min</Label>
          <Input
            type="text"
            inputMode={isFloat ? "decimal" : "numeric"}
            value={minText}
            placeholder={minPlaceholder}
            onChange={(e) => { setMinText(e.target.value); setError(null); }}
            onBlur={() => tryPropagate(minText, maxText, distribution, includeNull)}
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="flex-1 space-y-0.5">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Max</Label>
          <Input
            type="text"
            inputMode={isFloat ? "decimal" : "numeric"}
            value={maxText}
            placeholder={maxPlaceholder}
            onChange={(e) => { setMaxText(e.target.value); setError(null); }}
            onBlur={() => tryPropagate(minText, maxText, distribution, includeNull)}
            className="h-8 text-xs font-mono"
          />
        </div>
        {showDistribution && (
          <div className="w-36 space-y-0.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Distribution</Label>
            <Select
              value={distribution}
              onValueChange={(v) => {
                const next = v as "uniform" | "log_uniform";
                setDistribution(next);
                tryPropagate(minText, maxText, next, includeNull);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">Uniforme</SelectItem>
                <SelectItem value="log_uniform">Log-uniforme</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isIntOrNone && (
        <label className="flex items-center gap-1.5 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={includeNull}
            onChange={(e) => {
              const next = e.target.checked;
              setIncludeNull(next);
              tryPropagate(minText, maxText, distribution, next);
            }}
            className="h-3 w-3 rounded border-border accent-primary"
          />
          <span className="text-[11px] text-muted-foreground">Inclure null (∞ — sans limite)</span>
        </label>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {!error && !minText && !maxText && (
        <p className="text-[10px] text-muted-foreground italic">
          Saisissez Min et Max puis appuyez sur Tab pour valider.
        </p>
      )}
    </div>
  );
}
