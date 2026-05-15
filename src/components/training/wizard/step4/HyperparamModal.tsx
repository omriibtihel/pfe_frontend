import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedHelp } from "@/components/ui/med-help";
import type {
  HpRange,
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
  makeFriendlyLabel,
} from "./modelHpHelpers";
import { HpChipsInput } from "./HpChipsInput";
import { HpRangeInput } from "./HpRangeInput";

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

// Key: `${modelKey}::${fieldName}`
type CustomFieldsState = Record<string, boolean>;

// Safe cast helpers — at runtime HpRange/HpGrid objects can be stored in modelHyperparams
// even though the TypeScript type says ModelHyperparamValue.
function asRangeOrNull(v: ModelHyperparamValue | undefined): HpRange | null {
  const obj = v as unknown as { kind?: string };
  return obj?.kind === "range" ? (v as unknown as HpRange) : null;
}

function storedIsRange(v: ModelHyperparamValue | undefined): boolean {
  return asRangeOrNull(v) !== null;
}

const NUMERIC_FOR_RANGE = new Set(["int", "int_or_none", "float", "float_or_enum"]);

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
  const { t } = useTranslation();
  const friendlyLabel = useMemo(() => makeFriendlyLabel(t), [t]);
  const isSearchActive = (searchType ?? "none") !== "none";
  const isGridSearch = searchType === "grid";
  const isRandomSearch = searchType === "random" || searchType === "halving_random";
  const searchTypeLabel =
    searchType === "grid" ? t("training.hp.gridSearch") :
    searchType === "random" ? t("training.hp.randomSearch") : t("training.hp.halving");

  // Per-field custom-mode toggle state (keyed as `modelKey::fieldName`)
  const [customFields, setCustomFields] = useState<CustomFieldsState>({});

  const customKey = (fieldName: string) => `${modelKey}::${fieldName}`;

  const isFieldCustom = (fieldName: string, rawValue: ModelHyperparamValue | undefined): boolean => {
    const explicit = customFields[customKey(fieldName)];
    if (explicit !== undefined) return explicit;
    // Infer from stored value structure
    if (isGridSearch && Array.isArray(rawValue)) return true;
    if (isRandomSearch && (Array.isArray(rawValue) || storedIsRange(rawValue))) return true;
    return false;
  };

  const handleSetDefault = (fieldName: string) => {
    setCustomFields((prev) => ({ ...prev, [customKey(fieldName)]: false }));
    onSetField(modelKey, fieldName, undefined);
  };

  // Chips custom (GridSearch numeric, Random enum)
  const handleSetCustomChips = (
    fieldName: string,
    rawValue: ModelHyperparamValue | undefined,
    initChips: ModelHyperparamScalar[],
  ) => {
    setCustomFields((prev) => ({ ...prev, [customKey(fieldName)]: true }));
    if (!Array.isArray(rawValue)) {
      onSetField(modelKey, fieldName, initChips);
    }
  };

  // Range custom (Random/Halving numeric)
  const handleSetCustomRange = (
    fieldName: string,
    rawValue: ModelHyperparamValue | undefined,
    initRange: HpRange,
  ) => {
    setCustomFields((prev) => ({ ...prev, [customKey(fieldName)]: true }));
    if (!storedIsRange(rawValue)) {
      onSetField(modelKey, fieldName, initRange as unknown as ModelHyperparamValue);
    }
  };

  const activeModelFields = useMemo(
    () =>
      Object.entries(fieldSchemas).filter(([, fieldSchema]) => {
        const supportedIn = fieldSchema.supported_in;
        if (!supportedIn || supportedIn.length === 0) return true;
        return supportedIn.includes(taskType);
      }),
    [fieldSchemas, taskType]
  );

  const infoText = isGridSearch
    ? t("training.hp.infoGrid")
    : isRandomSearch
    ? t("training.hp.infoRandom")
    : t("training.hp.infoNone");

  const modalDescription = isGridSearch
    ? t("training.hp.descGrid")
    : isRandomSearch
    ? t("training.hp.descRandom", { label: searchTypeLabel })
    : modelSelected
    ? t("training.hp.descSelected")
    : t("training.hp.descUnselected");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          {t("training.hp.hyperparams")}
          <Badge variant="outline" className="uppercase text-[11px] font-semibold">
            {modelLabel ?? modelKey}
          </Badge>
          {isSearchActive && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400">
              {t("training.hp.modeBadge", { label: searchTypeLabel })}
            </Badge>
          )}
        </span>
      }
      description={modalDescription}
    >
      {!activeModelFields.length ? (
        <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
          {t("training.hp.noFields")}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-sky-200/50 bg-sky-50/40 dark:bg-sky-950/20 p-2.5 text-[11px] text-sky-700 dark:text-sky-400 flex gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-500" />
            <span>{infoText}</span>
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
            const isEnumType = isEnumSelect || isEnumOrNullSelect;
            const isNumericRange = NUMERIC_FOR_RANGE.has(fieldType);

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

            const displayLabel = friendlyLabel(fieldName);
            const isCustom = isFieldCustom(fieldName, rawModelValue);

            // Chips for grid (numeric) and random (enum)
            const currentChips = Array.isArray(rawModelValue)
              ? (rawModelValue as ModelHyperparamScalar[])
              : (gridValues as ModelHyperparamScalar[]);

            // Range extracted from stored value (random numeric custom)
            const rangeValue = asRangeOrNull(rawModelValue);

            // Default init range for random mode (respect schema bounds)
            const schemaMin =
              typeof fieldSchema.min === "number" ? fieldSchema.min :
              typeof fieldSchema.ge === "number" ? fieldSchema.ge :
              typeof fieldSchema.gt === "number" ? fieldSchema.gt + (fieldType.startsWith("int") ? 1 : 0.001) :
              undefined;
            const schemaMax =
              typeof fieldSchema.max === "number" ? fieldSchema.max :
              typeof fieldSchema.le === "number" ? fieldSchema.le :
              typeof fieldSchema.lt === "number" ? fieldSchema.lt - (fieldType.startsWith("int") ? 1 : 0.001) :
              undefined;
            const initRange: HpRange = {
              kind: "range",
              min: typeof schemaMin === "number" ? schemaMin : (fieldType.startsWith("int") ? 1 : 0.001),
              max: typeof schemaMax === "number" ? schemaMax : (fieldType.startsWith("int") ? 100 : 10),
            };

            // Toggle shown for: GridSearch non-enum, OR any RandomSearch field
            const showToggle = (isGridSearch && !isEnumType) || isRandomSearch;

            const onClickCustom = isRandomSearch && isNumericRange
              ? () => handleSetCustomRange(fieldName, rawModelValue, initRange)
              : () => handleSetCustomChips(
                  fieldName,
                  rawModelValue,
                  hasGridValues ? (gridValues as ModelHyperparamScalar[]) : [],
                );

            const ModeToggle = showToggle ? (
              <div className="flex rounded border border-border/60 overflow-hidden w-fit">
                <button
                  type="button"
                  onClick={() => handleSetDefault(fieldName)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] transition-colors",
                    !isCustom
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {t("training.hp.modeDefault")}
                </button>
                <button
                  type="button"
                  onClick={onClickCustom}
                  className={cn(
                    "px-2 py-0.5 text-[11px] border-l border-border/60 transition-colors",
                    isCustom
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {t("training.hp.modeCustom")}
                </button>
              </div>
            ) : null;

            // ── Read-only chips (shown in Défaut mode when gridValues exist) ──
            const ReadOnlyChips = (msg: string) => (
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
                <p className="text-[10px] text-muted-foreground italic">{msg}</p>
              </div>
            );

            // ── Default-mode placeholder (no gridValues) ──────────────────────
            const DefaultPlaceholder = (msg: string) => (
              <p className="text-[11px] text-muted-foreground italic rounded-md bg-muted/30 px-2 py-1.5">
                {msg}
              </p>
            );

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
                  <div className="flex items-center gap-2">
                    {ModeToggle}
                    <span className="text-[11px] text-muted-foreground">
                      {t("training.hp.defaultValue", { value: String(fieldSchema.default ?? "—") })}
                    </span>
                  </div>
                </div>

                {/* ── enum (simple Select) ─────────────────────────────────── */}
                {isEnumSelect ? (
                  isRandomSearch && isCustom ? (
                    <HpChipsInput
                      chips={Array.isArray(rawModelValue) ? (rawModelValue as ModelHyperparamScalar[]) : []}
                      fieldSchema={fieldSchema}
                      onChange={(vals) => onSetField(modelKey, fieldName, vals)}
                    />
                  ) : (
                    <Select
                      value={String((rawModelValue as ModelHyperparamScalar) ?? fieldSchema.default ?? "")}
                      onValueChange={(next) => onSetField(modelKey, fieldName, next)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("training.hp.choosePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {enumOptions.map((opt) => (
                          <SelectItem key={`${modelKey}-${fieldName}-${opt}`} value={String(opt)}>
                            {String(opt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )

                /* ── enum_or_null Select ─────────────────────────────────────── */
                ) : isEnumOrNullSelect ? (
                  isRandomSearch && isCustom ? (
                    <HpChipsInput
                      chips={Array.isArray(rawModelValue) ? (rawModelValue as ModelHyperparamScalar[]) : []}
                      fieldSchema={fieldSchema}
                      onChange={(vals) => onSetField(modelKey, fieldName, vals)}
                    />
                  ) : (
                    <Select value={enumOrNullValue} onValueChange={handleEnumOrNull}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("training.hp.choosePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">
                          <span className="text-muted-foreground italic">{t("training.hp.nullDisabled")}</span>
                        </SelectItem>
                        {enumOptions.map((opt) => (
                          <SelectItem key={`${modelKey}-${fieldName}-${opt}`} value={String(opt)}>
                            {String(opt)}
                            {String(opt) === String(fieldSchema.default) && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">{t("training.hp.defaultSuffix")}</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )

                /* ── Fixed mode (none): Select from grid_values ──────────────── */
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
                        const label = gv === null ? t("training.hp.nullUnlimited") : String(gv);
                        const isDefault =
                          gv === fieldSchema.default ||
                          (gv === null && fieldSchema.default === null);
                        return (
                          <SelectItem key={key} value={key}>
                            {label}
                            {isDefault && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">{t("training.hp.defaultSuffix")}</span>
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                /* ── Search active + has grid_values ─────────────────────────── */
                ) : hasGridValues && isSearchActive ? (
                  isGridSearch && isCustom ? (
                    <HpChipsInput
                      chips={currentChips}
                      fieldSchema={fieldSchema}
                      onChange={(vals) => onSetField(modelKey, fieldName, vals)}
                    />
                  ) : isGridSearch ? (
                    ReadOnlyChips(t("training.hp.readOnlyGrid"))
                  ) : isRandomSearch && isCustom ? (
                    <HpRangeInput
                      value={rangeValue}
                      fieldType={fieldType}
                      fieldSchema={fieldSchema}
                      onChange={(r) => onSetField(modelKey, fieldName, r as unknown as ModelHyperparamValue)}
                    />
                  ) : (
                    ReadOnlyChips(t("training.hp.readOnlyRandom"))
                  )

                /* ── No grid_values (plain Input / chips / range) ────────────── */
                ) : (
                  isGridSearch && isCustom ? (
                    <HpChipsInput
                      chips={Array.isArray(rawModelValue) ? (rawModelValue as ModelHyperparamScalar[]) : []}
                      fieldSchema={fieldSchema}
                      onChange={(vals) => onSetField(modelKey, fieldName, vals)}
                    />
                  ) : isRandomSearch && isCustom ? (
                    <HpRangeInput
                      value={rangeValue}
                      fieldType={fieldType}
                      fieldSchema={fieldSchema}
                      onChange={(r) => onSetField(modelKey, fieldName, r as unknown as ModelHyperparamValue)}
                    />
                  ) : isRandomSearch ? (
                    DefaultPlaceholder(t("training.hp.autoDistribution"))
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
                      placeholder={t("training.hp.examplePlaceholder", { default: String(fieldSchema.default ?? "") })}
                    />
                  )
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
