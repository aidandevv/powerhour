"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTopMerchants } from "@/hooks/use-dashboard";

export function TopMerchantsChart() {
  const { data, isLoading } = useTopMerchants(undefined, undefined, 10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Top Merchants</CardTitle></CardHeader>
        <CardContent className="h-[320px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const merchants = data?.merchants ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">
            No merchant data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={merchants}
              layout="vertical"
              margin={{ left: 8, right: 24 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                fontSize={11}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                fontSize={11}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  "Spent",
                ]}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {merchants.map((_, i) => (
                  <Cell
                    key={i}
                    fill={`hsl(205, 59%, ${Math.max(22, 45 - i * 3)}%)`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
