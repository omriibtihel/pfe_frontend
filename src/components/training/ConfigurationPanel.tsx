import { Settings, Target, Cpu, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TrainingConfig } from "@/types";

interface ConfigurationPanelProps {
  config: TrainingConfig;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
  columns: string[];
  columnsLoading: boolean;
}

export function ConfigurationPanel({ config, onConfigChange, columns, columnsLoading }: ConfigurationPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          Configuration générale
        </CardTitle>
        <p className="text-sm text-muted-foreground">Définissez les paramètres de base</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Target column */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Variable cible
          </label>

          <Select
            value={config.targetColumn}
            onValueChange={(v) => onConfigChange({ targetColumn: v })}
            disabled={columnsLoading || columns.length === 0}
          >
            <SelectTrigger className="h-11">
              <SelectValue
                placeholder={
                  columnsLoading
                    ? "Chargement des colonnes..."
                    : columns.length === 0
                      ? "Aucune colonne disponible"
                      : "Sélectionner la colonne cible"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {columns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground flex items-center gap-2">
            {columnsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            La colonne que le modèle doit prédire
          </p>
        </div>

        {/* Task type */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Type de tâche
          </label>
          <Select
            value={config.taskType}
            onValueChange={(v: "classification" | "regression") => onConfigChange({ taskType: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classification">
                <div className="flex flex-col items-start">
                  <span>Classification</span>
                  <span className="text-xs text-muted-foreground">Prédire des catégories</span>
                </div>
              </SelectItem>
              <SelectItem value="regression">
                <div className="flex flex-col items-start">
                  <span>Régression</span>
                  <span className="text-xs text-muted-foreground">Prédire des valeurs continues</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
