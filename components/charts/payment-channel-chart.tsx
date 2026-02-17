"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChannelTrends } from "@/hooks/use-dashboard";

export function PaymentChannelChart() {
  const { data, isLoading } = useChannelTrends(6);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Spending by Channel</CardTitle></CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const trends = data?.trends ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No channel data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                fontSize={11}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  name === "online" ? "Online" : name === "inStore" ? "In Store" : "Other",
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "online" ? "Online" : value === "inStore" ? "In Store" : "Other"
                }
              />
              <Bar dataKey="online" stackId="a" fill="hsl(205, 59%, 25%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="inStore" stackId="a" fill="hsl(205, 45%, 40%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="other" stackId="a" fill="hsl(38, 92%, 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
