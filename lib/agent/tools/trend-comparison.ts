/**
 * TOOL-04: Spending trend comparison across two time periods
 *
 * SEC-02: Drizzle .select() — SELECT only
 * SEC-03: Queries only transactions + accounts — no institutions
 */
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { and, gte, lte, gt, sql, eq } from "drizzle-orm";

export interface TrendComparisonParams {
  period1From: string;   // ISO date "YYYY-MM-DD"
  period1To: string;     // ISO date "YYYY-MM-DD"
  period2From: string;   // ISO date "YYYY-MM-DD"
  period2To: string;     // ISO date "YYYY-MM-DD"
  category?: string;     // Optional: compare only within a category
}

export interface PeriodSummary {
  from: string;
  to: string;
  totalSpend: number;
  topCategories: Array<{ category: string; amount: number }>;
}

export interface TrendComparisonResult {
  period1: PeriodSummary;
  period2: PeriodSummary;
  delta: number;            // period2.totalSpend - period1.totalSpend (positive = increased spending)
  deltaPercent: number | null; // null if period1 was zero
  trend: "increased" | "decreased" | "unchanged";
}

async function getPeriodSummary(
  from: string,
  to: string,
  category?: string
): Promise<PeriodSummary> {
  const baseConditions = [
    gte(transactions.date, from),
    lte(transactions.date, to),
    gt(transactions.amount, "0"),
    eq(transactions.pending, false),
  ];

  if (category) baseConditions.push(eq(transactions.category, category));

  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...baseConditions))
    .groupBy(transactions.category)
    .orderBy(sql`sum(${transactions.amount}) desc`);

  const topCategories = rows.slice(0, 5).map((r) => ({
    category: r.category ?? "Uncategorized",
    amount: parseFloat(r.total ?? "0"),
  }));

  const totalSpend = rows.reduce((sum, r) => sum + parseFloat(r.total ?? "0"), 0);

  return { from, to, totalSpend, topCategories };
}

export async function compareTrends(
  params: TrendComparisonParams
): Promise<TrendComparisonResult> {
  const [period1, period2] = await Promise.all([
    getPeriodSummary(params.period1From, params.period1To, params.category),
    getPeriodSummary(params.period2From, params.period2To, params.category),
  ]);

  const delta = period2.totalSpend - period1.totalSpend;
  const deltaPercent =
    period1.totalSpend === 0
      ? null
      : Math.round((delta / period1.totalSpend) * 100 * 100) / 100;

  let trend: TrendComparisonResult["trend"];
  if (Math.abs(delta) < 0.01) {
    trend = "unchanged";
  } else if (delta > 0) {
    trend = "increased";
  } else {
    trend = "decreased";
  }

  return { period1, period2, delta, deltaPercent, trend };
}
