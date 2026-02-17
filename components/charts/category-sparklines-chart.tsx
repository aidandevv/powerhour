"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategoryTrends } from "@/hooks/use-dashboard";
import { formatCategory } from "@/lib/utils";

const SPARKLINE_COLORS = [
  "hsl(205, 59%, 25%)",
  "hsl(205, 45%, 38%)",
  "hsl(205, 35%, 48%)",
  "hsl(210, 25%, 55%)",
  "hsl(210, 17%, 65%)",
  "hsl(210, 17%, 70%)",
];

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short" });
}

export function CategorySparklinesChart() {
  const { data, isLoading } = useCategoryTrends(6, 6);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Spending by Category (6 months)</CardTitle></CardHeader>
        <CardContent className="h-[340px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const categories = data?.categories ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category (6 months)</CardTitle>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="h-[340px] flex items-center justify-center text-muted-foreground">
            No category data yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {categories.map((cat, i) => {
              const max = Math.max(...cat.data.map((d) => d.amount), 1);
              const total = cat.data.reduce((s, d) => s + d.amount, 0);
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {formatCategory(cat.category)}
                    </span>
                    <span className="text-xs font-semibold">
                      ${(total / cat.data.length).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo avg
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={cat.data}>
                      <XAxis dataKey="month" tickFormatter={fmtMonth} hide />
                      <Tooltip
                        formatter={(value: number) => [
                          `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                          formatCategory(cat.category),
                        ]}
                        labelFormatter={fmtMonth}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke={SPARKLINE_COLORS[i % SPARKLINE_COLORS.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>$0</span>
                    <span>${max.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
