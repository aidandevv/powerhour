import { NextRequest, NextResponse } from "next/server";
import { gte, lte, gt, sql, eq, isNotNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];

    const from = req.nextUrl.searchParams.get("from") || monthStart;
    const to = req.nextUrl.searchParams.get("to") || today;
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "10", 10), 25);

    const rows = await db
      .select({
        merchantName: transactions.merchantName,
        logoUrl: transactions.logoUrl,
        total: sql<string>`sum(${transactions.amount})`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          gte(transactions.date, from),
          lte(transactions.date, to),
          gt(transactions.amount, "0"),
          eq(transactions.pending, false),
          isNotNull(transactions.merchantName)
        )
      )
      .groupBy(transactions.merchantName, transactions.logoUrl)
      .orderBy(sql`sum(${transactions.amount}) desc`)
      .limit(limit);

    const merchants = rows.map((r) => ({
      name: r.merchantName!,
      logoUrl: r.logoUrl ?? null,
      amount: parseFloat(r.total ?? "0"),
      count: r.count,
    }));

    return NextResponse.json({ merchants, from, to });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch merchants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
