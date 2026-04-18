import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, Brain, Grid3X3, Info, MoreHorizontal, Sparkles, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedHelp } from "@/components/ui/med-help";
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
  clinicalTip: string;
  icon: ReactNode;
  installed: boolean;
  supportedTasks: string[];
};

const modelCatalog: Array<{ value: ModelType; label: string; desc: string; clinicalTip: string; icon: ReactNode; supportedTasks?: string[] }> = [
  {
    value: "randomforest",
    label: "Forêt Aléatoire",
    desc: "Excellent point de départ — robuste aux données bruitées",
    clinicalTip: "Combine 100+ arbres de décision qui « votent » ensemble, comme un comité d'experts. Très résistant aux valeurs aberrantes. Indique quelles variables biologiques ont le plus influencé la prédiction. Recommandé pour commencer.",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "extratrees",
    label: "Extra Trees",
    desc: "Version rapide de la Forêt Aléatoire",
    clinicalTip: "Identique à la Forêt Aléatoire mais entraîné plus rapidement. Légèrement moins précis sur petits datasets. Utile quand le temps d'entraînement est long.",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "xgboost",
    label: "XGBoost",
    desc: "Très performant sur données cliniques structurées",
    clinicalTip: "Construit des arbres successifs, chacun corrigeant les erreurs du précédent. Souvent le plus précis sur des données tabulaires (biologie, scores cliniques). Largement utilisé dans les études médicales publiées.",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: "lightgbm",
    label: "LightGBM",
    desc: "Même précision que XGBoost, entraînement plus rapide",
    clinicalTip: "Variante optimisée de XGBoost pour les grandes bases de données (>10 000 patients). À préférer quand l'entraînement prend trop de temps.",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    value: "catboost",
    label: "CatBoost",
    desc: "Idéal pour variables textuelles (sexe, diagnostic, groupe)",
    clinicalTip: "Gère nativement les variables catégorielles (ex : sexe, groupe sanguin, statut tabagique) sans transformation préalable. Moins sensible au prétraitement.",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: "gradientboosting",
    label: "Gradient Boosting",
    desc: "Alternative stable à XGBoost",
    clinicalTip: "Même principe que XGBoost mais version classique, bien documentée et stable. Plus lent mais fiable. Bon choix si XGBoost donne des résultats instables.",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    value: "svm",
    label: "SVM",
    desc: "Efficace sur petites cohortes (<2 000 patients)",
    clinicalTip: "Cherche la frontière optimale entre les classes (malade/sain). Très performant quand les données sont peu nombreuses et bien séparables. Moins adapté aux grandes bases.",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "knn",
    label: "K Plus Proches Voisins",
    desc: "Diagnostic par analogie avec des cas similaires",
    clinicalTip: "Prédit en cherchant les patients les plus similaires dans la base d'entraînement : « les 5 patients les plus proches avaient ce diagnostic ». Simple mais peut être lent sur grandes bases.",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "mlp",
    label: "Réseau de Neurones (MLP)",
    desc: "Réseau multicouche — classification et régression",
    clinicalTip: "Réseau de neurones artificiel classique (perceptron multicouche). Peut modéliser des relations non-linéaires complexes entre variables biologiques. Bon complément aux arbres de décision. Nécessite une normalisation des données et plus de données qu'un modèle linéaire.",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    value: "naivebayes",
    label: "Naive Bayes",
    desc: "Rapide et robuste — idéal pour petits datasets",
    clinicalTip: "Basé sur le théorème de Bayes : calcule la probabilité de chaque diagnostic en supposant que les variables sont indépendantes. Très rapide à entraîner, performant sur de petits datasets médicaux. Moins précis quand les variables sont fortement corrélées entre elles.",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "decisiontree",
    label: "Arbre de Décision",
    desc: "Règles lisibles pas à pas — idéal pour l'audit clinique",
    clinicalTip: "Produit des règles explicites du type « Si Valeur A > X et Valeur B < Y → Diagnostic Z ». Le seul modèle dont un clinicien peut suivre le raisonnement. Recommandé si l'explicabilité réglementaire est prioritaire. Moins précis que les ensembles.",
    icon: <Brain className="h-4 w-4" />,
  },
  {
    value: "logisticregression",
    label: "Régression Logistique",
    desc: "Score de risque interprétable — gold standard médical",
    clinicalTip: "Calcule une probabilité à partir de chaque variable avec un coefficient lisible. Standard dans les scores cliniques (Framingham, GRACE, CHA₂DS₂-VASc). Chaque coefficient indique l'impact de chaque variable. Recommandé quand la transparence est critique.",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    value: "elasticnet",
    label: "ElasticNet",
    desc: "Régression L1+L2 — sélection de variables + régularisation",
    clinicalTip: "Combine Ridge (L2) et Lasso (L1) : réduit les coefficients et peut en annuler certains. Idéal pour des données avec de nombreuses variables corrélées (biomarqueurs, scores biologiques multiples). Régression uniquement.",
    icon: <BarChart3 className="h-4 w-4" />,
    supportedTasks: ["regression"],
  },
  {
    value: "lasso",
    label: "Lasso",
    desc: "Régression avec sélection automatique de variables (L1)",
    clinicalTip: "Met les coefficients des variables non-informatives exactement à zéro → sélection automatique des variables les plus pertinentes. Très utile quand peu de biomarqueurs parmi beaucoup sont réellement prédictifs. Régression uniquement.",
    icon: <BarChart3 className="h-4 w-4" />,
    supportedTasks: ["regression"],
  },
];

