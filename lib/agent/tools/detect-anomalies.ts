/** Spending anomaly detection — surfaces unusual charges and month-over-month spikes. */
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { sql, gt, eq } from "drizzle-orm";

export interface AnomalyResult {
  anomalies: string[];
  summary: string;
}

function formatCategory(raw: string): string {
  return raw
    .split("_")
    .map((w) => (w === "AND" ? "&" : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

export async function detectSpendingAnomalies(): Promise<AnomalyResult> {
  const today = new Date();

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    .toISOString()
    .split("T")[0];

  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const lookbackStart = ninetyDaysAgo.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [categoryRows, prevMonthTotal, currentMonthTotal] = await Promise.all([
    db
      .select({
        category: transactions.category,
        total: sql<string>`sum(${transactions.amount})`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        sql`${transactions.date} >= ${lookbackStart}
          AND ${transactions.date} <= ${todayStr}
          AND ${transactions.amount} > 0
          AND ${transactions.pending} = false
          AND ${transactions.category} IS NOT NULL`
      )
      .groupBy(transactions.category),

    db
      .select({ total: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(
        sql`${transactions.date} >= ${prevMonthStart}
          AND ${transactions.date} <= ${prevMonthEnd}
          AND ${transactions.amount} > 0
          AND ${transactions.pending} = false`
      ),

    db
      .select({ total: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(
        sql`${transactions.date} >= ${currentMonthStart}
          AND ${transactions.date} <= ${todayStr}
          AND ${transactions.amount} > 0
          AND ${transactions.pending} = false`
      ),
  ]);

  const anomalies: string[] = [];

  // Flag any category spending more than 2× the per-category average
  if (categoryRows.length > 1) {
    const totalSpend = categoryRows.reduce(
      (sum, r) => sum + parseFloat(r.total || "0"),
      0
    );
    const avg = totalSpend / categoryRows.length;
    for (const row of categoryRows) {
      const amt = parseFloat(row.total || "0");
      if (amt > avg * 2) {
        anomalies.push(
          `${formatCategory(row.category ?? "")} is $${amt.toFixed(2)} over the last 90 days — more than 2× the average category spend ($${avg.toFixed(2)}).`
        );
      }
    }
  }

  // Pro-rate previous month to elapsed days for a fair month-over-month comparison
  const prev = parseFloat(prevMonthTotal[0]?.total || "0");
  const curr = parseFloat(currentMonthTotal[0]?.total || "0");

  if (prev > 0 && curr > 0) {
    const daysElapsed = today.getDate();
    const daysInPrevMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      0
    ).getDate();
    const prevProRated = (prev / daysInPrevMonth) * daysElapsed;

    if (curr > prevProRated * 1.3) {
      const pct = Math.round(((curr - prevProRated) / prevProRated) * 100);
      anomalies.push(
        `Month-to-date spending ($${curr.toFixed(2)}) is ${pct}% above the pro-rated previous month pace ($${prevProRated.toFixed(2)}).`
      );
    }
  }

  const summary =
    anomalies.length === 0
      ? "No spending anomalies detected in the current period."
      : `Detected ${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}.`;

  return { anomalies, summary };
}
