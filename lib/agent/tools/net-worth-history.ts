/**
 * Net worth history tool — shows how net worth has changed over time.
 * Use when user asks "how has my net worth changed?", "net worth trend", "am I building wealth?", "show my net worth over time", etc.
 */
import { gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots, accounts } from "@/lib/db/schema";

export interface NetWorthDataPoint {
  date: string;
  netWorth: number;
}

export interface NetWorthHistoryResult {
  history: NetWorthDataPoint[];
  summary: string;
  currentNetWorth: number | null;
  change: number | null;
  changePercent: number | null;
  trend: "increasing" | "decreasing" | "stable" | "insufficient-data";
}

export async function getNetWorthHistory(days = 180): Promise<NetWorthHistoryResult> {
  const maxDays = Math.min(days, 730); // Cap at 2 years
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - maxDays);
  const fromDateStr = fromDate.toISOString().split("T")[0];

  const result = await db
    .select({
      date: balanceSnapshots.snapshotDate,
      netWorth: sql<string>`sum(
        CASE
          WHEN ${accounts.type} IN ('credit', 'loan') THEN -abs(${balanceSnapshots.currentBalance})
          ELSE ${balanceSnapshots.currentBalance}
        END
      )`,
    })
    .from(balanceSnapshots)
    .innerJoin(accounts, sql`${balanceSnapshots.accountId} = ${accounts.id}`)
    .where(gte(balanceSnapshots.snapshotDate, fromDateStr))
    .groupBy(balanceSnapshots.snapshotDate)
    .orderBy(balanceSnapshots.snapshotDate);

  const history: NetWorthDataPoint[] = result.map((r) => ({
    date: r.date,
    netWorth: parseFloat(r.netWorth || "0"),
  }));

  let summary = "";
  let currentNetWorth: number | null = null;
  let change: number | null = null;
  let changePercent: number | null = null;
  let trend: "increasing" | "decreasing" | "stable" | "insufficient-data" = "insufficient-data";

  if (history.length === 0) {
    summary = "No net worth history available. Balance snapshots are created daily as data syncs.";
  } else if (history.length < 7) {
    currentNetWorth = history[history.length - 1]?.netWorth ?? null;
    summary = `Your current net worth is $${currentNetWorth?.toFixed(0) ?? "0"}. Not enough history yet for trend analysis (need 7+ days of data).`;
  } else {
    const latest = history[history.length - 1];
    const earliest = history[0];
    currentNetWorth = latest.netWorth;
    change = currentNetWorth - earliest.netWorth;
    changePercent = earliest.netWorth !== 0 ? (change / Math.abs(earliest.netWorth)) * 100 : 0;

    if (Math.abs(changePercent) < 1) {
      trend = "stable";
    } else if (change > 0) {
      trend = "increasing";
    } else {
      trend = "decreasing";
    }

    const direction = trend === "increasing" ? "up" : trend === "decreasing" ? "down" : "stable";
    const sign = change >= 0 ? "+" : "";
    summary = `Your net worth has gone ${direction} by ${sign}$${change.toFixed(0)} (${sign}${changePercent.toFixed(1)}%) over the past ${history.length} days. Current net worth: $${currentNetWorth.toFixed(0)}.`;
  }

  return {
    history,
    summary,
    currentNetWorth,
    change,
    changePercent,
    trend,
  };
}
