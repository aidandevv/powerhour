"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from "lucide-react";

const METRICS = [
  {
    key: "netWorth",
    label: "Net Worth",
    icon: DollarSign,
    getValue: (d: { netWorth: number }) => d.netWorth,
  },
  {
    key: "totalAssets",
    label: "Total Assets",
    icon: TrendingUp,
    getValue: (d: { totalAssets: number }) => d.totalAssets,
  },
  {
    key: "liabilities",
    label: "Total Liabilities",
    icon: TrendingDown,
    getValue: (d: { totalLiabilities: number }) => d.totalLiabilities,
  },
  {
    key: "mtdSpending",
    label: "MTD Spending",
    icon: CreditCard,
    getValue: (d: { monthToDateSpending: number }) => d.monthToDateSpending,
  },
];

export function MetricCards() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => (
          <Card key={m.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.label}</span>
              <m.icon className="h-4 w-4 text-tertiary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-foreground">—</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const summary = data ?? {
    netWorth: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    monthToDateSpending: 0,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {METRICS.map((m) => {
        const Icon = m.icon;
        const value = m.getValue(summary);
        return (
          <Card key={m.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.label}</span>
              <Icon className="h-4 w-4 text-tertiary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold text-foreground tracking-tight">{formatCurrency(value)}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
