"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SeriesPoint } from "@/server/services/analytics.service";

interface TimeSeriesChartProps {
  data: SeriesPoint[];
  dataKey: "views" | "clicks" | "visitors" | "sessions";
  color?: string;
  label?: string;
}

export function TimeSeriesChart({ data, dataKey, color = "var(--chart-2)", label }: TimeSeriesChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(value: string) => value.slice(5)}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(value) => String(value)}
            formatter={(value) => [Number(value), label ?? dataKey]}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
