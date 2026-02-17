import { NextRequest, NextResponse } from "next/server";
import { and, gte, lte, sql, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const defaultTo = now.toISOString().split("T")[0];

    const from = searchParams.get("from") || defaultFrom;
    const to = searchParams.get("to") || defaultTo;

    const result = await db
      .select({
        category: transactions.category,
        total: sql<string>`sum(${transactions.amount})`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, from),
          lte(transactions.date, to),
          gt(transactions.amount, "0") // Only debits (positive amounts)
        )
      )
      .groupBy(transactions.category);

    const summary = result.map((r) => ({
      category: r.category || "Uncategorized",
      amount: parseFloat(r.total || "0"),
      count: r.count,
    }));

    return NextResponse.json({ summary, from, to });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch summary");
  }
}
