import React from "react";
import { Radar as RadarIcon } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip,
} from "recharts";
import { ChartHeader } from "../ChartHeader";
import { EmptyChart } from "../EmptyChart";
import { COLORS } from "../constants";
import { fmtN } from "../utils";

type RadarPoint = { metric: string; fullName: string; mean: number; value: number };

type Props = {
  radarData: RadarPoint[];
  allRadarCols: string[];
  radarCols: string[];
};

export function RadarPanel({ radarData, allRadarCols, radarCols }: Props) {
  if (radarData.length < 3) {
    return (
      <div className="rounded-2xl border bg-card overflow-hidden">
        <EmptyChart
          icon={<RadarIcon className="h-10 w-10 opacity-20" />}
          message={
            allRadarCols.length === 0
              ? "Aucune colonne numérique disponible"
              : radarCols.length === 0
              ? "Sélectionner des colonnes pour le radar"
              : "Sélectionner au moins 3 colonnes"
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <ChartHeader
          title="Profil des moyennes"
          subtitle={`${radarData.length} colonnes · valeurs normalisées [0–100]`}
        />
        <ResponsiveContainer width="100%" height={420}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={150}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} tickCount={4} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                if (!d) return null;
                return (
                  <div className="bg-card border rounded-xl p-2.5 text-xs shadow space-y-0.5">
                    <p className="font-semibold mb-1 truncate max-w-[180px]">{d.fullName}</p>
                    <p className="text-muted-foreground">Moyenne : <span className="text-foreground font-medium">{fmtN(d.mean)}</span></p>
                    <p className="text-muted-foreground">Score norm. : <span className="text-foreground font-medium">{fmtN(d.value, 1)}</span></p>
                  </div>
                );
              }}
            />
            <Radar dataKey="value" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-semibold">Légende · moyennes réelles</span>
          <span className="text-muted-foreground">{radarData.length} colonnes</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {radarData.map((d, i) => (
            <div key={d.metric} className="flex items-center gap-2 text-xs min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="truncate text-muted-foreground flex-1" title={d.fullName}>{d.metric}</span>
              <span className="font-semibold tabular-nums shrink-0">{fmtN(d.mean, 2)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
