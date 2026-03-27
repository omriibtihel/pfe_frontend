import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, Brain, Grid3X3, MoreHorizontal, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
  GridScoringOption,
  SearchType,
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
  { value: "randomforest",     label: "Random Forest",    desc: "Robuste, interpretable",          icon: <Brain className="h-4 w-4" /> },
  { value: "extratrees",       label: "Extra Trees",      desc: "Plus rapide que RF, moins de variance", icon: <Brain className="h-4 w-4" /> },
  { value: "xgboost",          label: "XGBoost",          desc: "Haute performance",               icon: <Sparkles className="h-4 w-4" /> },
  { value: "lightgbm",         label: "LightGBM",         desc: "Rapide, efficace",                icon: <Zap className="h-4 w-4" /> },
  { value: "gradientboosting", label: "Gradient Boosting",desc: "Boosting sklearn natif",          icon: <BarChart3 className="h-4 w-4" /> },
  { value: "svm",              label: "SVM",              desc: "Bon pour petits datasets",        icon: <Brain className="h-4 w-4" /> },
  { value: "knn",              label: "KNN",              desc: "Simple, intuitif",                icon: <Brain className="h-4 w-4" /> },
  { value: "decisiontree",     label: "Arbre de décision", desc: "Très interprétable",             icon: <Brain className="h-4 w-4" /> },
  { value: "logisticregression", label: "Rég. Logistique", desc: "Classification linéaire",      icon: <BarChart3 className="h-4 w-4" /> },
];

