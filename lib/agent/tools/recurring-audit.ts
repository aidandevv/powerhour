/**
 * Recurring expense audit — flag subscriptions/bills with no recent activity.
 * Use when user asks to "review subscriptions", "audit recurring", or find unused subscriptions.
 */
import { db } from "@/lib/db";
import { recurringItems, transactions, accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DAYS_THRESHOLD = 90;

export interface RecurringAuditItem {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  frequency: string;
  lastDate: string | null;
  daysSinceLastSeen: number | null;
  flagged: boolean;
  reason: string;
}

export interface RecurringAuditResult {
  items: RecurringAuditItem[];
  flaggedCount: number;
  summary: string;
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return amount * (52 / 12);
    case "biweekly":
      return amount * (26 / 12);
    case "monthly":
      return amount;
    case "annually":
      return amount / 12;
    default:
      return amount;
  }
}

export async function auditRecurringExpenses(): Promise<RecurringAuditResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 120);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const today = new Date();

  const rows = await db
    .select({
      id: recurringItems.id,
      name: recurringItems.name,
      merchantName: recurringItems.merchantName,
      amount: recurringItems.amount,
      frequency: recurringItems.frequency,
      lastDate: recurringItems.lastDate,
    })
    .from(recurringItems)
    .innerJoin(accounts, eq(recurringItems.accountId, accounts.id))
    .where(eq(recurringItems.isActive, true));

  const items: RecurringAuditItem[] = [];

  for (const row of rows) {
    const amount = parseFloat(String(row.amount));
    const lastDate = row.lastDate ?? null;

    let daysSinceLastSeen: number | null = null;
    if (lastDate) {
      const last = new Date(lastDate);
      daysSinceLastSeen = Math.floor(
        (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const flagged =
      daysSinceLastSeen !== null && daysSinceLastSeen >= DAYS_THRESHOLD;
    const reason = flagged
      ? `No charge in ${daysSinceLastSeen} days — consider cancelling if no longer needed`
      : daysSinceLastSeen !== null
        ? `Last seen ${daysSinceLastSeen} days ago`
        : "No recent transaction history";

    items.push({
      id: row.id,
      name: row.name,
      merchantName: row.merchantName ?? null,
      amount,
      frequency: row.frequency,
      lastDate,
      daysSinceLastSeen,
      flagged,
      reason,
    });
  }

  const flaggedCount = items.filter((i) => i.flagged).length;
  const monthlyAtRisk = items
    .filter((i) => i.flagged)
    .reduce((sum, i) => sum + toMonthlyAmount(i.amount, i.frequency), 0);

  let summary = `Found ${items.length} active recurring items.`;
  if (flaggedCount > 0) {
    summary += ` **${flaggedCount}** have had no charges in 90+ days (≈$${monthlyAtRisk.toFixed(0)}/mo if cancelled).`;
  } else if (items.length > 0) {
    summary += " All have recent activity.";
  }

  return {
    items: items.sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0)),
    flaggedCount,
    summary,
  };
}
