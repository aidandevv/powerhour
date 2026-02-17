"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpendingTrends } from "@/hooks/use-dashboard";

export function SpendingTrendChart() {
  const { data, isLoading } = useSpendingTrends();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  const trends = data?.trends || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Spending</CardTitle>
      </CardHeader>
      <CardContent>
        {trends.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No spending data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                fontSize={12}
              />
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}`,
                  "Spending",
                ]}
              />
              <Bar
                dataKey="amount"
                fill="hsl(205, 59%, 25%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
