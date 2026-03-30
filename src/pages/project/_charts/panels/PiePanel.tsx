import React from "react";
import { RefreshCw, PieChart as PieIcon } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { ValueCountsOut } from "@/services/databaseService";
import { ChartHeader } from "../ChartHeader";
import { EmptyChart } from "../EmptyChart";
import { TOOLTIP_STYLE } from "../constants";
import { shortLabel } from "../utils";

type PieDataItem = { name: string; value: number; fill: string };

type Props = {
  chartKind: "pie" | "doughnut";
  pieCol: string;
  countsOut: ValueCountsOut | null;
  pieData: PieDataItem[];
  topK: number;
  chartLoading: boolean;
};

export function PiePanel({ chartKind, pieCol, countsOut, pieData, topK, chartLoading }: Props) {
  const hasData = countsOut && pieData.length > 0;

  return (
    <>
      <div className="relative rounded-2xl border bg-card overflow-hidden">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
            <RefreshCw className="h-7 w-7 animate-spin text-primary/70" />
          </div>
        )}

        {!pieCol ? (
          <EmptyChart icon={<PieIcon className="h-10 w-10 opacity-20" />} message="Aucune colonne catégorielle disponible" />
        ) : !hasData ? (
          <EmptyChart icon={<PieIcon className="h-10 w-10 opacity-20" />} message={chartLoading ? "" : "Aucun résultat"} />
        ) : (
          <>
            <ChartHeader
              title={chartKind === "doughnut" ? `Composition — ${shortLabel(pieCol, 30)}` : `Répartition — ${shortLabel(pieCol, 30)}`}
              subtitle={`Top ${topK}${countsOut!.others_count > 0 ? ` + Autres (${countsOut!.others_count.toLocaleString("fr-FR")})` : ""} · ${countsOut!.total_count.toLocaleString("fr-FR")} au total`}
            />
            <ResponsiveContainer width="100%" height={420}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%" cy="50%"
                  outerRadius={155}
                  innerRadius={chartKind === "doughnut" ? 95 : 0}
                  labelLine={false}
                  label={false}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "Occurrences"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="mt-3 rounded-2xl border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold">Légende</span>
            <span className="text-muted-foreground">{countsOut!.total_count.toLocaleString("fr-FR")} occurrences au total</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-8 max-h-36 overflow-auto pr-1">
            {pieData.map((d, idx) => {
              const pct = countsOut!.total_count
                ? ((d.value / countsOut!.total_count) * 100).toFixed(1)
                : null;
              return (
                <div key={`${d.name}-${idx}`} className="grid items-center gap-3 grid-cols-[minmax(0,12rem)_4.5rem]">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: d.fill }} />
                    <span className="truncate text-xs">{d.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="tabular-nums text-xs font-semibold">{Number(d.value).toLocaleString()}</span>
                    {pct && <span className="text-muted-foreground text-[10px] ml-1">({pct}%)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
