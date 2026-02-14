"use client";

import { BalanceCards } from "@/components/dashboard/balance-cards";
import { SyncStatusBanner } from "@/components/dashboard/sync-status-banner";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { SpendingByCategoryChart } from "@/components/charts/spending-by-category-chart";
import { SpendingTrendChart } from "@/components/charts/spending-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <SyncStatusBanner />
      <BalanceCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <NetWorthChart />
        <SpendingByCategoryChart />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SpendingTrendChart />
        <RecentTransactions />
      </div>
    </div>
  );
}
