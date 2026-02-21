import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, Brain, Grid3X3, MoreHorizontal, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trainingService } from "@/services/trainingService";
import type {
  ModelHyperparamScalar,
  ModelHyperparamValue,
  ModelType,
  TrainingConfig,
  TrainingHyperparamFieldSchema,
} from "@/types";
import { cn } from "@/lib/utils";

interface Step4Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

type ModelCardOption = {
  value: ModelType;
  label: string;
  desc: string;
  icon: ReactNode;
  installed: boolean;
};

const modelCatalog: Array<{ value: ModelType; label: string; desc: string; icon: ReactNode }> = [
  { value: "randomforest", label: "Random Forest", desc: "Robuste, interpretable", icon: <Brain className="h-4 w-4" /> },
  { value: "xgboost", label: "XGBoost", desc: "Haute performance", icon: <Sparkles className="h-4 w-4" /> },
  { value: "lightgbm", label: "LightGBM", desc: "Rapide, efficace", icon: <Zap className="h-4 w-4" /> },
  { value: "svm", label: "SVM", desc: "Bon pour petits datasets", icon: <Brain className="h-4 w-4" /> },
  { value: "knn", label: "KNN", desc: "Simple, intuitif", icon: <Brain className="h-4 w-4" /> },
  { value: "decisiontree", label: "Decision Tree", desc: "Tres interpretable", icon: <Brain className="h-4 w-4" /> },
  { value: "logisticregression", label: "Logistic Reg.", desc: "Classification lineaire", icon: <BarChart3 className="h-4 w-4" /> },
];

const gridScoringOptions = [
  { value: "auto", label: "Auto" },
  { value: "roc_auc", label: "ROC AUC" },
  { value: "average_precision", label: "Avg Precision" },
  { value: "f1_weighted", label: "F1 Weighted" },
  { value: "r2", label: "R²" },
];

function normalizeModelKey(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function toDisplayText(value: ModelHyperparamValue | undefined, fallback: ModelHyperparamValue): string {
  const source = value !== undefined ? value : fallback;
  if (Array.isArray(source)) return source.map((x) => String(x)).join(", ");
  if (source === null || source === undefined) return "";
  return String(source);
}

function parseScalarToken(rawToken: string, fieldSchema: TrainingHyperparamFieldSchema): ModelHyperparamScalar {
  const token = String(rawToken ?? "").trim();
  const lowered = token.toLowerCase();
  const fieldType = String(fieldSchema?.type ?? "").toLowerCase();

  if (fieldType === "int_or_none" && (lowered === "none" || lowered === "null")) {
    return null;
  }
  if (fieldType === "int" || fieldType === "int_or_none") {
    const n = Number.parseInt(token, 10);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "float") {
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "float_or_enum") {
    const allowed = (fieldSchema.enum ?? []).map((x) => String(x).toLowerCase());
    if (allowed.includes(lowered)) return lowered;
    const n = Number.parseFloat(token);
    return Number.isFinite(n) ? n : token;
  }
  if (fieldType === "enum") {
    return lowered;
  }
  return token;
}

function parseFieldValue(rawInput: string, fieldSchema: TrainingHyperparamFieldSchema, allowList: boolean): ModelHyperparamValue | undefined {
  const text = String(rawInput ?? "").trim();
  if (!text) return undefined;

  if (allowList && text.includes(",")) {
    const parts = text
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.map((token) => parseScalarToken(token, fieldSchema));
    }
  }
  return parseScalarToken(text, fieldSchema);
}

