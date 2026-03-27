import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, Target, Table2, Columns, Rows3, TrendingUp, Tags, Flag, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import type { TrainingConfig, DatasetColumn } from "@/types";
import { dataService, type VersionUI } from "@/services/dataService";

type DistributionBar = { label: string; count: number };
type DistributionData = { type: "categorical" | "histogram"; total: number; bars: DistributionBar[] } | null;

/** Infer task type from the selected target column. */
function inferTaskType(col: DatasetColumn | undefined): 'classification' | 'regression' {
  if (!col) return 'classification';
  // Numeric column with many distinct values → regression; categorical or few uniques → classification.
  return col.type === 'numeric' && col.uniqueCount > 10 ? 'regression' : 'classification';
}

interface Step1Props {
  projectId: string;
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

export function Step1DatasetTarget({ projectId, config, onConfigChange }: Step1Props) {
  const [versions, setVersions] = useState<VersionUI[]>([]);
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [dataset, setDataset] = useState<{ rowCount: number; columnCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetValues, setTargetValues] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<DistributionData>(null);

  // 1) Load versions list
  useEffect(() => {
    const loadVersions = async () => {
      if (!projectId) return;

      setLoading(true);
      try {
        const vers = await dataService.getVersions(projectId);
        setVersions(vers);

        // auto-select first version if none selected
        if (!config.datasetVersionId && vers.length > 0) {
          onConfigChange({
            datasetVersionId: String(vers[0].id),
            targetColumn: "",
            positiveLabel: null,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 2) Load dataset summary + columns from columns-meta for selected version
  useEffect(() => {
    const loadVersionData = async () => {
      if (!projectId || !config.datasetVersionId) return;

      setLoading(true);
      try {
        const [summary, cols] = await Promise.all([
          dataService.getVersionTrainingSummary(projectId, config.datasetVersionId),
          dataService.getVersionTrainingColumns(projectId, config.datasetVersionId),
        ]);

        setDataset({ rowCount: summary.rowCount, columnCount: summary.columnCount });
        setColumns(cols);

        // If current target doesn't exist anymore, reset it
        if (config.targetColumn && !cols.some((c) => c.name === config.targetColumn)) {
          onConfigChange({ targetColumn: "" });
        }

        // Optional convenience: if target empty, try version.targetColumn stored in DB
        if (!config.targetColumn) {
          const picked = versions.find((v) => String(v.id) === String(config.datasetVersionId));
          if (picked?.targetColumn && cols.some((c) => c.name === picked.targetColumn)) {
            onConfigChange({ targetColumn: picked.targetColumn });
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadVersionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, config.datasetVersionId]);

  // 3) Load unique values + distribution for the selected target column
  useEffect(() => {
    if (!config.datasetVersionId || !config.targetColumn) {
      setTargetValues([]);
      setDistribution(null);
      return;
    }
    dataService
      .getVersionColumnValues(projectId, config.datasetVersionId, config.targetColumn)
      .then(setTargetValues)
      .catch(() => setTargetValues([]));
    dataService
      .getVersionColumnDistribution(projectId, config.datasetVersionId, config.targetColumn)
      .then(setDistribution)
      .catch(() => setDistribution(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, config.datasetVersionId, config.targetColumn]);

  const handleVersionChange = useCallback((v: string) => {
    onConfigChange({ datasetVersionId: v, targetColumn: "", positiveLabel: null });
  }, [onConfigChange]);

  const handleTargetChange = useCallback((v: string) => {
    const col = columns.find((c) => c.name === v);
    onConfigChange({ targetColumn: v, positiveLabel: null, taskType: inferTaskType(col) });
  }, [columns, onConfigChange]);

  const selectedColumns = useMemo(() => {
    return columns.filter((c) => c.name !== config.targetColumn);
  }, [columns, config.targetColumn]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dataset Version */}
        <Card className="glass-premium shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-primary/10">
                <Database className="h-4 w-4 text-primary" />
              </div>
              Version du dataset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={config.datasetVersionId ? String(config.datasetVersionId) : ""}
              onValueChange={handleVersionChange}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Sélectionner une version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => {
                  const isOriginal = v.operations.includes("original");
                  return (
                    <SelectItem key={String(v.id)} value={String(v.id)}>
                      <div className="flex items-center gap-2">
                        <span>{v.name}</span>
                        {isOriginal ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Brut
                          </Badge>
                        ) : v.canPredict ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Prêt
                          </Badge>
                        ) : null}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">Choisir la version du dataset utilisée pour l'entraînement</p>
          </CardContent>
        </Card>

        {/* Target Column */}
        <Card className="glass-premium shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-secondary/10">
                <Target className="h-4 w-4 text-secondary" />
              </div>
              Variable cible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={config.targetColumn || ""}
              onValueChange={handleTargetChange}
              disabled={!columns.length}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Colonne à prédire" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    <div className="flex items-center gap-2">
                      <span>{c.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {c.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">La colonne que le modèle doit prédire</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Type selector — shown once a target column is selected */}
      {config.targetColumn && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-2 rounded-xl bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                Type de tâche
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {(["classification", "regression"] as const).map((type) => {
                  const active = config.taskType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onConfigChange({ taskType: type, positiveLabel: null })}
                      className={[
                        "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card/50 hover:border-primary/50",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        {type === "classification" ? (
                          <Tags className="h-4 w-4 text-primary" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-secondary" />
                        )}
                        <span className="font-semibold capitalize text-sm">
                          {type === "classification" ? "Classification" : "Régression"}
                        </span>
                        {active && (
                          <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                            Sélectionné
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {type === "classification"
                          ? "Prédire une catégorie (ex : malade / sain, 0/1/2…)"
                          : "Prédire une valeur continue (ex : âge, pression artérielle…)"}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Auto-détecté d'après le type de la colonne cible. Vous pouvez modifier.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Positive label selector — shown for binary classification */}
      {config.targetColumn && config.taskType === "classification" && targetValues.length >= 2 && targetValues.length <= 20 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-2 rounded-xl bg-accent/10">
                  <Flag className="h-4 w-4 text-accent" />
                </div>
                Classe positive
                {targetValues.length === 2 && (
                  <Badge variant="outline" className="text-[10px]">Binaire</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={config.positiveLabel != null ? String(config.positiveLabel) : "__none__"}
                onValueChange={(v) =>
                  onConfigChange({ positiveLabel: v === "__none__" ? null : v })
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choisir la classe positive (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Auto (non défini)</span>
                  </SelectItem>
                  {targetValues.map((val) => (
                    <SelectItem key={val} value={val}>
                      {val}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Recommandé pour stabiliser ROC-AUC, PR-AUC et F1 sur les datasets binaires non {"{0,1}"}.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Target distribution chart */}
      {distribution && config.targetColumn && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-premium shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-2 rounded-xl bg-primary/10">
                  <BarChart2 className="h-4 w-4 text-primary" />
                </div>
                Distribution de la variable cible
                <Badge variant="outline" className="text-[10px]">
                  {distribution.type === "categorical" ? "Catégorielle" : "Continue"}
                </Badge>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {distribution.total.toLocaleString()} lignes
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={distribution.bars} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={distribution.bars.length > 12 ? "preserveStartEnd" : 0}
                  />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <RechartsTooltip
                    formatter={(value: number) => [value.toLocaleString(), "Lignes"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.bars.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={`hsl(${(idx * 47) % 360} 65% 55%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dataset Summary */}
      {dataset && config.targetColumn && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="gradient-subtle border-primary/10">
            <CardContent className="py-5">
              <div className="flex flex-wrap items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Rows3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lignes</p>
                    <p className="text-lg font-bold text-foreground">{dataset.rowCount.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Columns className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Colonnes</p>
                    <p className="text-lg font-bold text-foreground">{dataset.columnCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Table2 className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Features</p>
                    <p className="text-lg font-bold text-foreground">{selectedColumns.length}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Aperçu des features</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedColumns.slice(0, 10).map((c) => (
                    <Badge key={c.name} variant="outline" className="text-xs font-normal">
                      {c.name}
                      <span className="ml-1 text-muted-foreground">({c.type})</span>
                    </Badge>
                  ))}
                  {selectedColumns.length > 10 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedColumns.length - 10}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
