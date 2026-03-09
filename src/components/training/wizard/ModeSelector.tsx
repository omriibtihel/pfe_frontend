/**
 * ModeSelector — Step 0 (shown before the wizard steps)
 * Lets the user choose between:
 *   - AutoML mode: FLAML handles the full pipeline automatically.
 *   - Manual / custom mode: the user configures everything step by step.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  SlidersHorizontal,
  CheckCircle2,
  Info,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import type { TrainingMode, TrainingConfig } from "@/types";
import { AutoMLConfigPanel } from "./AutoMLConfigPanel";
import type { TrainingSession } from "@/services/trainingService";

interface ModeSelectorProps {
  projectId: string;
  config: TrainingConfig;
  onModeSelected: (mode: TrainingMode) => void;
  onAutoMLSessionStarted: (session: TrainingSession) => void;
}

export function ModeSelector({
  projectId,
  config,
  onModeSelected,
  onAutoMLSessionStarted,
}: ModeSelectorProps) {
  const [showAutoMLPanel, setShowAutoMLPanel] = useState(false);

  const canStart = !!config.datasetVersionId && !!config.targetColumn;

  function handleAutoML() {
    if (!canStart) return;
    setShowAutoMLPanel(true);
    onModeSelected("automl");
  }

  function handleManual() {
    setShowAutoMLPanel(false);
    onModeSelected("manual");
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Comment voulez-vous entraîner ?</h2>
        <p className="text-muted-foreground text-sm">
          Choisissez un mode. Vous pouvez revenir en arrière avant le lancement.
        </p>
      </div>

      {!canStart && (
        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Sélectionnez une version de dataset et une colonne cible à l'étape 1 avant de
            continuer.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* AutoML card */}
        <Card
          className={`cursor-pointer border-2 transition-colors hover:border-primary/60 hover:bg-primary/5 ${
            !canStart ? "opacity-50 pointer-events-none" : ""
          }`}
          onClick={handleAutoML}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              AutoML
              <Badge variant="secondary" className="ml-auto text-xs">
                Recommandé
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              FLAML explore automatiquement les modèles, le preprocessing et les
              hyperparamètres dans le budget temps que vous définissez.
            </p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Pipeline complet automatique
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Sélection de modèle + HPO
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Un seul paramètre : le budget
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Manual mode card */}
        <Card
          className="cursor-pointer border-2 transition-colors hover:border-primary/60 hover:bg-primary/5"
          onClick={handleManual}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Mode manuel
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Contrôle total : choisissez chaque modèle, métrique, étape de preprocessing et
              stratégie HPO vous-même.
            </p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Vos choix, vos règles
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Wizard étape par étape
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" /> 6 étapes de configuration
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* AutoML config panel */}
      <AnimatePresence>
        {showAutoMLPanel && canStart && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AutoMLConfigPanel
              projectId={projectId}
              datasetVersionId={config.datasetVersionId}
              targetColumn={config.targetColumn}
              taskType={config.taskType}
              positiveLabel={config.positiveLabel}
              onSessionStarted={onAutoMLSessionStarted}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
