import React from "react";
import { RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { AggFn, AggregateOut } from "@/services/databaseService";
import { ChartHeader } from "../ChartHeader";
import { EmptyChart } from "../EmptyChart";
import { AGG_TITLES, TOOLTIP_STYLE, fmtAxisVal } from "../constants";
import { shortLabel } from "../utils";

type Props = {
  chartKind: "bar" | "line" | "area";
  xCat: string;
  aggOut: AggregateOut | null;
  seriesLabel: string;
  topK: number;
  agg: AggFn;
  yNum: string;
  chartLoading: boolean;
};

export function AggPanel({ chartKind, xCat, aggOut, seriesLabel, topK, agg, yNum, chartLoading }: Props) {
  const hasData = aggOut && aggOut.rows.length > 0;

  const subtitle = agg === "count"
    ? `Nombre d'occurrences · Top ${topK}`
    : `${agg.toUpperCase()}(${shortLabel(yNum, 22)}) · Top ${topK}`;

  const xAxisProps = {
    dataKey: "x" as const,
    tickFormatter: (v: string) => shortLabel(String(v), 14),
    className: "text-xs",
    angle: -30 as const,
    textAnchor: "end" as const,
    interval: 0 as const,
    tick: { fontSize: 11 },
    height: 56,
  };

  const tooltipFormatter = (v: unknown) => [
    typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : String(v),
    seriesLabel,
  ];

  return (
    <>
      <div className="relative rounded-2xl border bg-card overflow-hidden">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
            <RefreshCw className="h-7 w-7 animate-spin text-primary/70" />
          </div>
        )}

        {!xCat ? (
          <EmptyChart message="Aucune colonne catégorielle disponible pour l'axe X" />
        ) : !hasData ? (
          <EmptyChart message={chartLoading ? "" : "Aucun résultat pour ces paramètres"} />
        ) : (
          <>
            <ChartHeader
              title={`${AGG_TITLES[chartKind]} par ${shortLabel(xCat, 30)}`}
              subtitle={subtitle}
            />
            <ResponsiveContainer width="100%" height={420}>
              {chartKind === "bar" ? (
                <BarChart data={aggOut!.rows} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis {...xAxisProps} />
                  <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                  <Bar dataKey="y" name={seriesLabel} fill="hsl(221, 83%, 53%)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
              ) : chartKind === "line" ? (
                <LineChart data={aggOut!.rows} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis {...xAxisProps} />
                  <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                  <Line type="monotone" dataKey="y" name={seriesLabel} stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              ) : (
                <AreaChart data={aggOut!.rows} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis {...xAxisProps} />
                  <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
                  <Area type="monotone" dataKey="y" name={seriesLabel} stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="mt-3 rounded-xl border bg-muted/20 px-4 py-2.5 flex items-center gap-3">
          <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: "hsl(221, 83%, 53%)" }} />
          <span className="text-xs font-medium">{seriesLabel}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {aggOut!.rows.length} catégorie{aggOut!.rows.length > 1 ? "s" : ""}
            {agg !== "count" && (
              <> · total {aggOut!.rows.reduce((s, r) => s + (r.y ?? 0), 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</>
            )}
          </span>
        </div>
      )}
    </>
  );
}
