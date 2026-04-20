import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Info, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MedHelp } from "@/components/ui/med-help";
import { trainingService } from "@/services/trainingService";
import type {
  ModelHyperparamValue,
  ModelType,
  TrainingConfig,
  TrainingHyperparamFieldSchema,
} from "@/types";
import { cn } from "@/lib/utils";
import { MODEL_CATALOG, type ModelCatalogEntry } from "./step4/ModelCatalog";
import { normalizeModelKey } from "./step4/modelHpHelpers";
import { HyperparamModal } from "./step4/HyperparamModal";
import { GridSearchConfig } from "./step4/GridSearchConfig";

interface Step4Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

type ModelCardOption = ModelCatalogEntry & {
  installed: boolean;
  supportedTasks: string[];
};

export function Step4Models({ projectId, config, onConfigChange }: Step4Props) {
  const [availableModels, setAvailableModels] = useState<ModelCardOption[]>(
    MODEL_CATALOG.map((m) => ({ ...m, installed: true, supportedTasks: m.supportedTasks ?? ["classification", "regression"] }))
  );
  const [modelHpSchema, setModelHpSchema] = useState<Record<string, Record<string, TrainingHyperparamFieldSchema>>>({});
  const [hpModalModel, setHpModalModel] = useState<string | null>(null);

  const hasAnyCustomHp = useMemo(
    () => Object.values(config.modelHyperparams ?? {}).some((hp) => Object.keys(hp ?? {}).length > 0),
    [config.modelHyperparams]
  );

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
          MODEL_CATALOG.map((m) => ({
            ...m,
            installed: installedByModel.has(m.value) ? Boolean(installedByModel.get(m.value)) : true,
            supportedTasks: tasksByModel.get(m.value) ?? m.supportedTasks ?? ["classification", "regression"],
          }))
        );
      } catch {
        if (!mounted) return;
        setAvailableModels(MODEL_CATALOG.map((m) => ({ ...m, installed: true, supportedTasks: m.supportedTasks ?? ["classification", "regression"] })));
        setModelHpSchema({});
      }
    };
    if (String(projectId ?? "").trim()) {
      loadCapabilities();
    }
    return () => { mounted = false; };
  }, [projectId]);

  const modelHyperparams = config.modelHyperparams ?? {};
  const activeModelKey = hpModalModel ? normalizeModelKey(hpModalModel) : "";
  const activeModel = useMemo(
    () => availableModels.find((m) => normalizeModelKey(m.value) === activeModelKey) ?? null,
    [activeModelKey, availableModels]
  );
  const activeModelSchema = modelHpSchema[activeModelKey] ?? {};
  const activeModelSelected = useMemo(
    () => (config.models ?? []).some((m) => normalizeModelKey(m) === activeModelKey),
    [activeModelKey, config.models]
  );

  const setModelField = (modelKey: string, fieldName: string, value: ModelHyperparamValue | undefined) => {
    const nextHyperparams: Record<string, Record<string, ModelHyperparamValue>> = { ...(modelHyperparams ?? {}) };
    const currentModelFields: Record<string, ModelHyperparamValue> = { ...(nextHyperparams[modelKey] ?? {}) };
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
    onConfigChange({ models: nextModels });
  };

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
                      <span className="text-primary"><m.Icon className="h-4 w-4" /></span>
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

      <HyperparamModal
        isOpen={Boolean(hpModalModel)}
        onClose={() => setHpModalModel(null)}
        modelKey={activeModelKey}
        modelLabel={activeModel?.label ?? null}
        modelSelected={activeModelSelected}
        fieldSchemas={activeModelSchema}
        modelHyperparams={modelHyperparams}
        taskType={config.taskType}
        searchType={config.searchType}
        onSetField={setModelField}
      />

      <GridSearchConfig
        config={config}
        hasAnyCustomHp={hasAnyCustomHp}
        onConfigChange={onConfigChange}
      />
    </div>
  );
}

export default Step4Models;
