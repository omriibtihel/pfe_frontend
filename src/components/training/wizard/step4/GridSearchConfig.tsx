import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Grid3X3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedHelp } from "@/components/ui/med-help";
import type { TrainingConfig, GridScoringOption, SearchType } from "@/types";
import { cn } from "@/lib/utils";
import { GRID_SCORING_OPTIONS } from "./ModelCatalog";

export interface GridSearchConfigProps {
  config: Pick<
    TrainingConfig,
    "searchType" | "taskType" | "gridCvFolds" | "nIterRandomSearch" | "gridScoring" | "models"
  >;
  hasAnyCustomHp: boolean;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

export function GridSearchConfig({ config, hasAnyCustomHp, onConfigChange }: GridSearchConfigProps) {
  const [cvFoldsError, setCvFoldsError] = useState<string | null>(null);

  const isSearchActive = (config.searchType ?? "none") !== "none";
  const isRandomOrHalvingMode = config.searchType === "random" || config.searchType === "halving_random";
  const searchTypeLabel =
    config.searchType === "grid" ? "GridSearch" :
    config.searchType === "random" ? "Random Search" : "Successive Halving";
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

  return (
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
  );
}
