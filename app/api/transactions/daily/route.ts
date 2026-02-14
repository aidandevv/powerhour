import { NextRequest, NextResponse } from "next/server";
import { gte, lte, gt, sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 91);

    const from = req.nextUrl.searchParams.get("from") || ninetyDaysAgo.toISOString().split("T")[0];
    const to = req.nextUrl.searchParams.get("to") || now.toISOString().split("T")[0];

    const rows = await db
      .select({
        date: transactions.date,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          gte(transactions.date, from),
          lte(transactions.date, to),
          gt(transactions.amount, "0"),
          eq(transactions.pending, false)
        )
      )
      .groupBy(transactions.date)
      .orderBy(transactions.date);

    const days = rows.map((r) => ({
      date: r.date,
      amount: parseFloat(r.total ?? "0"),
    }));

    return NextResponse.json({ days, from, to });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch daily spending";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
