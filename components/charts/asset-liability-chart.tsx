"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssetLiabilityHistory } from "@/hooks/use-dashboard";

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtAxis(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function AssetLiabilityChart() {
  const { data, isLoading } = useAssetLiabilityHistory(365);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Assets vs. Liabilities</CardTitle></CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const history = data?.history ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assets vs. Liabilities</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No balance history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                fontSize={11}
                interval="preserveStartEnd"
              />
              <YAxis tickFormatter={fmtAxis} fontSize={11} />
              <Tooltip
                labelFormatter={fmtDate}
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  name === "assets" ? "Assets" : "Liabilities",
                ]}
              />
              <Legend
                formatter={(value) => (value === "assets" ? "Assets" : "Liabilities")}
              />
              <Area
                type="monotone"
                dataKey="assets"
                stackId="1"
                stroke="hsl(142, 72%, 29%)"
                fill="hsl(142, 72%, 29%)"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="liabilities"
                stackId="2"
                stroke="hsl(0, 72%, 51%)"
                fill="hsl(0, 72%, 51%)"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
