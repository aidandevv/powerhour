import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { recurringItems, accounts } from "@/lib/db/schema";
import type { ProjectedExpense } from "@/types";

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  annually: 365,
};

export async function getProjections(
  days: number = 90
): Promise<ProjectedExpense[]> {
  const items = await db
    .select()
    .from(recurringItems)
    .where(
      and(
        eq(recurringItems.isActive, true)
      )
    );

  const projections: ProjectedExpense[] = [];
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  for (const item of items) {
    const intervalDays = FREQUENCY_DAYS[item.frequency];
    if (!intervalDays) continue;

    let nextDate = item.nextProjectedDate
      ? new Date(item.nextProjectedDate)
      : null;

    if (!nextDate && item.lastDate) {
      nextDate = new Date(item.lastDate);
      nextDate.setDate(nextDate.getDate() + intervalDays);
    }

    if (!nextDate) continue;

    // If the next date is in the past, advance it
    while (nextDate < now) {
      nextDate.setDate(nextDate.getDate() + intervalDays);
    }

    // Project forward
    while (nextDate <= endDate) {
      projections.push({
        date: nextDate.toISOString().split("T")[0],
        name: item.name,
        amount: parseFloat(item.amount),
        accountId: item.accountId,
      });
      nextDate = new Date(nextDate);
      nextDate.setDate(nextDate.getDate() + intervalDays);
    }
  }

  // Sort by date
  projections.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return projections;
}

export async function getProjectionSummary(days: number = 90) {
  const projections = await getProjections(days);

  // Get available balances
  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      availableBalance: accounts.availableBalance,
    })
    .from(accounts)
    .where(eq(accounts.isActive, true));

  const accountBalances = new Map(
    allAccounts.map((a) => [a.id, parseFloat(a.availableBalance || "0")])
  );

  // Aggregate by account to check for shortfalls
  const outflowsByAccount: Record<string, number> = {};
  for (const p of projections) {
    outflowsByAccount[p.accountId] =
      (outflowsByAccount[p.accountId] || 0) + p.amount;
  }

  const shortfalls: { accountId: string; accountName: string; shortfall: number }[] = [];
  for (const [accountId, outflow] of Object.entries(outflowsByAccount)) {
    const available = accountBalances.get(accountId) || 0;
    if (outflow > available) {
      const acct = allAccounts.find((a) => a.id === accountId);
      shortfalls.push({
        accountId,
        accountName: acct?.name || "Unknown",
        shortfall: outflow - available,
      });
    }
  }

  const totalProjected = projections.reduce((sum, p) => sum + p.amount, 0);

  return {
    projections,
    totalProjected,
    shortfalls,
  };
}
