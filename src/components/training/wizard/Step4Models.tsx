import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { motion } from "framer-motion";
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
  const { t } = useTranslation();
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
          <p className="font-semibold">{t("training.step4.guidanceTitle")}</p>
          <ul className="space-y-1 text-sky-700 dark:text-sky-400">
            <li>• <Trans i18nKey="training.step4.guidance1" components={{ strong: <strong />, em: <em /> }} /></li>
            <li>• <Trans i18nKey="training.step4.guidance2" components={{ strong: <strong />, em: <em /> }} /></li>
            <li>• <Trans i18nKey="training.step4.guidance3" components={{ strong: <strong />, em: <em /> }} /></li>
            <li>• <Trans i18nKey="training.step4.guidance4" components={{ strong: <strong />, em: <em /> }} /></li>
          </ul>
        </div>
      </div>

      <Card className="glass-premium shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-xl bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            {t("training.step4.cardTitle")}
            <MedHelp title={t("training.step4.helpTitle")} side="bottom">
              <p>{t("training.step4.helpP1")}</p>
              <p className="mt-1">{t("training.step4.helpP2")}</p>
              <p className="mt-1">{t("training.step4.helpP3")}</p>
            </MedHelp>
            <Badge variant="secondary" className="ml-auto text-xs">
              {t(
                config.models.length > 1 ? "training.step4.selectedCountOther" : "training.step4.selectedCountOne",
                { n: config.models.length }
              )}
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
                  data-tour={`train-model-${m.value}`}
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
                      aria-label={t("training.step4.configureHp", { label: t(`training.models.${m.value}.label`, m.label) })}
                      title={t("training.step4.hpTooltip")}
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
                      <span className="font-semibold text-sm">{t(`training.models.${m.value}.label`, m.label)}</span>
                      <MedHelp title={t(`training.models.${m.value}.label`, m.label)} side="bottom">
                        <p>{t(`training.models.${m.value}.tip`, m.clinicalTip)}</p>
                      </MedHelp>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t(`training.models.${m.value}.desc`, m.desc)}</p>
                    {!m.installed && <p className="text-[11px] text-destructive mt-1">{t("training.step4.notInstalled")}</p>}
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
        modelLabel={activeModel ? t(`training.models.${activeModel.value}.label`, activeModel.label) : null}
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