const GRID_SCORING_OPTIONS: Array<{ value: GridScoringOption; label: string; desc: string }> = [
  { value: "auto", label: "Auto", desc: "Choisit automatiquement selon le type de tâche" },
  { value: "roc_auc", label: "ROC AUC", desc: "Classification — aire sous la courbe ROC" },
  { value: "average_precision", label: "Avg Precision", desc: "Classification — PR-AUC, robuste aux déséquilibres" },
  { value: "f1_weighted", label: "F1 Weighted", desc: "Classification multi-classe pondérée" },
  { value: "r2", label: "R² Score", desc: "Régression uniquement" },
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
  const [cvFoldsError, setCvFoldsError] = useState<string | null>(null);

  const scoringOptions = useMemo(
    () =>
      GRID_SCORING_OPTIONS.filter((o) => {
        if (config.taskType === "regression") return o.value === "auto" || o.value === "r2";
        return o.value !== "r2";
      }),
    [config.taskType]
  );

  const handleCvFoldsChange = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) { setCvFoldsError("Valeur invalide"); return; }
    if (n < 2) { setCvFoldsError("Minimum 2 plis"); onConfigChange({ gridCvFolds: 2 }); return; }
    if (n > 10) { setCvFoldsError("Maximum 10 plis"); onConfigChange({ gridCvFolds: 10 }); return; }
    setCvFoldsError(null);
    onConfigChange({ gridCvFolds: n });
  };

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
  // Filter out fields that don't apply to the current task type (e.g. class_weight in regression).
  const activeModelFields = useMemo(
    () =>
      Object.entries(activeModelSchema).filter(([, fieldSchema]) => {
        const supportedIn = fieldSchema.supported_in;
        if (!supportedIn || supportedIn.length === 0) return true;
        return supportedIn.includes(config.taskType);
      }),
    [activeModelSchema, config.taskType]
  );
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
              {config.models.length} sélectionné{config.models.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                    {!m.installed && <p className="text-[11px] text-destructive mt-1">Non installé sur le backend</p>}
                  </div>
                </motion.label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={Boolean(hpModalModel)}
        onClose={() => setHpModalModel(null)}
        size="2xl"
        title={
          <span className="flex items-center gap-2 flex-wrap">
            Hyperparamètres
            <Badge variant="outline" className="uppercase text-[11px] font-semibold">
              {activeModel?.label ?? activeModelKey}
            </Badge>
            {(config.searchType ?? "none") !== "none" && (
              <Badge variant="secondary" className="text-[10px]">
                Listes : séparées par virgules
              </Badge>
            )}
          </span>
        }
        description={
          activeModelSelected
            ? "Modifiez les hyperparamètres du modèle sélectionné."
            : "Modèle non sélectionné : les valeurs seront conservées mais ignorées tant que le modèle n'est pas coché."
        }
      >
        {!activeModelFields.length ? (
          <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
            Aucun hyperparamètre configurable pour ce modèle.
          </div>
        ) : (
          <div className="space-y-3">
            {activeModelFields.map(([fieldName, fieldSchema]) => {
              const rawModelValue = modelHyperparams[activeModelKey]?.[fieldName];
              const displayValue = toDisplayText(rawModelValue, fieldSchema.default);
              const fieldType = String(fieldSchema.type ?? "").toLowerCase();
              const enumOptions = Array.isArray(fieldSchema.enum) ? fieldSchema.enum : [];
              const isSearchActive = (config.searchType ?? "none") !== "none";
              const isEnumSelect = !isSearchActive && fieldType === "enum";
              const isEnumOrNullSelect = !isSearchActive && fieldType === "enum_or_null";

              const enumOrNullValue =
                rawModelValue === null || rawModelValue === undefined
                  ? String(fieldSchema.default ?? "null")
                  : String(rawModelValue);

              const handleEnumOrNull = (next: string) => {
                setModelField(activeModelKey, fieldName, next === "null" ? null : next);
              };

              return (
                <div key={`${activeModelKey}-${fieldName}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs font-medium">{fieldName}</Label>
                    <span className="text-[11px] text-muted-foreground">
                      Défaut : {String(fieldSchema.default ?? "null")}
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
                          <SelectItem key={`${activeModelKey}-${fieldName}-${opt}`} value={String(opt)}>
                            {String(opt)}
                            {String(opt) === String(fieldSchema.default) && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">(défaut)</span>
                            )}
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
                          parseFieldValue(e.target.value, fieldSchema, isSearchActive)
                        )
                      }
                      className="h-8 text-xs"
                      placeholder={isSearchActive ? "ex: 100, 200" : `ex: ${String(fieldSchema.default ?? "")}`}
                    />
                  )}

                  {!!fieldSchema.help && <p className="text-[11px] text-muted-foreground">{fieldSchema.help}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Card className="glass-premium shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-primary/10">
                <Grid3X3 className="h-4 w-4 text-primary" />
              </div>
              Optimisation des hyperparamètres
              {(config.searchType ?? "none") !== "none" && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {config.gridCvFolds} folds
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="search-type" className="text-xs text-muted-foreground">Méthode de recherche</Label>
              <Select
                value={config.searchType ?? "none"}
                onValueChange={(v) => onConfigChange({
                  searchType: v as SearchType,
                  useGridSearch: v !== "none",
                })}
              >
                <SelectTrigger id="search-type" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span>Aucune</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Paramètres fixes uniquement</span>
                  </SelectItem>
                  <SelectItem value="grid">
                    <span>GridSearch</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Grille fixe, exhaustif</span>
                  </SelectItem>
                  <SelectItem value="random">
                    <span>RandomizedSearch</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Espace continu, plus efficace</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <AnimatePresence initial={false}>
              {(config.searchType ?? "none") !== "none" && (
                <motion.div
                  key="search-config"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-2 border-t border-border/40">
                    {config.searchType === "random" && (
                      <div className="space-y-1">
                        <Label htmlFor="n-iter" className="text-xs text-muted-foreground">Nombre d'itérations</Label>
                        <Input
                          id="n-iter"
                          type="number"
                          min={5}
                          max={300}
                          value={config.nIterRandomSearch ?? 40}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 5 && v <= 300) {
                              onConfigChange({ nIterRandomSearch: v });
                            }
                          }}
                          className="w-24 h-8 text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">Entre 5 et 300 (défaut : 40)</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="cv-folds" className="text-xs text-muted-foreground">Plis de validation croisée</Label>
                      <Input
                        id="cv-folds"
                        type="number"
                        min={2}
                        max={10}
                        value={config.gridCvFolds}
                        onChange={(e) => handleCvFoldsChange(e.target.value)}
                        className={cn("w-24 h-8 text-xs", cvFoldsError && "border-destructive")}
                      />
                      {cvFoldsError ? (
                        <p className="text-[11px] text-destructive">{cvFoldsError}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Entre 2 et 10 (défaut : 3)</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="gs-scoring" className="text-xs text-muted-foreground">Scoring</Label>
                      <Select
                        value={config.gridScoring}
                        onValueChange={(v) => onConfigChange({ gridScoring: v as GridScoringOption })}
                      >
                        <SelectTrigger id="gs-scoring" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scoringOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <span>{o.label}</span>
                              <span className="ml-2 text-[10px] text-muted-foreground">{o.desc}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {config.models.length >= 3 && (
                      <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 text-[11px] flex items-start gap-2 text-amber-800 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {config.searchType === "random"
                            ? `RandomizedSearch avec ${config.models.length} modèles × ${config.nIterRandomSearch ?? 40} itérations`
                            : `GridSearch avec ${config.models.length} modèles × ${config.gridCvFolds} plis`}{" "}
                          peut significativement allonger le temps d'entraînement.
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
    </div>
  );
}

export default Step4Models;
