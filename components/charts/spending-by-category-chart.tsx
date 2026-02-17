"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpendingSummary } from "@/hooks/use-dashboard";
import { formatCategory } from "@/lib/utils";

const COLORS = [
  "#1a4766",
  "#2d5a7b",
  "#4a7a95",
  "#6b92aa",
  "#8ba9be",
  "#a5b5c2",
  "#7a9aad",
  "#5a7d92",
  "#3d6074",
  "#2a4d63",
];

export function SpendingByCategoryChart() {
  const { data, isLoading } = useSpendingSummary();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  const summary = (data?.summary || []).map((s) => ({
    ...s,
    category: formatCategory(s.category),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category (MTD)</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No spending data this month.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={summary}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="amount"
                nameKey="category"
              >
                {summary.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `$${value.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}`,
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
