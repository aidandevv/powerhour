"use client";

import { BalanceCards } from "@/components/dashboard/balance-cards";
import { SyncStatusBanner } from "@/components/dashboard/sync-status-banner";
import { ReportButton } from "@/components/dashboard/report-button";

// Existing charts
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { SpendingByCategoryChart } from "@/components/charts/spending-by-category-chart";
import { SpendingTrendChart } from "@/components/charts/spending-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

// New charts
import { AssetLiabilityChart } from "@/components/charts/asset-liability-chart";
import { CreditUtilizationChart } from "@/components/charts/credit-utilization-chart";
import { TopMerchantsChart } from "@/components/charts/top-merchants-chart";
import { CategorySparklinesChart } from "@/components/charts/category-sparklines-chart";
import { AccountBalanceHistoryChart } from "@/components/charts/account-balance-history-chart";
import { SpendingHeatmapChart } from "@/components/charts/spending-heatmap-chart";
import { CashFlowProjectionChart } from "@/components/charts/cash-flow-projection-chart";
import { PaymentChannelChart } from "@/components/charts/payment-channel-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <ReportButton />
      </div>

      <SyncStatusBanner />
      <BalanceCards />

      {/* Net Worth */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">Net Worth</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <NetWorthChart />
          <AssetLiabilityChart />
        </div>
      </section>

      {/* Account Detail */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">Accounts</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <AccountBalanceHistoryChart />
          <CreditUtilizationChart />
        </div>
      </section>

      {/* Spending Overview */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">Spending</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <SpendingTrendChart />
          <SpendingByCategoryChart />
        </div>
        <SpendingHeatmapChart />
      </section>

      {/* Spending Breakdown */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">Breakdown</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <TopMerchantsChart />
          <PaymentChannelChart />
        </div>
        <CategorySparklinesChart />
      </section>

      {/* Projections & Transactions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-muted-foreground">Planning</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <CashFlowProjectionChart />
          <RecentTransactions />
        </div>
      </section>
    </div>
  );
}
