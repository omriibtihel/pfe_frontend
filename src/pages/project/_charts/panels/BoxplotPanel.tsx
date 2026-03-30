import React from "react";
import { BoxSelect } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { BoxplotRow } from "../types";
import { ChartHeader } from "../ChartHeader";
import { BoxPlotShape } from "../BoxPlotShape";
import { shortLabel, fmtN } from "../utils";

type Props = {
  boxplotInfo: { data: BoxplotRow[]; shift: number };
  allBoxplotCols: string[];
};

export function BoxplotPanel({ boxplotInfo, allBoxplotCols }: Props) {
  return (
    <>
      <div className="rounded-2xl border bg-card overflow-hidden">
        {boxplotInfo.data.length === 0 ? (
          <div className="h-[320px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <BoxSelect className="h-10 w-10 opacity-20" />
            <p className="text-sm">
              {allBoxplotCols.length === 0
                ? "Aucune colonne numérique disponible"
                : "Sélectionner au moins une colonne"}
            </p>
          </div>
        ) : (
          <>
            <ChartHeader
              title="Distribution — Boîtes à moustaches"
              subtitle={`${boxplotInfo.data.length} colonne${boxplotInfo.data.length > 1 ? "s" : ""} · IQR [P25–P75]`}
            />
            <div className="p-4 pt-2">
              <ResponsiveContainer width="100%" height={Math.max(280, boxplotInfo.data.length * 58 + 40)}>
                <BarChart
                  layout="vertical"
                  data={boxplotInfo.data}
                  margin={{ top: 10, right: 40, bottom: 10, left: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis
                    type="number"
                    domain={[0, "auto"]}
                    tickFormatter={(v) => fmtN(v - boxplotInfo.shift, 1)}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={155}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => shortLabel(String(v), 22)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="bg-card border rounded-xl p-3 text-xs shadow space-y-0.5 min-w-[150px]">
                          <p className="font-semibold mb-1 text-sm truncate max-w-[180px]">{d.name}</p>
                          <p className="text-muted-foreground">Max     : <span className="text-foreground font-medium">{fmtN(d._max)}</span></p>
                          <p className="text-muted-foreground">P75     : <span className="text-foreground font-medium">{fmtN(d._p75)}</span></p>
                          <p className="font-semibold" style={{ color: d.fill }}>Médiane : {fmtN(d._p50)}</p>
                          <p className="text-muted-foreground">P25     : <span className="text-foreground font-medium">{fmtN(d._p25)}</span></p>
                          <p className="text-muted-foreground">Min     : <span className="text-foreground font-medium">{fmtN(d._min)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" isAnimationActive={false} shape={<BoxPlotShape />}>
                    {boxplotInfo.data.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      {boxplotInfo.data.length > 0 && (
        <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-3">
          {/* Visual key */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { color: "bg-slate-400",                         label: "Min / Max",  desc: "Moustaches (extrêmes)" },
              { color: "bg-primary/30 border border-primary", label: "Boîte IQR",  desc: "P25 à P75 (50 % central)" },
              { color: "bg-primary",                          label: "Médiane",    desc: "P50 (trait central)" },
              { color: "bg-transparent",                      label: "Tooltip",    desc: "Cliquer pour les stats" },
            ].map(({ color, label, desc }) => (
              <div key={label} className="flex items-start gap-2">
                <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm ${color}`} />
                <div>
                  <p className="text-xs font-medium leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Per-column stats */}
          <div className="border-t pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-1.5 gap-x-6">
            {boxplotInfo.data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="truncate text-muted-foreground flex-1" title={d.name}>{shortLabel(d.name, 22)}</span>
                <span className="tabular-nums shrink-0 text-muted-foreground text-[10px]">
                  {fmtN(d._min, 1)} – <span className="text-foreground font-medium">{fmtN(d._p50, 1)}</span> – {fmtN(d._max, 1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
