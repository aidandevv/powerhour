/**
 * Cash flow forecast — can the user cover bills/rent in the coming period?
 * Combines account balances with projected recurring outflows.
 */
import { getAccountBalances } from "./account-balances";
import { getProjectionSummary } from "@/lib/projections";

export interface CashFlowForecastResult {
  totalAvailable: number;
  projectedOutflows30Days: number;
  projectedOutflows60Days: number;
  projectedOutflows90Days: number;
  shortfalls: { accountName: string; shortfall: number }[];
  canCover30Days: boolean;
  summary: string;
}

export async function getCashFlowForecast(): Promise<CashFlowForecastResult> {
  const [balances, projections30] = await Promise.all([
    getAccountBalances(),
    getProjectionSummary(30),
  ]);

  const projection60 = await getProjectionSummary(60);
  const projection90 = await getProjectionSummary(90);

  // Sum available balance from depository/checking-like accounts (exclude credit/loan)
  const totalAvailable = balances.accounts
    .filter((a) => a.type !== "credit" && a.type !== "loan")
    .reduce((sum, a) => sum + (a.availableBalance ?? a.currentBalance ?? 0), 0);

  const projectedOutflows30Days = projections30.totalProjected;
  const projectedOutflows60Days = projection60.totalProjected;
  const projectedOutflows90Days = projection90.totalProjected;

  const shortfalls = projections30.shortfalls.map((s) => ({
    accountName: s.accountName,
    shortfall: s.shortfall,
  }));

  const canCover30Days = shortfalls.length === 0;

  let summary = `You have **$${totalAvailable.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}** available. `;
  summary += `Projected recurring outflows: **$${projectedOutflows30Days.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}** (30 days), **$${projectedOutflows60Days.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}** (60 days), **$${projectedOutflows90Days.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}** (90 days). `;
  if (canCover30Days) {
    summary += "You should have enough to cover recurring bills in the next 30 days.";
  } else {
    summary += `**Potential shortfall:** ${shortfalls.map((s) => `${s.accountName} ($${s.shortfall.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`).join("; ")}. Consider moving funds or delaying payments.`;
  }

  return {
    totalAvailable,
    projectedOutflows30Days,
    projectedOutflows60Days,
    projectedOutflows90Days,
    shortfalls,
    canCover30Days,
    summary,
  };
}
