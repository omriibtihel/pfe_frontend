import React from "react";
import { RefreshCw, CircleDot } from "lucide-react";
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { SampleOut } from "@/services/databaseService";
import { ChartHeader } from "../ChartHeader";
import { EmptyChart } from "../EmptyChart";
import { fmtAxisVal } from "../constants";
import { shortLabel, fmtN } from "../utils";

type Point = { x: number; y: number; z: number };

type Props = {
  bx: string;
  by: string;
  bz: string;
  scatterPoints: Point[];
  sampleOut: SampleOut | null;
  chartLoading: boolean;
};

export function BubblePanel({ bx, by, bz, scatterPoints, sampleOut, chartLoading }: Props) {
  const hasData = sampleOut && scatterPoints.length > 0;

  return (
    <>
      <div className="relative rounded-2xl border bg-card overflow-hidden">
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
            <RefreshCw className="h-7 w-7 animate-spin text-primary/70" />
          </div>
        )}

        {!bx || !by || !bz ? (
          <EmptyChart icon={<CircleDot className="h-10 w-10 opacity-20" />} message="Sélectionner trois colonnes numériques (X, Y, taille)" />
        ) : !hasData ? (
          <EmptyChart icon={<CircleDot className="h-10 w-10 opacity-20" />} message={!chartLoading ? "Aucun point à afficher" : ""} />
        ) : (
          <>
            <ChartHeader
              title={`${shortLabel(bx, 18)} / ${shortLabel(by, 18)} / ${shortLabel(bz, 18)}`}
              subtitle={`Bulles · taille = ${shortLabel(bz, 22)} · ${scatterPoints.length.toLocaleString("fr-FR")} points`}
            />
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" dataKey="x" name={bx} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                <YAxis type="number" dataKey="y" name={by} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                <ZAxis type="number" dataKey="z" name={bz} range={[40, 500]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-card border rounded-xl p-2.5 text-xs shadow space-y-0.5">
                        <p className="text-muted-foreground">{shortLabel(bx, 22)}: <span className="text-foreground font-medium">{fmtN(d.x)}</span></p>
                        <p className="text-muted-foreground">{shortLabel(by, 22)}: <span className="text-foreground font-medium">{fmtN(d.y)}</span></p>
                        <p className="text-muted-foreground">{shortLabel(bz, 22)}: <span className="text-foreground font-medium">{fmtN(d.z)}</span></p>
                      </div>
                    );
                  }}
                />
                <Scatter name="Bulles" data={scatterPoints} fill="hsl(174, 84%, 32%)" fillOpacity={0.65} />
              </ScatterChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="mt-3 rounded-xl border bg-muted/20 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Axe X",      v: bx },
              { label: "Axe Y",      v: by },
              { label: "Taille (Z)", v: bz },
              { label: "Points",     v: scatterPoints.length.toLocaleString("fr-FR") },
            ].map(({ label, v }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                <p className="text-xs font-semibold truncate" title={v}>{shortLabel(v, 18)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
