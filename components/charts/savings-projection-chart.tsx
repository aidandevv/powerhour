"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  generateSavingsProjection,
  monthsUntilGoal,
  projectedGoalDate,
} from "@/lib/savings-projections";
import { formatCurrency } from "@/lib/utils";

interface SavingsProjectionChartProps {
  name: string;
  targetAmount: number;
  monthlyAmount: number;
  height?: number;
}

export function SavingsProjectionChart({
  name,
  targetAmount,
  monthlyAmount,
  height = 220,
}: SavingsProjectionChartProps) {
  const data = generateSavingsProjection(targetAmount, monthlyAmount);
  const monthsToGoal = monthsUntilGoal(targetAmount, monthlyAmount);
  const projectedDate = projectedGoalDate(targetAmount, monthlyAmount);
  const goalDateLabel = new Date(projectedDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        Adjust your monthly amount to see the projection.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border/60"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
            }
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number) => [
              formatCurrency(value),
              "Saved",
            ]}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload;
              return point?.label ?? "";
            }}
          />
          <ReferenceLine
            y={targetAmount}
            stroke="hsl(var(--primary))"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          <Line
            type="monotone"
            dataKey="accumulated"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 2, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground">
        At {formatCurrency(monthlyAmount)}/mo, you&apos;ll reach{" "}
        {formatCurrency(targetAmount)} in <strong>{monthsToGoal} months</strong>{" "}
        ({goalDateLabel}).
      </p>
    </div>
  );
}
