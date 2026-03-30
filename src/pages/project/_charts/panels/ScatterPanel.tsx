import React from "react";
import { RefreshCw, ScatterChart as ScatterIcon } from "lucide-react";
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { SampleOut } from "@/services/databaseService";
import { ChartHeader } from "../ChartHeader";
import { EmptyChart } from "../EmptyChart";
import { TOOLTIP_STYLE, fmtAxisVal } from "../constants";
import { shortLabel, fmtN } from "../utils";

type Point = { x: number; y: number; z: number };

type Props = {
  sx: string;
  sy: string;
  scatterPoints: Point[];
  sampleOut: SampleOut | null;
  chartLoading: boolean;
  pearsonR: number | null;
};

export function ScatterPanel({ sx, sy, scatterPoints, sampleOut, chartLoading, pearsonR }: Props) {
  const hasData = sampleOut && scatterPoints.length > 0;

  return (
    <>
      <div className="relative rounded-2xl border bg-card overflow-hidden">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
            <RefreshCw className="h-7 w-7 animate-spin text-primary/70" />
          </div>
        )}

        {!sx || !sy ? (
          <EmptyChart icon={<ScatterIcon className="h-10 w-10 opacity-20" />} message="Sélectionner deux colonnes numériques" />
        ) : !hasData ? (
          <EmptyChart icon={<ScatterIcon className="h-10 w-10 opacity-20" />} message={!chartLoading ? "Aucun point à afficher" : ""} />
        ) : (
          <>
            <ChartHeader
              title={`${shortLabel(sx, 22)} vs ${shortLabel(sy, 22)}`}
              subtitle={`Nuage de points · ${scatterPoints.length.toLocaleString("fr-FR")} points échantillonnés`}
            />
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" dataKey="x" name={sx} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                <YAxis type="number" dataKey="y" name={sy} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                <ZAxis type="number" dataKey="z" range={[30, 30]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-card border rounded-xl p-2.5 text-xs shadow space-y-0.5">
                        <p className="text-muted-foreground">{shortLabel(sx, 22)}: <span className="text-foreground font-medium">{fmtN(d.x)}</span></p>
                        <p className="text-muted-foreground">{shortLabel(sy, 22)}: <span className="text-foreground font-medium">{fmtN(d.y)}</span></p>
                      </div>
                    );
                  }}
                />
                <Scatter name="Points" data={scatterPoints} fill="hsl(262, 83%, 58%)" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="mt-3 rounded-xl border bg-muted/20 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Axe X</p>
              <p className="text-xs font-semibold truncate" title={sx}>{shortLabel(sx, 18)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Axe Y</p>
              <p className="text-xs font-semibold truncate" title={sy}>{shortLabel(sy, 18)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Points</p>
              <p className="text-xs font-semibold tabular-nums">{scatterPoints.length.toLocaleString("fr-FR")}</p>
            </div>
            {pearsonR !== null && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Pearson r</p>
                <p className={`text-xs font-semibold tabular-nums ${Math.abs(pearsonR) >= 0.7 ? "text-primary" : ""}`}>
                  {pearsonR.toFixed(3)}&nbsp;
                  <span className="font-normal text-muted-foreground">
                    ({Math.abs(pearsonR) >= 0.7 ? "forte" : Math.abs(pearsonR) >= 0.4 ? "modérée" : "faible"})
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
