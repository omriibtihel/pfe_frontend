import { useState } from "react";
import { ChevronDown, ChevronUp, Bookmark, BookmarkCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EpochLossChart } from "./EpochLossChart";
import type { ImagingModelResult } from "@/types/imaging";
import { IMAGING_MODEL_LABELS } from "@/types/imaging";

interface Props {
  result: ImagingModelResult;
  onSave?: (modelId: number) => void;
  onUnsave?: (modelId: number) => void;
}

export function ImagingResultCard({ result, onSave, onUnsave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const m = result.metrics_json;
  const arts = result.artifacts_json;

  const fmt = (v: number | undefined | null) =>
    v != null ? (v * 100).toFixed(1) + "%" : "—";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none pb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">
              {IMAGING_MODEL_LABELS[result.model_name] ?? result.model_name}
            </CardTitle>
            {arts.pretrained && (
              <Badge variant="outline" className="text-[10px]">ImageNet</Badge>
            )}
            {result.is_saved && (
              <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200">
                Sauvegardé
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Acc </span>
                <strong className="text-primary">{fmt(m.accuracy)}</strong>
              </span>
              <span>
                <span className="text-muted-foreground">F1 </span>
                <strong>{fmt(m.f1_macro)}</strong>
              </span>
              {m.roc_auc != null && (
                <span>
                  <span className="text-muted-foreground">AUC </span>
                  <strong>{m.roc_auc?.toFixed(3)}</strong>
                </span>
              )}
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5 pt-0">
          {/* Loss curves */}
          {m.epoch_curves && m.epoch_curves.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Courbes d'entraînement
              </p>
              <EpochLossChart data={m.epoch_curves} />
            </div>
          )}

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Accuracy", value: fmt(m.accuracy) },
              { label: "F1 Macro", value: fmt(m.f1_macro) },
              { label: "F1 Weighted", value: fmt(m.f1_weighted) },
              { label: "Precision", value: fmt(m.precision_macro) },
              { label: "Recall", value: fmt(m.recall_macro) },
              { label: "ROC-AUC", value: m.roc_auc != null ? m.roc_auc.toFixed(3) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-md bg-muted/50 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-base font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {/* Per-class */}
          {m.per_class && Object.keys(m.per_class).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Par classe
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left pb-1">Classe</th>
                      <th className="text-right pb-1">Préc.</th>
                      <th className="text-right pb-1">Rappel</th>
                      <th className="text-right pb-1">F1</th>
                      <th className="text-right pb-1">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(m.per_class).map(([cls, stats]) => (
                      <tr key={cls} className="border-b last:border-0">
                        <td className="py-1 font-medium">{cls}</td>
                        <td className="text-right">{fmt(stats.precision)}</td>
                        <td className="text-right">{fmt(stats.recall)}</td>
                        <td className="text-right">{fmt(stats.f1)}</td>
                        <td className="text-right text-muted-foreground">{stats.support}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>
              Meilleure epoch : {m.best_epoch ?? "—"} · Classes : {arts.class_names?.join(", ") ?? "—"}
            </span>
            <div className="flex gap-2">
              {result.is_saved ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => onUnsave?.(result.id)}
                >
                  <BookmarkCheck className="h-3.5 w-3.5 text-green-600" />
                  Sauvegardé
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => onSave?.(result.id)}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Sauvegarder
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
