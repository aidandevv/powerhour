import { NextRequest, NextResponse } from "next/server";
import { gte, gt, sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const months = Math.min(parseInt(req.nextUrl.searchParams.get("months") || "6", 10), 12);
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "6", 10), 10);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
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

    // Find top N categories by total spend across all months
    const categoryTotals = new Map<string, number>();
    for (const row of rows) {
      const cat = row.category ?? "Uncategorized";
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + parseFloat(row.total ?? "0"));
    }
    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cat]) => cat);

    // Build per-category monthly series
    const categoryMap = new Map<string, Map<string, number>>();
    for (const cat of topCategories) {
      categoryMap.set(cat, new Map());
    }
    for (const row of rows) {
      const cat = row.category ?? "Uncategorized";
      if (!categoryMap.has(cat)) continue;
      categoryMap.get(cat)!.set(row.month, parseFloat(row.total ?? "0"));
    }

    // Build all months in range
    const allMonths: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const categories = topCategories.map((cat) => ({
      category: cat,
      data: allMonths.map((month) => ({
        month,
        amount: categoryMap.get(cat)?.get(month) ?? 0,
      })),
    }));

    return NextResponse.json({ categories, months: allMonths });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch category trends";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
