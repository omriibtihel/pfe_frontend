import React from "react";
import { RefreshCw } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { HistogramOut, AnalyticsProfile } from "@/services/databaseService";
import { ChartHeader } from "../ChartHeader";
import { EmptyChart } from "../EmptyChart";
import { TOOLTIP_STYLE, fmtAxisVal } from "../constants";
import { shortLabel, fmtN } from "../utils";

type Props = {
  histCol: string;
  histBars: Array<{ bin: string; count: number }>;
  histBins: number;
  histOut: HistogramOut | null;
  chartLoading: boolean;
  profile: AnalyticsProfile | null;
};

export function HistPanel({ histCol, histBars, histBins, histOut, chartLoading, profile }: Props) {
  const hasData = histOut && histBars.length > 0;
  const numStats = profile?.profiles.find((c) => c.name === histCol)?.numeric;

  const stats = numStats
    ? [
        { label: "N",       v: numStats.count, d: 0 },
        { label: "Moy.",    v: numStats.mean,  d: 3 },
        { label: "Std",     v: numStats.std,   d: 3 },
        { label: "Min",     v: numStats.min,   d: 3 },
        { label: "P25",     v: numStats.p25,   d: 3 },
        { label: "Médiane", v: numStats.p50,   d: 3 },
        { label: "P75",     v: numStats.p75,   d: 3 },
        { label: "Max",     v: numStats.max,   d: 3 },
      ]
    : null;

  return (
    <>
      <div className="relative rounded-2xl border bg-card overflow-hidden">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
            <RefreshCw className="h-7 w-7 animate-spin text-primary/70" />
          </div>
        )}

        {!histCol ? (
          <EmptyChart message="Aucune colonne numérique disponible" />
        ) : !hasData ? (
          <EmptyChart message={chartLoading ? "" : "Aucun résultat"} />
        ) : (
          <>
            <ChartHeader
              title={`Distribution — ${shortLabel(histCol, 30)}`}
              subtitle={`${histBins} bins · ${histOut!.rows.reduce((s, b) => s + b.count, 0).toLocaleString("fr-FR")} valeurs`}
            />
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={histBars} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="bin"
                  className="text-[10px]"
                  angle={-30}
                  textAnchor="end"
                  height={56}
                  interval={Math.max(0, Math.ceil(histBars.length / 10) - 1)}
                  tick={{ fontSize: 10 }}
                />
                <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={52} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "Fréquence"]}
                />
                <Bar dataKey="count" name="Fréquence" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Legend — descriptive statistics */}
      {hasData && histCol && stats && (
        <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: "hsl(262, 83%, 58%)" }} />
            <span className="text-xs font-semibold truncate flex-1" title={histCol}>{histCol}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">Statistiques descriptives</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {stats.map(({ label, v, d }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                <p className="text-xs font-semibold tabular-nums">{fmtN(v as number | null | undefined, d)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
