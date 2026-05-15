import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Grid3X3, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  /** Accepted but unused — kept so callers don't need to be updated. */
  hasAnyCustomHp?: boolean;
  onConfigChange: (updates: Partial<TrainingConfig>) => void;
}

export function GridSearchConfig({ config, onConfigChange }: GridSearchConfigProps) {
  const { t } = useTranslation();
  const [cvFoldsError, setCvFoldsError] = useState<string | null>(null);

  const isSearchActive = (config.searchType ?? "none") !== "none";

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
    if (!Number.isFinite(n)) { setCvFoldsError(t("training.step4.cvErrInvalid")); return; }
    if (n < 2) { setCvFoldsError(t("training.step4.cvErrMin")); onConfigChange({ gridCvFolds: 2 }); return; }
    if (n > 20) { setCvFoldsError(t("training.step4.cvErrMax")); onConfigChange({ gridCvFolds: 20 }); return; }
    setCvFoldsError(null);
    onConfigChange({ gridCvFolds: n });
  };

  const searchHint =
    config.searchType === "grid"
      ? t("training.step4.hintGrid")
      : t("training.step4.hintRandom");

  return (
    <Card className="glass-premium shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-xl bg-primary/10">
            <Grid3X3 className="h-4 w-4 text-primary" />
          </div>
          {t("training.step4.gsCardTitle")}
          <MedHelp title={t("training.step4.gsHelpTitle")} side="bottom">
            <p>{t("training.step4.gsHelpP1")}</p>
            <p className="mt-1">
              {t("training.step4.gsHelpP2Pre")} <strong>{t("training.step4.gsHelpP2Bold")}</strong>{t("training.step4.gsHelpP2Suf")} <em>{t("training.step4.gsHelpP2Aucune")}</em> {t("training.step4.gsHelpP2End")}
            </p>
            <p className="mt-1">{t("training.step4.gsHelpP3")}</p>
          </MedHelp>
          {(config.searchType ?? "none") !== "none" && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {t("training.step4.foldsBadge", { n: config.gridCvFolds })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="search-type" className="text-xs text-muted-foreground">{t("training.step4.searchTypeLabel")}</Label>
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
                <span>{t("training.step4.searchNone")}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{t("training.step4.searchNoneDesc")}</span>
              </SelectItem>
              <SelectItem value="grid">
                <span>{t("training.step4.searchGrid")}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{t("training.step4.searchGridDesc")}</span>
              </SelectItem>
              <SelectItem value="random">
                <span>{t("training.step4.searchRandom")}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{t("training.step4.searchRandomDesc")}</span>
              </SelectItem>
              <SelectItem value="halving_random">
                <span>{t("training.step4.searchHalving")}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{t("training.step4.searchHalvingDesc")}</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSearchActive && (
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{searchHint}</span>
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
                      {config.searchType === "halving_random" ? t("training.step4.nIterHalving") : t("training.step4.nIterRandom")}
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
                        ? t("training.step4.nIterHalvingHint")
                        : t("training.step4.nIterRandomHint")}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="cv-folds" className="text-xs text-muted-foreground">{t("training.step4.cvFoldsLabel")}</Label>
                    <MedHelp title={t("training.step4.cvFoldsHelpTitle")} side="top">
                      <p><Trans i18nKey="training.step4.cvFoldsHelpP1" components={{ em: <em />, strong: <strong /> }} /></p>
                      <p className="mt-1"><Trans i18nKey="training.step4.cvFoldsHelpP2" components={{ strong: <strong /> }} /></p>
                      <p className="mt-1">{t("training.step4.cvFoldsHelpP3")}</p>
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
                    <p className="text-[11px] text-muted-foreground">{t("training.step4.cvFoldsHint")}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="gs-scoring" className="text-xs text-muted-foreground">{t("training.step4.scoringLabel")}</Label>
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
                          <span>{t(`training.gridScoring.${o.value}.label`, o.label)}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground">{t(`training.gridScoring.${o.value}.desc`, o.desc)}</span>
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
                        ? t("training.step4.timeWarnRandom", { models: config.models.length, iters: config.nIterRandomSearch ?? 40 })
                        : config.searchType === "halving_random"
                        ? t("training.step4.timeWarnHalving", { models: config.models.length, iters: config.nIterRandomSearch ?? 60 })
                        : t("training.step4.timeWarnGrid", { models: config.models.length, folds: config.gridCvFolds })}
                      {t("training.step4.timeWarnSuffix")}
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
