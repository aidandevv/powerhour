"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountBalancesHistory } from "@/hooks/use-dashboard";

const LINE_COLORS = [
  "hsl(222.2, 47.4%, 30%)",
  "hsl(142, 72%, 29%)",
  "hsl(204, 80%, 40%)",
  "hsl(38, 92%, 40%)",
  "hsl(291, 64%, 42%)",
  "hsl(0, 72%, 45%)",
  "hsl(168, 78%, 30%)",
  "hsl(315, 64%, 40%)",
];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtAxis(v: number) {
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function AccountBalanceHistoryChart() {
  const { data, isLoading } = useAccountBalancesHistory(90);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Account Balance History</CardTitle></CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const accountData = data?.accounts ?? [];

  // Merge all accounts onto a shared date axis
  const dateSet = new Set<string>();
  for (const acct of accountData) {
    for (const s of acct.snapshots) dateSet.add(s.date);
  }
  const dates = Array.from(dateSet).sort();

  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = { date };
    for (const acct of accountData) {
      const snap = acct.snapshots.find((s) => s.date === date);
      if (snap) point[acct.id] = snap.balance;
    }
    return point;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Balance History (90 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {accountData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No balance history yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
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
                formatter={(value: number, name: string) => {
                  const acct = accountData.find((a) => a.id === name);
                  return [
                    `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    acct?.name ?? name,
                  ];
                }}
              />
              <Legend
                formatter={(value) => accountData.find((a) => a.id === value)?.name ?? value}
              />
              {accountData.map((acct, i) => (
                <Line
                  key={acct.id}
                  type="monotone"
                  dataKey={acct.id}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
