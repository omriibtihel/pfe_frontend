import { useMemo } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedHelp } from "@/components/ui/med-help";
import type {
  ModelHyperparamScalar,
  ModelHyperparamValue,
  TrainingConfig,
  TrainingHyperparamFieldSchema,
} from "@/types";
import { cn } from "@/lib/utils";
import {
  toDisplayText,
  gridValKey,
  gridValFromKey,
  parseFieldValue,
  FRIENDLY_LABEL,
} from "./modelHpHelpers";

export interface HyperparamModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelKey: string;
  modelLabel: string | null;
  modelSelected: boolean;
  fieldSchemas: Record<string, TrainingHyperparamFieldSchema>;
  modelHyperparams: Record<string, Record<string, ModelHyperparamValue>>;
  taskType: TrainingConfig["taskType"];
  searchType: TrainingConfig["searchType"];
  onSetField: (modelKey: string, fieldName: string, value: ModelHyperparamValue | undefined) => void;
}

export function HyperparamModal({
  isOpen,
  onClose,
  modelKey,
  modelLabel,
  modelSelected,
  fieldSchemas,
  modelHyperparams,
  taskType,
  searchType,
  onSetField,
}: HyperparamModalProps) {
  const isSearchActive = (searchType ?? "none") !== "none";
  const searchTypeLabel =
    searchType === "grid" ? "GridSearch" :
    searchType === "random" ? "Random Search" : "Successive Halving";

  const activeModelFields = useMemo(
    () =>
      Object.entries(fieldSchemas).filter(([, fieldSchema]) => {
        const supportedIn = fieldSchema.supported_in;
        if (!supportedIn || supportedIn.length === 0) return true;
        return supportedIn.includes(taskType);
      }),
    [fieldSchemas, taskType]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          Hyperparamètres
          <Badge variant="outline" className="uppercase text-[11px] font-semibold">
            {modelLabel ?? modelKey}
          </Badge>
          {isSearchActive && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400">
              Lecture seule — mode {searchTypeLabel}
            </Badge>
          )}
        </span>
      }
      description={
        isSearchActive
          ? `En mode ${searchTypeLabel}, les HP sont explorés automatiquement par le backend. Repassez en mode Aucune pour fixer des valeurs.`
          : modelSelected
          ? "Modifiez les hyperparamètres du modèle sélectionné."
          : "Modèle non sélectionné : les valeurs seront conservées mais ignorées tant que le modèle n'est pas coché."
      }
    >
      {!activeModelFields.length ? (
        <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
          Aucun réglage configurable pour ce modèle.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-sky-200/50 bg-sky-50/40 dark:bg-sky-950/20 p-2.5 text-[11px] text-sky-700 dark:text-sky-400 flex gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-500" />
            <span>Les valeurs par défaut sont optimisées pour la plupart des cas médicaux. Ne modifiez que si vous avez une raison spécifique.</span>
          </div>
          {activeModelFields.map(([fieldName, fieldSchema]) => {
            const rawModelValue = modelHyperparams[modelKey]?.[fieldName];
            const displayValue = toDisplayText(rawModelValue, fieldSchema.default);
            const fieldType = String(fieldSchema.type ?? "").toLowerCase();
            const enumOptions = Array.isArray(fieldSchema.enum) ? fieldSchema.enum : [];
            const gridValues = Array.isArray(fieldSchema.grid_values) ? fieldSchema.grid_values : [];
            const hasGridValues = gridValues.length > 0;

            const isEnumSelect = fieldType === "enum";
            const isEnumOrNullSelect = fieldType === "enum_or_null";

            const enumOrNullValue =
              rawModelValue === null || rawModelValue === undefined
                ? String(fieldSchema.default ?? "null")
                : String(rawModelValue);

            const handleEnumOrNull = (next: string) => {
              onSetField(modelKey, fieldName, next === "null" ? null : next);
            };

            const singleSelectValue = (() => {
              if (rawModelValue === undefined || rawModelValue === null) {
                return gridValKey(fieldSchema.default as number | string | null);
              }
              return Array.isArray(rawModelValue)
                ? gridValKey(rawModelValue[0] as number | string | null)
                : gridValKey(rawModelValue as number | string | null);
            })();

            const displayLabel = FRIENDLY_LABEL[fieldName] ?? fieldName;

            return (
              <div key={`${modelKey}-${fieldName}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium">{displayLabel}</Label>
                    {fieldSchema.help && (
                      <MedHelp title={displayLabel} side="top">
                        <p>{fieldSchema.help}</p>
                      </MedHelp>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Défaut : {String(fieldSchema.default ?? "—")}
                  </span>
                </div>

                {isEnumSelect ? (
                  <Select
                    value={String((rawModelValue as ModelHyperparamScalar) ?? fieldSchema.default ?? "")}
                    onValueChange={(next) => onSetField(modelKey, fieldName, next)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {enumOptions.map((opt) => (
                        <SelectItem key={`${modelKey}-${fieldName}-${opt}`} value={String(opt)}>
                          {String(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : isEnumOrNullSelect ? (
                  <Select value={enumOrNullValue} onValueChange={handleEnumOrNull}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">
                        <span className="text-muted-foreground italic">null — désactivé</span>
                      </SelectItem>
                      {enumOptions.map((opt) => (
                        <SelectItem key={`${modelKey}-${fieldName}-${opt}`} value={String(opt)}>
                          {String(opt)}
                          {String(opt) === String(fieldSchema.default) && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">(défaut)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : hasGridValues && !isSearchActive ? (
                  <Select
                    value={singleSelectValue}
                    onValueChange={(key) =>
                      onSetField(modelKey, fieldName, gridValFromKey(key, fieldSchema))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gridValues.map((gv) => {
                        const key = gridValKey(gv);
                        const label = gv === null ? "null — illimité" : String(gv);
                        const isDefault =
                          gv === fieldSchema.default ||
                          (gv === null && fieldSchema.default === null);
                        return (
                          <SelectItem key={key} value={key}>
                            {label}
                            {isDefault && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">(défaut)</span>
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : hasGridValues && isSearchActive ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {gridValues.map((gv) => {
                        const key = gridValKey(gv);
                        const label = gv === null ? "∞" : String(gv);
                        return (
                          <span
                            key={key}
                            className="px-2 py-0.5 rounded border text-xs font-mono bg-muted/40 text-muted-foreground border-border/50 cursor-default select-none"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      {searchType === "grid"
                        ? "Grille du backend — non modifiable en mode GridSearch"
                        : `Distribution continue — non modifiable en mode ${searchType === "halving_random" ? "Successive Halving" : "Random Search"}`}
                    </p>
                  </div>
                ) : (
                  <Input
                    type={fieldType === "int" || fieldType === "float" ? "number" : "text"}
                    value={displayValue}
                    disabled={isSearchActive}
                    onChange={(e) =>
                      !isSearchActive && onSetField(
                        modelKey,
                        fieldName,
                        parseFieldValue(e.target.value, fieldSchema, false),
                      )
                    }
                    className={cn("h-8 text-xs", isSearchActive && "opacity-50 cursor-not-allowed")}
                    placeholder={`ex: ${String(fieldSchema.default ?? "")}`}
                  />
                )}

                {!!fieldSchema.help && (
                  <p className="text-[11px] text-muted-foreground">{fieldSchema.help}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
