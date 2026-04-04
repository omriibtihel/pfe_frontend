import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ImagingEpochCurvePoint } from "@/types/imaging";

interface Props {
  data: ImagingEpochCurvePoint[];
  height?: number;
}

export function EpochLossChart({ data, height = 220 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-sm text-muted-foreground">
        Aucune courbe disponible
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="epoch"
          tick={{ fontSize: 11 }}
          label={{ value: "Epoch", position: "insideBottom", offset: -2, fontSize: 11 }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(val: number, name: string) => [val.toFixed(4), name]}
          labelFormatter={(label) => `Epoch ${label}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="trainLoss"
          name="Train Loss"
          stroke="hsl(var(--primary))"
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="valLoss"
          name="Val Loss"
          stroke="hsl(var(--destructive))"
          dot={false}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
        <Line
          type="monotone"
          dataKey="valAcc"
          name="Val Acc"
          stroke="hsl(142 71% 45%)"
          dot={false}
          strokeWidth={2}
          strokeDasharray="2 4"
          yAxisId={0}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
