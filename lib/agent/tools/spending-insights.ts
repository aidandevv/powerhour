/**
 * Combined spending insights for budget planner "cut spending" flow.
 * Queries spending by category, recurring expenses, and subscription audit.
 */
import { getSpendingSummary } from "./spending-summary";
import { getRecurringExpenses } from "./recurring-expenses";
import { auditRecurringExpenses } from "./recurring-audit";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns calendar-month boundaries for the last N complete months */
function lastNMonthBounds(n: number): Array<{ from: string; to: string }> {
  const bounds: Array<{ from: string; to: string }> = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const end = new Date(now.getFullYear(), now.getMonth() - (i - 1), 0);   // last day of month i
    const start = new Date(end.getFullYear(), end.getMonth(), 1);           // first day
    bounds.push({ from: isoDate(start), to: isoDate(end) });
  }
  return bounds; // [last month, month before, month before that]
}

export interface SpendingInsightsResult {
  spending: {
    from: string;
    to: string;
    totalSpend: number;
    byCategory: Array<{
      category: string;
      amount: number;
      count: number;
      monthlyAvg: number;
      /** Spend in the most recent complete month */
      lastMonthAmount: number;
      /** Dollar change vs. the previous month (positive = more spending) */
      momChange: number | null;
      /** Percentage change vs. previous month */
      momChangePercent: number | null;
    }>;
  };
  recurring: {
    items: Array<{
      name: string;
      amount: number;
      frequency: string;
      monthlyEquivalent: number;
    }>;
    totalMonthlyEstimate: number;
  };
  audit: {
    flaggedCount: number;
    summary: string;
    flaggedItems: Array<{
      name: string;
      amount: number;
      frequency: string;
      daysSinceLastSeen: number | null;
      monthlyEquivalent: number;
    }>;
  };
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":   return amount * (52 / 12);
    case "biweekly": return amount * (26 / 12);
    case "monthly":  return amount;
    case "annually": return amount / 12;
    default:         return amount;
  }
}

export async function getSpendingInsights(): Promise<SpendingInsightsResult> {
  const months = lastNMonthBounds(3); // [last, prev, 2 prev]
  const threeMonthFrom = months[2].from;
  const threeMonthTo   = months[0].to;

  const [threeMonthResult, lastMonthResult, prevMonthResult, recurringResult, auditResult] =
    await Promise.all([
      getSpendingSummary({ from: threeMonthFrom, to: threeMonthTo }),
      getSpendingSummary({ from: months[0].from, to: months[0].to }),
      getSpendingSummary({ from: months[1].from, to: months[1].to }),
      getRecurringExpenses(),
      auditRecurringExpenses(),
    ]);

  const lastMonthMap = new Map(lastMonthResult.summary.map((r) => [r.category, r.amount]));
  const prevMonthMap = new Map(prevMonthResult.summary.map((r) => [r.category, r.amount]));

  const byCategory = threeMonthResult.summary.map((r) => {
    const lastAmt = lastMonthMap.get(r.category) ?? 0;
    const prevAmt = prevMonthMap.get(r.category);
    const momChange = prevAmt !== undefined ? lastAmt - prevAmt : null;
    const momChangePercent =
      prevAmt !== undefined && prevAmt > 0
        ? Math.round(((lastAmt - prevAmt) / prevAmt) * 100)
        : null;

    return {
      category: r.category,
      amount: r.amount,
      count: r.count,
      monthlyAvg: r.amount / 3,
      lastMonthAmount: lastAmt,
      momChange,
      momChangePercent,
    };
  });

  const recurringItems = recurringResult.items.map((r) => ({
    name: r.name,
    amount: parseFloat(String(r.amount)),
    frequency: r.frequency,
    monthlyEquivalent: toMonthlyAmount(parseFloat(String(r.amount)), r.frequency),
  }));

  const flaggedItems = auditResult.items
    .filter((i) => i.flagged)
    .map((i) => ({
      name: i.name,
      amount: i.amount,
      frequency: i.frequency,
      daysSinceLastSeen: i.daysSinceLastSeen,
      monthlyEquivalent: toMonthlyAmount(i.amount, i.frequency),
    }));

  return {
    spending: {
      from: threeMonthFrom,
      to: threeMonthTo,
      totalSpend: threeMonthResult.totalSpend,
      byCategory,
    },
    recurring: {
      items: recurringItems,
      totalMonthlyEstimate: recurringResult.totalMonthlyEstimate,
    },
    audit: {
      flaggedCount: auditResult.flaggedCount,
      summary: auditResult.summary,
      flaggedItems,
    },
  };
}