export function Step4Models({ projectId, config, onConfigChange }: Step4Props) {
  const [availableModels, setAvailableModels] = useState<ModelCardOption[]>(
    modelCatalog.map((m) => ({ ...m, installed: true }))
  );
  const [modelHpSchema, setModelHpSchema] = useState<Record<string, Record<string, TrainingHyperparamFieldSchema>>>({});
  const [hpModalModel, setHpModalModel] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadCapabilities = async () => {
      try {
        const caps = await trainingService.getCapabilities(projectId);
        if (!mounted) return;

        const schemaRaw = caps.modelHyperparamsSchema ?? {};
        setModelHpSchema(schemaRaw);

        const installedByModel = new Map<string, boolean>();
        for (const item of caps.availableModels ?? []) {
          const key = normalizeModelKey(item.key ?? item.name);
          if (!key) continue;
          installedByModel.set(key, Boolean(item.installed));
        }

        setAvailableModels(
          modelCatalog.map((m) => ({
            ...m,
            installed: installedByModel.has(m.value) ? Boolean(installedByModel.get(m.value)) : true,
          }))
        );
      } catch {
        if (!mounted) return;
        setAvailableModels(modelCatalog.map((m) => ({ ...m, installed: true })));
        setModelHpSchema({});
      }
    };
    if (String(projectId ?? "").trim()) {
      loadCapabilities();
    }
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const modelHyperparams = config.modelHyperparams ?? {};
  const activeModelKey = hpModalModel ? normalizeModelKey(hpModalModel) : "";
  const activeModel = useMemo(
    () => availableModels.find((m) => normalizeModelKey(m.value) === activeModelKey) ?? null,
    [activeModelKey, availableModels]
  );
  const activeModelSchema = modelHpSchema[activeModelKey] ?? {};
  const activeModelFields = useMemo(() => Object.entries(activeModelSchema), [activeModelSchema]);
  const activeModelSelected = useMemo(
    () => (config.models ?? []).some((m) => normalizeModelKey(m) === activeModelKey),
    [activeModelKey, config.models]
  );

  const setModelField = (modelKey: string, fieldName: string, value: ModelHyperparamValue | undefined) => {
    const nextHyperparams: Record<string, Record<string, ModelHyperparamValue>> = {
      ...(modelHyperparams ?? {}),
    };
    const currentModelFields: Record<string, ModelHyperparamValue> = {
      ...(nextHyperparams[modelKey] ?? {}),
    };

    if (value === undefined || value === "") {
      delete currentModelFields[fieldName];
    } else {
      currentModelFields[fieldName] = value;
    }

    if (Object.keys(currentModelFields).length === 0) {
      delete nextHyperparams[modelKey];
    } else {
      nextHyperparams[modelKey] = currentModelFields;
    }

    onConfigChange({ modelHyperparams: nextHyperparams });
  };

  const toggleModel = (rawModel: ModelType, installed: boolean) => {
    if (!installed) return;
    const selected = config.models.includes(rawModel);
    const nextModels = selected ? config.models.filter((x) => x !== rawModel) : [...config.models, rawModel];
    // Keep per-model hyperparams untouched when toggling model selection.
    // This preserves user edits while selecting additional models.
    onConfigChange({ models: nextModels });
  };

  return (
    <div className="space-y-6">
      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            Algorithmes
            <Badge variant="secondary" className="ml-auto text-xs">
              {config.models.length} selectionne{config.models.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableModels.map((m, i) => {
              const selected = config.models.includes(m.value);
              const modelKey = normalizeModelKey(m.value);
              const hasHpSchema = Object.keys(modelHpSchema[modelKey] ?? {}).length > 0;
              return (
                <motion.label
                  key={m.value}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                    m.installed ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    selected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  {hasHpSchema && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      disabled={!m.installed}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHpModalModel(modelKey);
                      }}
                      aria-label={`Configurer hyperparametres ${m.label}`}
                      title="Hyperparametres"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                  <Checkbox
                    checked={selected}
                    disabled={!m.installed}
                    onCheckedChange={() => toggleModel(m.value, m.installed)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{m.icon}</span>
                      <span className="font-semibold text-sm">{m.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                    {!m.installed && <p className="text-[11px] text-destructive mt-1">Non installe sur le backend</p>}
                  </div>
                </motion.label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(hpModalModel)}
        onOpenChange={(open) => {
          if (!open) setHpModalModel(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Hyperparametres
              <Badge variant="outline" className="uppercase">
                {activeModel?.label ?? activeModelKey}
              </Badge>
              {config.useGridSearch && (
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  Listes: separees par virgules
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeModelSelected
                ? "Modifiez les hyperparametres du modele selectionne."
                : "Modele non selectionne: les valeurs seront conservees mais ignorees tant que le modele n'est pas coche."}
            </DialogDescription>
          </DialogHeader>

          {!activeModelFields.length ? (
            <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
              Aucun hyperparametre configurable pour ce modele.
            </div>
          ) : (
            <div className="space-y-3">
              {activeModelFields.map(([fieldName, fieldSchema]) => {
                const rawModelValue = modelHyperparams[activeModelKey]?.[fieldName];
                const displayValue = toDisplayText(rawModelValue, fieldSchema.default);
                const fieldType = String(fieldSchema.type ?? "").toLowerCase();
                const enumOptions = Array.isArray(fieldSchema.enum) ? fieldSchema.enum : [];
                const isEnumSelect = !config.useGridSearch && fieldType === "enum";

                return (
                  <div key={`${activeModelKey}-${fieldName}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs font-medium">{fieldName}</Label>
                      <span className="text-[11px] text-muted-foreground">
                        Default: {String(fieldSchema.default ?? "")}
                      </span>
                    </div>

                    {isEnumSelect ? (
                      <Select
                        value={String((rawModelValue as ModelHyperparamScalar) ?? fieldSchema.default ?? "")}
                        onValueChange={(next) => setModelField(activeModelKey, fieldName, next)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                        <SelectContent>
                          {enumOptions.map((opt) => (
                            <SelectItem key={`${activeModelKey}-${fieldName}-${opt}`} value={String(opt)}>
                              {String(opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={fieldType === "int" || fieldType === "float" ? "number" : "text"}
                        value={displayValue}
                        onChange={(e) =>
                          setModelField(
                            activeModelKey,
                            fieldName,
                            parseFieldValue(e.target.value, fieldSchema, Boolean(config.useGridSearch))
                          )
                        }
                        className="h-8 text-xs"
                        placeholder={config.useGridSearch ? "ex: 100,200" : `ex: ${String(fieldSchema.default ?? "")}`}
                      />
                    )}

                    {!!fieldSchema.help && <p className="text-[11px] text-muted-foreground">{fieldSchema.help}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-premium shadow-card">
          <CardContent className="py-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={config.useSmote}
                onCheckedChange={(c) => onConfigChange({ useSmote: !!c })}
                disabled={config.taskType !== "classification"}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">SMOTE</span>
                  <Badge variant="outline" className="text-[10px]">
                    Classification
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Equilibrage des classes par sur-echantillonnage synthetique</p>
                {config.taskType !== "classification" && (
                  <p className="text-xs text-warning mt-1">Disponible uniquement en classification</p>
                )}
              </div>
            </label>
          </CardContent>
        </Card>

        <Card className="glass-premium shadow-card">
          <CardContent className="py-5 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={config.useGridSearch} onCheckedChange={(c) => onConfigChange({ useGridSearch: !!c })} />
              <div>
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">GridSearch CV</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Optimisation automatique des hyperparametres</p>
              </div>
            </label>

            {config.useGridSearch && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3 pl-7">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">CV Folds</label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={config.gridCvFolds}
                    onChange={(e) => onConfigChange({ gridCvFolds: Math.max(2, parseInt(e.target.value, 10) || 3) })}
                    className="w-20 h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Scoring</label>
                  <Select value={config.gridScoring} onValueChange={(v) => onConfigChange({ gridScoring: v })}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gridScoringOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Step4Models;
