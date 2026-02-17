"use client";

import { SyncStatusBanner } from "@/components/dashboard/sync-status-banner";
import { ReportButton } from "@/components/dashboard/report-button";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { BudgetGoalsPanel } from "@/components/dashboard/budget-goals-panel";
import { SavingsTargetsPanel } from "@/components/dashboard/savings-targets-panel";
import { AccountOverview } from "@/components/dashboard/account-overview";
import { AccountSummaryTable } from "@/components/dashboard/account-summary-table";
import { ChatPanel } from "@/components/chat/chat-panel";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { CreditUtilizationChart } from "@/components/charts/credit-utilization-chart";
import { useCreditUtilization } from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const { data: creditData } = useCreditUtilization();
  const hasCreditAccounts = (creditData?.cards?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <ReportButton />
      </div>

      <SyncStatusBanner />

      {/* Hero: Total Net Worth + Assets/Liabilities/Liquidity */}
      <DashboardHero />

      {/* Key Metrics Row */}
      <MetricCards />

      {/* AI Budget Goals */}
      <BudgetGoalsPanel />

      {/* Savings Targets (from budget planner) */}
      <SavingsTargetsPanel />

      {/* Main Content: Two Columns */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Account Overview + Account Summary */}
        <div className="lg:col-span-2 space-y-8">
          <AccountOverview />
          <AccountSummaryTable />
        </div>

        {/* Right Column: Ticker + Credit Utilization + Performance */}
        <div className="space-y-8">
          <div>
            <ChatPanel variant="embedded" showClose={false} className="min-h-[380px]" showQuickActions />
          </div>
          {hasCreditAccounts && (
            <div>
              <CreditUtilizationChart />
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Performance</p>
            <NetWorthChart />
          </div>
        </div>
      </div>
    </div>
  );
}
