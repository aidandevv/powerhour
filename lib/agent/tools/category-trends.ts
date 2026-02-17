/**
 * Category spending trends — shows how spending in each category has changed over recent months.
 * Use when user asks "how is my dining spending trending?", "show spending trends by category", "which categories am I spending more on?", etc.
 */
import { gte, gt, sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";

export interface MonthlyAmount {
  month: string; // YYYY-MM format
  amount: number;
}

export interface CategoryTrend {
  category: string;
  data: MonthlyAmount[];
  total: number;
  trend: "increasing" | "decreasing" | "stable";
  trendPercent: number | null; // percent change from first to last month
}

export interface CategoryTrendsResult {
  categories: CategoryTrend[];
  months: string[];
  summary: string;
}

export async function getCategoryTrends(months = 6, limit = 6): Promise<CategoryTrendsResult> {
  const maxMonths = Math.min(months, 12);
  const maxLimit = Math.min(limit, 10);

  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - maxMonths);
  const fromDateStr = fromDate.toISOString().split("T")[0];

  const rows = await db
    .select({
      category: transactions.category,
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        gte(transactions.date, fromDateStr),
        gt(transactions.amount, "0"),
        eq(transactions.pending, false)
      )
    )
    .groupBy(transactions.category, sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(transactions.category, sql`to_char(${transactions.date}, 'YYYY-MM')`);

  // Find top N categories by total spend
  const categoryTotals = new Map<string, number>();
  for (const row of rows) {
    const cat = row.category ?? "Uncategorized";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + parseFloat(row.total ?? "0"));
  }
  const topCategoryNames = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxLimit)
    .map(([cat]) => cat);

  // Build per-category monthly series
  const categoryMap = new Map<string, Map<string, number>>();
  for (const cat of topCategoryNames) {
    categoryMap.set(cat, new Map());
  }
  for (const row of rows) {
    const cat = row.category ?? "Uncategorized";
    if (!categoryMap.has(cat)) continue;
    categoryMap.get(cat)!.set(row.month, parseFloat(row.total ?? "0"));
  }

  // Build all months in range
  const allMonths: string[] = [];
  for (let i = maxMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Calculate trends
  const categories: CategoryTrend[] = topCategoryNames.map((cat) => {
    const monthlyData = allMonths.map((month) => ({
      month,
      amount: categoryMap.get(cat)?.get(month) ?? 0,
    }));

    const total = categoryTotals.get(cat) ?? 0;

    // Calculate trend from first to last month (only if both have data)
    const firstMonthAmount = monthlyData.find((m) => m.amount > 0)?.amount ?? 0;
    const lastMonthAmount = monthlyData[monthlyData.length - 1]?.amount ?? 0;
    let trend: "increasing" | "decreasing" | "stable" = "stable";
    let trendPercent: number | null = null;

    if (firstMonthAmount > 0 && lastMonthAmount > 0) {
      const change = lastMonthAmount - firstMonthAmount;
      trendPercent = (change / firstMonthAmount) * 100;
      if (trendPercent > 5) trend = "increasing";
      else if (trendPercent < -5) trend = "decreasing";
    }

    return {
      category: cat,
      data: monthlyData,
      total,
      trend,
      trendPercent,
    };
  });

  // Summary
  const increasing = categories.filter((c) => c.trend === "increasing");
  const decreasing = categories.filter((c) => c.trend === "decreasing");

  let summary = `Analyzed top ${categories.length} spending categories over the past ${maxMonths} months.`;
  if (increasing.length > 0) {
    summary += ` **${increasing.length} trending up**: ${increasing.map((c) => c.category).join(", ")}.`;
  }
  if (decreasing.length > 0) {
    summary += ` **${decreasing.length} trending down**: ${decreasing.map((c) => c.category).join(", ")}.`;
  }

  return {
    categories,
    months: allMonths,
    summary,
  };
}