const GRID_SCORING_OPTIONS: Array<{ value: GridScoringOption; label: string; desc: string }> = [
  { value: "auto",               label: "Auto (recommandé)",  desc: "Le système choisit la métrique la plus adaptée à vos données" },
  { value: "roc_auc",            label: "Capacité discriminante (ROC AUC)", desc: "Mesure la capacité à séparer malades/sains — bon choix général" },
  { value: "average_precision",  label: "Détection de cas rares (PR AUC)", desc: "Recommandé si la maladie est rare — moins trompé par le déséquilibre" },
  { value: "f1_weighted",        label: "Équilibre global (F1)",            desc: "Compromis entre sensibilité et précision — bon pour multiclasse" },
  { value: "r2",                 label: "Variance expliquée (R²)",          desc: "Pour les prédictions numériques uniquement (régression)" },
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

/** Convert a grid_value to a string key usable in a Select / as chip id. */
function gridValKey(v: number | string | null): string {
  return v === null ? "__null__" : String(v);
}

/** Convert the string key back to the typed scalar. */
function gridValFromKey(key: string, fieldSchema: TrainingHyperparamFieldSchema): ModelHyperparamScalar {
  if (key === "__null__") return null;
  return parseScalarToken(key, fieldSchema);
}


export function Step4Models({ projectId, config, onConfigChange }: Step4Props) {
  const [availableModels, setAvailableModels] = useState<ModelCardOption[]>(
    modelCatalog.map((m) => ({ ...m, installed: true, supportedTasks: m.supportedTasks ?? ["classification", "regression"] }))
  );
  const [modelHpSchema, setModelHpSchema] = useState<Record<string, Record<string, TrainingHyperparamFieldSchema>>>({});
  const [hpModalModel, setHpModalModel] = useState<string | null>(null);
  const [cvFoldsError, setCvFoldsError] = useState<string | null>(null);

  const isSearchActive = (config.searchType ?? "none") !== "none";
  const isRandomOrHalvingMode = config.searchType === "random" || config.searchType === "halving_random";
  const searchTypeLabel =
    config.searchType === "grid" ? "GridSearch" :
    config.searchType === "random" ? "Random Search" : "Successive Halving";
  const hasAnyCustomHp = useMemo(
    () => Object.values(config.modelHyperparams ?? {}).some((hp) => Object.keys(hp ?? {}).length > 0),
    [config.modelHyperparams]
  );
  const hasConflict = hasAnyCustomHp && isSearchActive;
  const clearAllCustomHp = () => onConfigChange({ modelHyperparams: {} });

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
    if (n > 20) { setCvFoldsError("Maximum 20 plis"); onConfigChange({ gridCvFolds: 20 }); return; }
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
        const tasksByModel = new Map<string, string[]>();
        for (const item of caps.availableModels ?? []) {
          const key = normalizeModelKey(item.key ?? item.name);
          if (!key) continue;
          installedByModel.set(key, Boolean(item.installed));
          if (Array.isArray(item.tasks) && item.tasks.length > 0) {
            tasksByModel.set(key, item.tasks as string[]);
          }
        }

        setAvailableModels(
          modelCatalog.map((m) => ({
            ...m,
            installed: installedByModel.has(m.value) ? Boolean(installedByModel.get(m.value)) : true,
            supportedTasks: tasksByModel.get(m.value) ?? m.supportedTasks ?? ["classification", "regression"],
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

  // Only show models that support the current task type (e.g. hide ElasticNet/Lasso for classification)
  const visibleModels = availableModels.filter((m) =>
    m.supportedTasks.includes(config.taskType ?? "classification")
  );

  return (
    <div className="space-y-6">
      {/* ── Bannière de guidance clinique ── */}
      <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20 p-4 flex gap-3">
        <Info className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
        <div className="space-y-1.5 text-[12px] text-sky-800 dark:text-sky-300">
          <p className="font-semibold">Comment choisir ?</p>
          <ul className="space-y-1 text-sky-700 dark:text-sky-400">
            <li>• <strong>Pour commencer</strong> : sélectionnez <em>Forêt Aléatoire + XGBoost + Régression Logistique</em> — le système les comparera et présentera le meilleur résultat.</li>
            <li>• <strong>Explicabilité requise</strong> (audit, réglementaire) : ajoutez <em>Arbre de Décision</em> ou <em>Régression Logistique</em>.</li>
            <li>• <strong>Peu de patients (&lt; 500)</strong> : préférez <em>SVM</em> ou <em>Régression Logistique</em>.</li>
            <li>• <strong>Variables catégorielles</strong> (sexe, groupe sanguin…) : ajoutez <em>CatBoost</em>.</li>
          </ul>
        </div>
      </div>

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            Algorithmes d'apprentissage
            <MedHelp title="Qu'est-ce qu'un algorithme ?" side="bottom">
              <p>Un algorithme est une méthode mathématique qui apprend à reconnaître des schémas dans vos données pour faire des prédictions.</p>
              <p className="mt-1">Chaque algorithme a ses forces : certains sont plus précis, d'autres plus rapides, d'autres plus faciles à expliquer à un comité d'éthique.</p>
              <p className="mt-1">Il est recommandé d'en sélectionner plusieurs — le système les comparera automatiquement.</p>
            </MedHelp>
            <Badge variant="secondary" className="ml-auto text-xs">
              {config.models.length} sélectionné{config.models.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleModels.map((m, i) => {
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-primary">{m.icon}</span>
                      <span className="font-semibold text-sm">{m.label}</span>
                      <MedHelp title={m.label} side="bottom">
                        <p>{m.clinicalTip}</p>
                      </MedHelp>
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
            : activeModelSelected
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
              const rawModelValue = modelHyperparams[activeModelKey]?.[fieldName];
              const displayValue = toDisplayText(rawModelValue, fieldSchema.default);
              const fieldType = String(fieldSchema.type ?? "").toLowerCase();
              const enumOptions = Array.isArray(fieldSchema.enum) ? fieldSchema.enum : [];
              const gridValues = Array.isArray(fieldSchema.grid_values) ? fieldSchema.grid_values : [];
              const hasGridValues = gridValues.length > 0;

              // enum / enum_or_null always use a <Select> regardless of search mode
              const isEnumSelect = fieldType === "enum";
              const isEnumOrNullSelect = fieldType === "enum_or_null";

              const enumOrNullValue =
                rawModelValue === null || rawModelValue === undefined
                  ? String(fieldSchema.default ?? "null")
                  : String(rawModelValue);

              const handleEnumOrNull = (next: string) => {
                setModelField(activeModelKey, fieldName, next === "null" ? null : next);
              };

              // Single-value select helpers (fixed mode + numeric/float field with grid_values)
              const singleSelectValue = (() => {
                if (rawModelValue === undefined || rawModelValue === null) {
                  return gridValKey(fieldSchema.default as number | string | null);
                }
                return Array.isArray(rawModelValue)
                  ? gridValKey(rawModelValue[0] as number | string | null)
                  : gridValKey(rawModelValue as number | string | null);
              })();

              // Human-friendly label mapping for technical hyperparameter names
              const friendlyLabel: Record<string, string> = {
                n_estimators: "Nombre d'arbres",
                max_depth: "Profondeur maximale",
                min_samples_split: "Séparation minimale",
                min_samples_leaf: "Feuilles minimales",
                C: "Force de régularisation (C)",
                gamma: "Gamma (SVM)",
                kernel: "Noyau (SVM)",
                n_neighbors: "Nombre de voisins",
                learning_rate: "Taux d'apprentissage",
                max_iter: "Iterations maximales",
                class_weight: "Poids des classes",
                alpha: "Régularisation (alpha)",
                max_features: "Variables par division",
                subsample: "Fraction de données",
                colsample_bytree: "Fraction de variables (arbre)",
                min_child_weight: "Poids minimal d'un nœud",
                reg_alpha: "Régularisation L1",
                reg_lambda: "Régularisation L2",
                num_leaves: "Feuilles par arbre",
                var_smoothing: "Lissage de variance",
                hidden_layer_sizes: "Architecture (couches)",
                activation: "Fonction d'activation",
                learning_rate_init: "Taux d'apprentissage",
                l1_ratio: "Ratio L1/L2",
              };
              const displayLabel = friendlyLabel[fieldName] ?? fieldName;

              return (
                <div key={`${activeModelKey}-${fieldName}`} className="space-y-1">
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
                    // ── Enum dropdown (always single select) ────────────────
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
                    // ── Enum-or-null dropdown ────────────────────────────────
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
                  ) : hasGridValues && !isSearchActive ? (
                    // ── Numeric field — fixed mode → single-value Select ─────
                    <Select
                      value={singleSelectValue}
                      onValueChange={(key) =>
                        setModelField(activeModelKey, fieldName, gridValFromKey(key, fieldSchema))
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
                    // ── Numeric field — tout mode search → lecture seule ─────
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
                        {config.searchType === "grid"
                          ? "Grille du backend — non modifiable en mode GridSearch"
                          : `Distribution continue — non modifiable en mode ${config.searchType === "halving_random" ? "Successive Halving" : "Random Search"}`}
                      </p>
                    </div>
                  ) : (
                    // ── Fallback: Input (champ sans grid_values) ─────────────
                    <Input
                      type={fieldType === "int" || fieldType === "float" ? "number" : "text"}
                      value={displayValue}
                      disabled={isSearchActive}
                      onChange={(e) =>
                        !isSearchActive && setModelField(
                          activeModelKey,
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

      <Card className="glass-premium shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-primary/10">
                <Grid3X3 className="h-4 w-4 text-primary" />
              </div>
              Réglages fins (optionnel)
              <MedHelp title="Réglages fins des algorithmes" side="bottom">
                <p>Chaque algorithme possède des « réglages » (hyperparamètres) qui influencent ses performances, comme la profondeur d'une analyse ou le nombre d'arbres.</p>
                <p className="mt-1">Cette section est <strong>optionnelle</strong> : les valeurs par défaut fonctionnent bien dans la plupart des cas. Laissez sur <em>Aucune</em> pour votre premier entraînement.</p>
                <p className="mt-1">Si vous souhaitez améliorer les résultats, activez la recherche automatique — le système testera différentes combinaisons et gardera la meilleure.</p>
              </MedHelp>
              {(config.searchType ?? "none") !== "none" && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {config.gridCvFolds} plis
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="search-type" className="text-xs text-muted-foreground">Recherche automatique de réglages</Label>
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
                    <span>Aucune (recommandé)</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Valeurs par défaut — rapide</span>
                  </SelectItem>
                  <SelectItem value="grid">
                    <span>Grille complète</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Teste toutes les combinaisons — thorough mais lent</span>
                  </SelectItem>
                  <SelectItem value="random">
                    <span>Recherche aléatoire</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Teste des combinaisons au hasard — bon équilibre vitesse/précision</span>
                  </SelectItem>
                  <SelectItem value="halving_random">
                    <span>Élimination progressive</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">Élimine rapidement les mauvaises options — le plus rapide</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasConflict && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold">Configuration HP personnalisée ignorée</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-500">
                      Le mode <strong>{searchTypeLabel}</strong> utilise {isRandomOrHalvingMode ? "des distributions continues définies par le backend" : "la grille du backend"} — vos réglages HP personnalisés ne seront pas appliqués. Choisissez l'une des deux options :
                    </p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] border-amber-400/60 text-amber-800 hover:bg-amber-100/80 dark:text-amber-400 dark:hover:bg-amber-900/30"
                        onClick={clearAllCustomHp}
                      >
                        Effacer la config HP et rester en mode {searchTypeLabel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] border-amber-400/60 text-amber-800 hover:bg-amber-100/80 dark:text-amber-400 dark:hover:bg-amber-900/30"
                        onClick={() => onConfigChange({ searchType: "none", useGridSearch: false })}
                      >
                        Revenir au mode Aucune (garder mes valeurs fixes)
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    {(config.searchType === "random" || config.searchType === "halving_random") && (
                      <div className="space-y-1">
                        <Label htmlFor="n-iter" className="text-xs text-muted-foreground">
                          {config.searchType === "halving_random" ? "Candidats initiaux" : "Nombre d'itérations"}
                        </Label>
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
                        <p className="text-[11px] text-muted-foreground">
                          {config.searchType === "halving_random"
                            ? "Candidats de départ — éliminés par tiers à chaque round (défaut : 60)"
                            : "Entre 5 et 300 (défaut : 40)"}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="cv-folds" className="text-xs text-muted-foreground">Divisions de validation interne</Label>
                        <MedHelp title="Divisions de validation" side="top">
                          <p>Le système divise vos données en <em>N</em> parties pour évaluer chaque combinaison de réglages sans toucher aux données de test finales.</p>
                          <p className="mt-1"><strong>5 divisions</strong> = standard recommandé pour la plupart des cas.</p>
                          <p className="mt-1">Plus de divisions = évaluation plus fiable mais entraînement plus long.</p>
                        </MedHelp>
                      </div>
                      <Input
                        id="cv-folds"
                        type="number"
                        min={2}
                        max={20}
                        value={config.gridCvFolds}
                        onChange={(e) => handleCvFoldsChange(e.target.value)}
                        className={cn("w-24 h-8 text-xs", cvFoldsError && "border-destructive")}
                      />
                      {cvFoldsError ? (
                        <p className="text-[11px] text-destructive">{cvFoldsError}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Recommandé : 5 (entre 2 et 20)</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="gs-scoring" className="text-xs text-muted-foreground">Critère d'optimisation</Label>
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
                            : config.searchType === "halving_random"
                            ? `Successive Halving avec ${config.models.length} modèles (${config.nIterRandomSearch ?? 60} candidats initiaux)`
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
