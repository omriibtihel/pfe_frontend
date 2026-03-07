import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, Target, Table2, Columns, Rows3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import type { TrainingConfig, DatasetColumn } from "@/types";
import { dataService, type VersionUI } from "@/services/dataService";

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

  const handleVersionChange = useCallback((v: string) => {
    onConfigChange({ datasetVersionId: v, targetColumn: "", positiveLabel: null });
  }, [onConfigChange]);

  const handleTargetChange = useCallback((v: string) => {
    onConfigChange({ targetColumn: v, positiveLabel: null });
  }, [onConfigChange]);

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
              Dataset Version
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
                {versions.map((v) => (
                  <SelectItem key={String(v.id)} value={String(v.id)}>
                    <div className="flex items-center gap-2">
                      <span>{v.name}</span>
                      {v.canPredict && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Ready
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
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
