"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from "lucide-react";

export function BalanceCards() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground tracking-tight">--</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const summary = data;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
          <DollarSign className="h-4 w-4 text-tertiary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-foreground tracking-tight">
            {formatCurrency(summary?.netWorth || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          <TrendingUp className="h-4 w-4 text-tertiary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-foreground tracking-tight">
            {formatCurrency(summary?.totalAssets || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Liabilities</CardTitle>
          <TrendingDown className="h-4 w-4 text-tertiary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-foreground tracking-tight">
            {formatCurrency(summary?.totalLiabilities || 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">MTD Spending</CardTitle>
          <CreditCard className="h-4 w-4 text-tertiary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-foreground tracking-tight">
            {formatCurrency(summary?.monthToDateSpending || 0)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
