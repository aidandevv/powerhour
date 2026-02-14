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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import useSWR from "swr";
import type { ProjectedExpense } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ProjectionResponse {
  projections: ProjectedExpense[];
  totalProjected: number;
  shortfalls: { accountId: string; accountName: string; shortfall: number }[];
}

function groupByWeek(projections: ProjectedExpense[]) {
  const weeks = new Map<string, number>();
  for (const p of projections) {
    const d = new Date(p.date + "T00:00:00");
    // ISO week start (Monday)
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const key = monday.toISOString().split("T")[0];
    weeks.set(key, (weeks.get(key) ?? 0) + p.amount);
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CashFlowProjectionChart() {
  const { data, isLoading } = useSWR<ProjectionResponse>(
    "/api/projections?days=90",
    fetcher
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Projection</CardTitle>
          <CardDescription>Upcoming 90 days of recurring expenses</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const weeks = groupByWeek(data?.projections ?? []);
  const shortfalls = data?.shortfalls ?? [];
  const total = data?.totalProjected ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Projection</CardTitle>
        <CardDescription>
          ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })} projected over 90 days
          {shortfalls.length > 0 && (
            <span className="text-destructive ml-2">
              · {shortfalls.length} shortfall{shortfalls.length > 1 ? "s" : ""}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weeks.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No recurring expenses detected.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  fontSize={11}
                />
                <Tooltip
                  labelFormatter={(l) => `Week of ${fmtDate(l)}`}
                  formatter={(value: number) => [
                    `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    "Projected",
                  ]}
                />
                <Bar
                  dataKey="amount"
                  fill="hsl(222.2, 47.4%, 30%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {shortfalls.length > 0 && (
              <div className="mt-3 space-y-1">
                {shortfalls.map((s) => (
                  <div key={s.accountId} className="text-xs text-destructive">
                    ⚠ {s.accountName} may run short by $
                    {s.shortfall.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
